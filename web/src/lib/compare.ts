import type { EvaluationReport, Finding } from "@/lib/harness/score";

export type CostDeltaRow = {
  quantity: number;
  aUnit: number | null;
  bUnit: number | null;
  aMargin: number | null;
  bMargin: number | null;
};

export type CompareResult = {
  scoreDelta: number;
  gatesA: number;
  gatesB: number;
  gatesTotal: number;
  newlyPassing: string[];
  newlyFailing: string[];
  added: Finding[];
  removed: Finding[];
  partsDelta: number;
  assemblyDelta: number;
  blockDelta: number;
  warnDelta: number;
  costs: CostDeltaRow[];
};

function findingKey(f: Finding): string {
  return `${f.severity}:${f.ruleId}:${f.subject}:${f.message}`;
}

/** Pure diff of two stored reports: what changed between versions. */
export function compareReports(a: EvaluationReport, b: EvaluationReport): CompareResult {
  const gatesA = a.gates.results.filter((g) => g.passed).length;
  const gatesB = b.gates.results.filter((g) => g.passed).length;
  const aById = new Map(a.gates.results.map((g) => [g.id, g.passed]));
  const newlyPassing: string[] = [];
  const newlyFailing: string[] = [];
  for (const g of b.gates.results) {
    const was = aById.get(g.id);
    if (was === undefined) continue;
    if (!was && g.passed) newlyPassing.push(g.id);
    if (was && !g.passed) newlyFailing.push(g.id);
  }

  const aKeys = new Set(a.findings.map(findingKey));
  const bKeys = new Set(b.findings.map(findingKey));
  const added = b.findings.filter((f) => !aKeys.has(findingKey(f)));
  const removed = a.findings.filter((f) => !bKeys.has(findingKey(f)));

  const aCosts = new Map(a.cost.quantities.map((q) => [q.quantity, q]));
  const bCosts = new Map(b.cost.quantities.map((q) => [q.quantity, q]));
  const quantities = [...new Set([...aCosts.keys(), ...bCosts.keys()])].sort((x, y) => x - y);
  const costs = quantities.map((quantity) => ({
    quantity,
    aUnit: aCosts.get(quantity)?.unitUsd ?? null,
    bUnit: bCosts.get(quantity)?.unitUsd ?? null,
    aMargin: aCosts.get(quantity)?.grossMarginPct ?? null,
    bMargin: bCosts.get(quantity)?.grossMarginPct ?? null,
  }));

  return {
    scoreDelta: Math.round((b.score.total - a.score.total) * 100) / 100,
    gatesA,
    gatesB,
    gatesTotal: b.gates.results.length,
    newlyPassing,
    newlyFailing,
    added,
    removed,
    partsDelta: b.metrics.partCount - a.metrics.partCount,
    assemblyDelta: b.metrics.assemblyMinutes - a.metrics.assemblyMinutes,
    blockDelta: b.metrics.blockCount - a.metrics.blockCount,
    warnDelta: b.metrics.warnCount - a.metrics.warnCount,
    costs,
  };
}
