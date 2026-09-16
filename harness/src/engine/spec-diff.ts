/**
 * Spec diff.
 *
 * Every design on the hub is remixable, so "what changed" is a first-class
 * question: which parts were added or removed, whether the score moved,
 * which gates flipped, and what happened to cost. This module answers it
 * structurally - from the specs and their evaluations, not from prose.
 */

import { evaluate } from './evaluate.ts';
import type { ProductSpec } from './types.ts';
import { round } from './util.ts';

export interface PartChange {
  id: string;
  label: string;
  /** Fields that changed, as "field: before -> after". */
  changes: string[];
}

export interface GateFlip {
  id: string;
  label: string;
  /** 'fixed' means fail->pass, 'broke' means pass->fail. */
  direction: 'fixed' | 'broke';
}

export interface CostDelta {
  quantity: number;
  beforeUsd: number;
  afterUsd: number;
  deltaUsd: number;
  deltaPct?: number;
}

export interface SpecDiff {
  before: { id: string; name: string; score: number; gatesPassed: boolean };
  after: { id: string; name: string; score: number; gatesPassed: boolean };
  scoreDelta: number;
  partsAdded: PartChange[];
  partsRemoved: PartChange[];
  partsChanged: PartChange[];
  gatesFlipped: GateFlip[];
  blocksDelta: number;
  costDeltas: CostDelta[];
  /** One-line human summary, best change first. */
  summary: string;
}

const COMPARED_PART_FIELDS = [
  'label',
  'kind',
  'process',
  'material',
  'qty',
  'wallMm',
  'toleranceMm',
  'purchasePriceUsd',
] as const;

export function diffSpecs(before: ProductSpec, after: ProductSpec): SpecDiff {
  const reportA = evaluate(before);
  const reportB = evaluate(after);

  const mapA = new Map(before.parts.map((p) => [p.id, p]));
  const mapB = new Map(after.parts.map((p) => [p.id, p]));

  const partsAdded: PartChange[] = [];
  const partsRemoved: PartChange[] = [];
  const partsChanged: PartChange[] = [];

  for (const [id, partB] of mapB) {
    const partA = mapA.get(id);
    if (!partA) {
      // Catalog parts carry a placeholder process, so the origin line names the
      // sourcing identity (MPN/channel) instead of a process that never made it.
      const origin = partB.kind === 'catalog'
        ? (partB.source?.mpn ?? partB.source?.distributor ?? 'catalog')
        : partB.process;
      partsAdded.push({ id, label: partB.label, changes: [`new ${partB.kind} part (${origin})`] });
      continue;
    }
    const changes: string[] = [];
    for (const field of COMPARED_PART_FIELDS) {
      const a = partA[field];
      const b = partB[field];
      if (a !== b && !(a === undefined && b === undefined)) {
        changes.push(`${field}: ${fmt(a)} -> ${fmt(b)}`);
      }
    }
    const srcA = partA.source ? `${partA.source.distributor}/${partA.source.mpn ?? 'no-mpn'}` : 'no source';
    const srcB = partB.source ? `${partB.source.distributor}/${partB.source.mpn ?? 'no-mpn'}` : 'no source';
    if (srcA !== srcB) changes.push(`source: ${srcA} -> ${srcB}`);
    if (changes.length) partsChanged.push({ id, label: partB.label, changes });
  }
  for (const [id, partA] of mapA) {
    if (!mapB.has(id)) partsRemoved.push({ id, label: partA.label, changes: ['removed from the BOM'] });
  }

  const gatesFlipped: GateFlip[] = [];
  for (const gateB of reportB.gates.results) {
    const gateA = reportA.gates.results.find((g) => g.id === gateB.id);
    if (!gateA || gateA.passed === gateB.passed) continue;
    gatesFlipped.push({
      id: gateB.id,
      label: gateB.label,
      direction: gateB.passed ? 'fixed' : 'broke',
    });
  }

  const scoreDelta = round(reportB.score.total - reportA.score.total);
  const blocksDelta = reportB.metrics.blockCount - reportA.metrics.blockCount;

  const costDeltas: CostDelta[] = reportB.cost.quantities.map((qb) => {
    const qa = reportA.cost.quantities.find((q) => q.quantity === qb.quantity);
    const beforeUsd = qa ? qa.personalBuildUsd : 0;
    const deltaUsd = round(qb.personalBuildUsd - beforeUsd);
    return {
      quantity: qb.quantity,
      beforeUsd,
      afterUsd: qb.personalBuildUsd,
      deltaUsd,
      deltaPct: beforeUsd > 0 ? round((deltaUsd / beforeUsd) * 100) : undefined,
    };
  });

  return {
    before: { id: before.id, name: before.name, score: reportA.score.total, gatesPassed: reportA.gates.passed },
    after: { id: after.id, name: after.name, score: reportB.score.total, gatesPassed: reportB.gates.passed },
    scoreDelta,
    partsAdded,
    partsRemoved,
    partsChanged,
    gatesFlipped,
    blocksDelta,
    costDeltas,
    summary: summarise(scoreDelta, gatesFlipped, blocksDelta, partsAdded, partsRemoved, partsChanged),
  };
}

function summarise(
  scoreDelta: number,
  flips: GateFlip[],
  blocksDelta: number,
  added: PartChange[],
  removed: PartChange[],
  changed: PartChange[],
): string {
  const bits: string[] = [];
  bits.push(scoreDelta === 0 ? 'Score unchanged' : `Score ${scoreDelta > 0 ? '+' : ''}${scoreDelta}`);
  const fixed = flips.filter((f) => f.direction === 'fixed');
  const broke = flips.filter((f) => f.direction === 'broke');
  if (fixed.length) bits.push(`fixed ${fixed.map((f) => f.id).join(', ')}`);
  if (broke.length) bits.push(`broke ${broke.map((f) => f.id).join(', ')}`);
  if (blocksDelta !== 0) bits.push(`${Math.abs(blocksDelta)} ${blocksDelta < 0 ? 'fewer' : 'more'} blocking finding${Math.abs(blocksDelta) === 1 ? '' : 's'}`);
  const partBits: string[] = [];
  if (added.length) partBits.push(`${added.length} added`);
  if (removed.length) partBits.push(`${removed.length} removed`);
  if (changed.length) partBits.push(`${changed.length} changed`);
  if (partBits.length) bits.push(`parts: ${partBits.join(', ')}`);
  else bits.push('no part changes');
  return bits.join('; ') + '.';
}

function fmt(value: unknown): string {
  if (value === undefined) return 'unset';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
