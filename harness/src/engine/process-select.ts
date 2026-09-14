/**
 * Process selection with explicit crossover analysis.
 *
 * The question is never "which process is best" - it is "which process is best at
 * THIS quantity", and the answer flips as volume grows. Tooling is free at volume
 * and expensive at qty 1, so the crossover quantity is the number that decides
 * whether a design is viable at all.
 */

import { PROCESSES, MATERIAL_PROCESS_FIT, BOARD_PROCESS } from '../knowledge/processes.ts';
import type { ProcessId, Process } from '../knowledge/processes.ts';
import { MATERIALS } from '../knowledge/dfm.ts';
import { estimate } from '../knowledge/economics.ts';
import { minWallFor } from './dfm-check.ts';
import type { Part } from './types.ts';
import { partVolumeCm3 } from './types.ts';
import { round } from './util.ts';

export interface ProcessQuote {
  process: ProcessId;
  label: string;
  unitUsd: number;
  toolingUsd: number;
  leadTimeDays: [number, number];
  moq: number;
  /** Blocking issues for this part in this process. */
  blockers: string[];
  /** True when the part geometry or material violates a hard capability limit. */
  infeasible: boolean;
  notes: string[];
}

export interface ProcessRecommendation {
  atQuantity: number;
  recommended: ProcessId;
  unitUsd: number;
  quotes: ProcessQuote[];
  /** Quantity above which a tooled process beats the tool-less best option. */
  crossover: Array<{
    tooled: ProcessId;
    toolless: ProcessId;
    breakEvenUnits: number | null;
    /** Why there is no break-even: geometry the tool cannot make, or no price advantage at any volume. */
    reason?: string;
  }>;
  explanation: string;
}

/** Unit material cost, USD. */
export function materialCostUsd(part: Part): number {
  const mat = MATERIALS[part.material];
  if (!mat) return 0;
  const grams = partVolumeCm3(part) * mat.densityGPerCm3;
  return (grams / 1000) * estimate(mat.costPerKgUsd);
}

/** Unit cost for one part in one process at a given quantity, excluding tooling amortisation. */
export function unitProcessCostUsd(part: Part, process: Process, qty: number, includeFloor = true): number {
  const vol = partVolumeCm3(part);
  const volumeDiscount = Math.max(0.5, Math.min(1, Math.pow(Math.max(qty, 1), -0.1)));
  // A print service charges one minimum per ORDER, not one per part. Callers that
  // price a whole bill of materials pass includeFloor=false and apply the minimum once.
  const base = includeFloor ? Math.max(process.floorPriceUsd, vol * process.costPerCm3) : vol * process.costPerCm3;
  const material = process.id === 'fdm' || process.id === 'resin_sla' || process.id === 'sls_mjf'
    ? 0 // additive rates already include material
    : materialCostUsd(part);
  const setup = estimate(process.setupPerOrderUsd) / Math.max(qty, 1);
  return base * volumeDiscount + material + setup;
}

/** True when the part looks like a bare board rather than a machined or moulded shape. */
function looksLikeBoard(part: Part): boolean {
  return part.material === 'fr4' || /pcb|board/i.test(`${part.id} ${part.label}`);
}

/**
 * Can this process make this part in this material at all?
 *
 * A material with no entry in MATERIAL_PROCESS_FIT is free text we cannot reason
 * about, so it is not blocked here - only a known material can prove a process wrong.
 */
export function materialFitsProcess(part: Part, process: ProcessId): boolean {
  if (process === BOARD_PROCESS) return looksLikeBoard(part);
  const allowed = MATERIAL_PROCESS_FIT[part.material];
  if (!allowed) return true;
  return allowed.includes(process);
}

export function blockersFor(part: Part, process: Process): string[] {
  const blockers: string[] = [];
  const mat = MATERIALS[part.material];

  if (!materialFitsProcess(part, process.id)) {
    blockers.push(
      process.id === BOARD_PROCESS
        ? 'not a bare board - fabrication and assembly pricing does not apply'
        : `${part.material} is not a ${process.label} material`,
    );
    return blockers; // process-independent limits below add nothing to a wrong-material quote
  }

  const minWall = minWallFor(process, mat);
  if (part.wallMm !== undefined && part.wallMm < minWall) {
    blockers.push(`wall ${part.wallMm}mm < ${minWall}mm minimum`);
  }
  if (process.minDraftDeg > 0 && (part.draftDeg ?? 0) < process.minDraftDeg) {
    blockers.push(`draft ${part.draftDeg ?? 0}deg < ${process.minDraftDeg}deg minimum`);
  }
  if (part.toleranceMm !== undefined && part.toleranceMm < process.toleranceMm) {
    blockers.push(`tolerance +/-${part.toleranceMm}mm tighter than +/-${process.toleranceMm}mm`);
  }
  if (part.supportsTouchVisibleFace && process.supportsOnVisibleSurfaces) {
    blockers.push('supports would land on a cosmetic face');
  }
  for (const f of part.features ?? []) {
    if (f.sizeMm < process.minFeatureMm) blockers.push(`${f.kind} ${f.sizeMm}mm < ${process.minFeatureMm}mm minimum`);
  }
  return blockers;
}

