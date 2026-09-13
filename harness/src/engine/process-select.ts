/**
 * Process selection with explicit crossover analysis.
 *
 * The question is never "which process is best" - it is "which process is best at
 * THIS quantity", and the answer flips as volume grows. Tooling is free at volume
 * and expensive at qty 1, so the crossover quantity is the number that decides
 * whether a design is viable at all.
 */

import { PROCESSES } from '../knowledge/processes.ts';
import type { ProcessId, Process } from '../knowledge/processes.ts';
import { MATERIALS } from '../knowledge/dfm.ts';
import { estimate } from '../knowledge/economics.ts';
import { minWallFor } from './dfm-check.ts';
import type { Part } from './types.ts';
import { partVolumeCm3 } from './types.ts';

export interface ProcessQuote {
  process: ProcessId;
  label: string;
  unitUsd: number;
  toolingUsd: number;
  leadTimeDays: [number, number];
  moq: number;
  /** Blocking issues for this part in this process. */
  blockers: string[];
  /** True when the part geometry violates a hard capability limit. */
  infeasible: boolean;
  notes: string[];
}

export interface ProcessRecommendation {
  atQuantity: number;
  recommended: ProcessId;
  unitUsd: number;
  quotes: ProcessQuote[];
  /** Quantity above which a tooled process beats the tool-less best option. */
  crossover: Array<{ tooled: ProcessId; toolless: ProcessId; breakEvenUnits: number | null }>;
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

export function blockersFor(part: Part, process: Process): string[] {
  const blockers: string[] = [];
  const mat = MATERIALS[part.material];
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
      const process = PROCESSES[q.process];
      const unit = unitProcessCostUsd(part, process, qty) + estimate(process.toolingUsd) / Math.max(qty, 1);
      const bestUnit = unitProcessCostUsd(part, PROCESSES[best.process], qty) + estimate(PROCESSES[best.process].toolingUsd) / Math.max(qty, 1);
      return unit < bestUnit ? q : best;
    }, pool[0]);

  // Crossover: tooled process vs the best tool-less option
  const TOOLLESS: ProcessId[] = ['pcb_assembly', 'fdm', 'resin_sla', 'sls_mjf', 'cnc_3axis', 'sheet_metal'];
  const TOOLED: ProcessId[] = ['soft_tool', 'injection_molding', 'injection_molding_multicavity'];
  const crossover: ProcessRecommendation['crossover'] = [];
  for (const t of TOOLED) {
    const tooled = PROCESSES[t];
    const toggle = TOOLLESS.map((id) => PROCESSES[id]).sort(
      (a, b) => unitProcessCostUsd(part, a, 1000) - unitProcessCostUsd(part, b, 1000),
    )[0];
    const tooledUnit = unitProcessCostUsd(part, tooled, 1000);
    const toollessUnit = unitProcessCostUsd(part, toggle, 1000);
    const saving = toollessUnit - tooledUnit;
    const tooling = estimate(tooled.toolingUsd);
    crossover.push({
      tooled: t,
      toolless: toggle.id,
      breakEvenUnits: saving > 0 && tooling > 0 ? Math.ceil(tooling / saving) : null,
    });
  }

  const bestNow = bestAtQty(atQuantity);
  const bestAt1k = bestAtQty(1000);
  const explanation =
    bestNow.process === bestAt1k.process
      ? `${bestNow.label} is the right choice from ${atQuantity} through 1,000+ units.`
      : `At ${atQuantity} units: ${bestNow.label}. At 1,000+ units: ${bestAt1k.label}. The design changes process as volume grows - quote both before committing.`;

  return {
    atQuantity,
    recommended: bestNow.process,
    unitUsd: round(
      unitProcessCostUsd(part, PROCESSES[bestNow.process], atQuantity) +
        estimate(PROCESSES[bestNow.process].toolingUsd) / Math.max(atQuantity, 1),
    ),
    quotes: quotes.sort((a, b) => a.unitUsd - b.unitUsd),
    crossover,
    explanation,
  };
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
