/**
 * Gates and scorecard.
 *
 * Gates are pass/fail - they exist because failing any one of them means the
 * design cannot ship, regardless of how good the rest is. Scores are comparative.
 * This is the LuxoBench rubric, executable.
 */

import { PROCESSES } from '../knowledge/processes.ts';
import type { ProductSpec } from './types.ts';
import { totalPartCount } from './types.ts';
import { checkDFM, estimateAssemblyMinutes, requiredCertifications, PART_COUNT_BUDGET, ASSEMBLY_MINUTE_BUDGET } from './dfm-check.ts';
import type { Finding } from './dfm-check.ts';
import { landedCost } from './cost.ts';
import type { CostReport } from './cost.ts';
import { SOURCING_RULES } from '../knowledge/compliance.ts';

export interface GateResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ScoreAxis {
  id: string;
  label: string;
  score: number; // 0-5
  weight: number;
  basis: string;
}

export interface EvaluationReport {
  spec: { id: string; name: string; producedBy?: string };
  gates: { passed: boolean; results: GateResult[] };
  findings: Finding[];
  score: { total: number; outOf: 5; axes: ScoreAxis[] };
  cost: CostReport;
  metrics: {
    partCount: number;
    assemblyMinutes: number;
    criticalPathDays: number;
    blockCount: number;
    warnCount: number;
    featurePlacementErrors: number;
  };
}

export function evaluate(spec: ProductSpec): EvaluationReport {
  const findings = checkDFM(spec);
  const partCount = totalPartCount(spec);
  const assemblyMinutes = estimateAssemblyMinutes(spec);
  const cost = landedCost(spec);

  const gates = runGates(spec, findings);

  const criticalPathDays = Math.max(
    ...spec.parts.map((p) => {
      const proc = PROCESSES[p.process];
      return proc ? (proc.leadTimeDays[0] + proc.leadTimeDays[1]) / 2 : 0;
    }),
    0,
  );

  const featurePlacementErrors = spec.features.filter(
    (f) => !f.present || (f.actualFace !== undefined && f.actualFace !== f.expectedFace),
  ).length;

  const axes = scoreAxes(spec, findings, cost, {
    partCount,
    assemblyMinutes,
    criticalPathDays,
    featurePlacementErrors,
  });

  const weightSum = axes.reduce((s, a) => s + a.weight, 0);
  const total = round(axes.reduce((s, a) => s + a.score * a.weight, 0) / weightSum);

  return {
    spec: { id: spec.id, name: spec.name, producedBy: spec.producedBy },
    gates,
    findings,
    score: { total, outOf: 5, axes },
    cost,
    metrics: {
      partCount,
      assemblyMinutes,
      criticalPathDays: round(criticalPathDays),
      blockCount: findings.filter((f) => f.severity === 'block').length,
      warnCount: findings.filter((f) => f.severity === 'warn').length,
      featurePlacementErrors,
    },
  };
}