const CANDIDATES: ProcessId[] = [
  'pcb_assembly',
  'fdm',
  'resin_sla',
  'sls_mjf',
  'cnc_3axis',
  'sheet_metal',
  'soft_tool',
  'injection_molding',
  'injection_molding_multicavity',
];

const TOOLLESS: ProcessId[] = ['pcb_assembly', 'fdm', 'resin_sla', 'sls_mjf', 'cnc_3axis', 'sheet_metal'];
const TOOLED: ProcessId[] = ['soft_tool', 'injection_molding', 'injection_molding_multicavity'];

/** Total per-unit cost including amortised tooling, at a given quantity. */
function unitWithTooling(part: Part, process: Process, qty: number): number {
  return unitProcessCostUsd(part, process, qty) + estimate(process.toolingUsd) / Math.max(qty, 1);
}

/**
 * The quantity at which a tooled process becomes cheaper than the tool-less
 * alternative, solved against the price curve rather than extrapolated from one point.
 *
 * Returns null when the tooled process never wins: either the geometry rules it out,
 * or its per-unit cost never falls far enough to repay the tool.
 */
export function crossoverUnits(part: Part, tooled: Process, toolless: Process): number | null {
  const tooling = estimate(tooled.toolingUsd);
  if (tooling <= 0) return null;

  const advantage = (qty: number): number => unitWithTooling(part, tooled, qty) - unitWithTooling(part, toolless, qty);

  // The saving per unit is not constant, so scan for the first quantity where the
  // tooled option is cheaper, then bisect the interval to land on the crossing.
  let low = 1;
  if (advantage(1) <= 0) return 1;
  let high = 1;
  const LIMIT = 5_000_000;
  while (high < LIMIT && advantage(high) > 0) {
    low = high;
    high *= 2;
  }
  if (advantage(high) > 0) return null;

  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (advantage(mid) <= 0) high = mid;
    else low = mid;
  }
  return high;
}

export function recommendProcess(part: Part, quantities: number[] = [1, 100, 1000]): ProcessRecommendation {
  const atQuantity = quantities[0] ?? 1;
  const quotes: ProcessQuote[] = CANDIDATES.map((id) => {
    const process = PROCESSES[id];
    const blockers = blockersFor(part, process);
    const unit = unitProcessCostUsd(part, process, atQuantity);
    const tooling = estimate(process.toolingUsd);
    return {
      process: id,
      label: process.label,
      unitUsd: round(unit + tooling / Math.max(atQuantity, 1)),
      toolingUsd: tooling,
      leadTimeDays: process.leadTimeDays,
      moq: process.moq,
      blockers,
      infeasible: blockers.length > 0,
      notes: process.notes,
    };
  });

  const feasible = quotes.filter((q) => !q.infeasible);
  const pool = feasible.length ? feasible : quotes;
  const bestAtQty = (qty: number): ProcessQuote =>
    pool.reduce((best, q) => {
      const unit = unitWithTooling(part, PROCESSES[q.process], qty);
      const bestUnit = unitWithTooling(part, PROCESSES[best.process], qty);
      return unit < bestUnit ? q : best;
    }, pool[0]);

  // Crossover: each tooled process against the cheapest tool-less option that can
  // actually make the part. A process the geometry rules out gets no break-even.
  const crossover: ProcessRecommendation['crossover'] = [];
  for (const t of TOOLED) {
    const tooled = PROCESSES[t];
    const tooledBlockers = blockersFor(part, tooled);
    if (tooledBlockers.length) {
      const alternatives = TOOLLESS.filter((id) => materialFitsProcess(part, id));
      crossover.push({
        tooled: t,
        toolless: alternatives[0] ?? TOOLLESS[0],
        breakEvenUnits: null,
        reason: `${tooled.label} cannot make this part: ${tooledBlockers[0]}`,
      });
      continue;
    }
    const toggle = TOOLLESS
      .filter((id) => materialFitsProcess(part, id))
      .map((id) => PROCESSES[id])
      .sort((a, b) => unitProcessCostUsd(part, a, 1000) - unitProcessCostUsd(part, b, 1000))[0] ?? PROCESSES.fdm;
    const breakEven = crossoverUnits(part, tooled, toggle);
    crossover.push({
      tooled: t,
      toolless: toggle.id,
      breakEvenUnits: breakEven,
      reason: breakEven === null ? 'no volume repays the tool at this part cost' : undefined,
    });
  }

  const bestNow = bestAtQty(atQuantity);
  const bestAt1k = bestAtQty(1000);
  const explanation = !feasible.length
    ? `No process in the catalogue can make this part as specified - the cheapest quote shown is itself infeasible. Fix the geometry or the material before pricing it.`
    : bestNow.process === bestAt1k.process
      ? `${bestNow.label} is the right choice from ${atQuantity} through 1,000+ units.`
      : `At ${atQuantity} units: ${bestNow.label}. At 1,000+ units: ${bestAt1k.label}. The design changes process as volume grows - quote both before committing.`;

  return {
    atQuantity,
    recommended: bestNow.process,
    unitUsd: round(unitWithTooling(part, PROCESSES[bestNow.process], atQuantity)),
    quotes: quotes.sort((a, b) => a.unitUsd - b.unitUsd),
    crossover,
    explanation,
  };
}