export function runGates(spec: ProductSpec, findings: Finding[]): EvaluationReport['gates'] {
  const results: GateResult[] = [];

  // G1 - every catalog part is real, sourced and verified
  const catalog = spec.parts.filter((p) => p.kind === 'catalog');
  const unverified = catalog.filter((p) => !p.source?.mpn || !p.source?.stockVerified || p.source?.inStock === false);
  results.push({
    id: 'G1',
    label: 'Every part is real, in stock and orderable at the target quantity',
    passed: unverified.length === 0,
    detail: unverified.length
      ? `${unverified.length} part(s) with no verified MPN or live stock: ${unverified.map((p) => p.id).join(', ')}`
      : `${catalog.length} catalog part(s) verified`,
  });

  // G2 - no manual CAD repair
  const cadClean = spec.cad?.opensClean !== false && !spec.cad?.requiresManualRepair && spec.cad?.watertight !== false;
  results.push({
    id: 'G2',
    label: 'CAD opens clean - no manual repair required',
    passed: cadClean,
    detail: cadClean ? 'geometry is watertight and parametric' : 'a human has to fix the geometry before it can be made',
  });

  // G3 - electronics verified
  const hasElectronics = spec.parts.some((p) => p.source?.partType && p.source.partType !== 'mechanical' && p.source.partType !== 'enclosure');
  const electricalOk = !hasElectronics || (spec.cad?.ercClean !== false && spec.cad?.drcClean !== false);
  results.push({
    id: 'G3',
    label: 'ERC and DRC clean with footprints matched to parts',
    passed: electricalOk,
    detail: !hasElectronics ? 'no electronics' : electricalOk ? 'ERC/DRC clean' : 'unresolved electrical rule violations',
  });

  // G4 - safety envelope
  const safety = !spec.power.mainsInside && spec.power.battery !== 'lithium';
  results.push({
    id: 'G4',
    label: 'No mains voltage inside, no lithium cell',
    passed: safety,
    detail: safety
      ? 'low voltage only'
      : [spec.power.mainsInside ? 'mains inside product' : null, spec.power.battery === 'lithium' ? 'lithium cell' : null]
          .filter(Boolean)
          .join(', '),
  });

  // G5 - part count
  results.push({
    id: 'G5',
    label: `Part count within the ${PART_COUNT_BUDGET}-part budget`,
    passed: totalPartCount(spec) <= PART_COUNT_BUDGET,
    detail: `${totalPartCount(spec)} parts`,
  });

  // G6 - no improvised operations
  const improv = spec.operations.filter((o) => o.improvised);
  results.push({
    id: 'G6',
    label: 'No improvised operations in the build steps',
    passed: improv.length === 0,
    detail: improv.length ? improv.map((o) => o.label).join('; ') : 'all steps are designed operations',
  });

  // G7 - sourcing integrity on high-risk part types
  const counterfeitRisk = findings.filter((f) => f.ruleId === 'COUNTERFEIT_RISK' && f.subject !== 'product');
  results.push({
    id: 'G7',
    label: 'Programmable and analog parts from authorised channels',
    passed: counterfeitRisk.length === 0,
    detail: counterfeitRisk.length
      ? `${counterfeitRisk.length} line item(s) exposed to ${SOURCING_RULES.highRiskPartTypes.join('/')} counterfeits`
      : 'sourcing channels acceptable for the part types',
  });

  // G8 - certification accounted for
  const certGap = findings.find((f) => f.ruleId === 'CERT_GAP');
  results.push({
    id: 'G8',
    label: 'Certification requirements identified and budgeted',
    passed: !certGap,
    detail: certGap ? certGap.message : `budgeted: ${(spec.certificationsBudgeted ?? []).join(', ') || 'none required'}`,
  });

  // G10 - firmware readiness (the "does it actually run" gate)
  const electronic = spec.parts.filter((p) => p.source?.partType && p.source.partType !== 'mechanical' && p.source.partType !== 'enclosure').length;
  const fwFindings = findings.filter((f) => f.ruleId.startsWith('FIRMWARE') || f.ruleId === 'PINMAP_MISMATCH');
  const fwBlocking = fwFindings.filter((f) => f.severity === 'block').length;
  results.push({
    id: 'G10',
    label: 'Firmware ships, compiles, and matches the board pin map',
    passed: electronic < 2 || fwBlocking === 0,
    detail:
      electronic < 2
        ? 'no firmware required'
        : fwBlocking > 0
          ? fwFindings.filter((f) => f.severity === 'block').map((f) => f.ruleId).join('; ')
          : 'firmware present and consistent with the board',
  });

  // G9 - feature intent (the face-on-the-back gate)
  const misplaced = spec.features.filter((f) => !f.present || (f.actualFace !== undefined && f.actualFace !== f.expectedFace));
  results.push({
    id: 'G9',
    label: 'Every reference feature is present and on the correct face',
    passed: misplaced.length === 0,
    detail: misplaced.length
      ? misplaced.map((f) => (f.present ? `${f.label}: ${f.actualFace} instead of ${f.expectedFace}` : `${f.label}: missing`)).join('; ')
      : `${spec.features.length} feature(s) conform`,
  });

  return { passed: results.every((r) => r.passed), results };
}

function scoreAxes(
  spec: ProductSpec,
  findings: Finding[],
  cost: CostReport,
  m: { partCount: number; assemblyMinutes: number; criticalPathDays: number; featurePlacementErrors: number },
): ScoreAxis[] {
  const firstUnit = cost.quantities[0];
  // Cost is scored on the production case. The qty-1 reality is reported in the basis
  // and in the cost table - it is a business fact, not a design-quality fact.
  const production = cost.quantities[cost.quantities.length - 1];

  const margin = production?.grossMarginPct ?? 0;
  const costScore = margin >= 60 ? 5 : margin >= 40 ? 4 : margin >= 25 ? 3 : margin >= 10 ? 2 : margin > 0 ? 1 : 0;

  // Lead time - critical path in days
  const days = m.criticalPathDays;
  const leadScore = days <= 5 ? 5 : days <= 10 ? 4 : days <= 20 ? 3 : days <= 35 ? 2 : days <= 55 ? 1 : 0;

  // Ease of build - assembly minutes plus a penalty per improvised operation
  const improv = spec.operations.filter((o) => o.improvised).length;
  const buildScore = clamp5(
    5 - Math.max(0, (m.assemblyMinutes - 10) / 5) - improv * 1.5,
  );

  // Function - unresolved blocking findings
  const blocks = findings.filter((f) => f.severity === 'block').length;
  const functionScore = clamp5(5 - blocks);

  // Firmware - two artifacts have to agree
  const fwBlocks = findings.filter((f) => (f.ruleId.startsWith('FIRMWARE') || f.ruleId === 'PINMAP_MISMATCH') && f.severity === 'block').length;
  const fwWarns = findings.filter((f) => (f.ruleId.startsWith('FIRMWARE') || f.ruleId === 'PINMAP_MISMATCH') && f.severity === 'warn').length;
  const firmwareScore = clamp5(5 - fwBlocks * 3 - fwWarns * 1);

  // Reproducibility - second sources, tolerance stacks, documentation
  const singleSourced = findings.filter((f) => f.ruleId === 'NO_SECOND_SOURCE').length;
  const tolStacks = findings.filter((f) => f.ruleId === 'TOLERANCE_STACK').length;
  const reproScore = clamp5(5 - singleSourced * 1.5 - tolStacks * 1.5);

  // Feature intent - the reference is the spec
  const intentScore = clamp5(5 - m.featurePlacementErrors * 2.5);

  // Cost transparency - did they publish the number
  const disclosed = spec.costDisclosed !== false;
  const transparencyScore = disclosed ? 5 : 0;

  return [
    { id: 'firmware', label: 'Firmware', score: firmwareScore, weight: 0.14, basis: fwBlocks ? `${fwBlocks} blocking firmware issue(s)` : 'firmware consistent with the board' },
    { id: 'cost', label: 'Cost', score: costScore, weight: 0.16, basis: production?.grossMarginPct !== undefined ? `${margin}% gross margin at qty ${production.quantity}; qty 1 build cost ${firstUnit ? `$${firstUnit.personalBuildUsd}` : 'n/a'}` : 'no target retail given' },
    { id: 'leadTime', label: 'Lead time', score: leadScore, weight: 0.10, basis: `${m.criticalPathDays} day critical path` },
    { id: 'build', label: 'Ease of build', score: buildScore, weight: 0.16, basis: `${m.assemblyMinutes} min assembly, ${improv} improvised operation(s)` },
    { id: 'function', label: 'Does it work', score: functionScore, weight: 0.18, basis: `${blocks} blocking finding(s)` },
    { id: 'reproducibility', label: 'Reproducibility', score: reproScore, weight: 0.10, basis: `${singleSourced} single-sourced part(s), ${tolStacks} tolerance stack issue(s)` },
    { id: 'featureIntent', label: 'Feature intent', score: intentScore, weight: 0.10, basis: `${m.featurePlacementErrors} feature placement error(s)` },
    { id: 'transparency', label: 'Cost disclosed', score: transparencyScore, weight: 0.06, basis: disclosed ? 'published' : 'not published - the first thing buyers ask' },
  ];
}

function clamp5(n: number): number {
  return Math.max(0, Math.min(5, round(n)));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
