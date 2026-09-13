/**
 * Report rendering. Human-readable output of an EvaluationReport.
 */

import type { EvaluationReport } from './evaluate.ts';
import type { Finding } from './dfm-check.ts';
import { usd } from './util.ts';

export function renderReport(r: EvaluationReport): string {
  const lines: string[] = [];
  lines.push(`# ${r.spec.name}`);
  if (r.spec.producedBy) lines.push(`_produced by ${r.spec.producedBy}_`);
  lines.push('');
  lines.push(`**Score ${r.score.total} / ${r.score.outOf}**   Gates: ${r.gates.passed ? 'PASS' : 'FAIL'}`);
  lines.push('');

  // Gates
  lines.push('## Gates');
  for (const g of r.gates.results) {
    lines.push(`- ${g.passed ? 'PASS' : 'FAIL'}  **${g.id}** ${g.label} — ${g.detail}`);
  }
  lines.push('');

  // Metrics
  const m = r.metrics;
  lines.push('## Metrics');
  lines.push(`- Parts: **${m.partCount}**`);
  lines.push(`- Estimated assembly: **${m.assemblyMinutes} min**`);
  lines.push(`- Critical-path lead time: **${m.criticalPathDays} days**`);
  lines.push(`- Findings: **${m.blockCount} blocking**, ${m.warnCount} warnings`);
  lines.push(`- Feature placement errors: **${m.featurePlacementErrors}**`);
  lines.push('');

  // Cost
  const first = r.cost.quantities[0];
  lines.push('## Landed cost');
  lines.push('| Qty | Build one | Sell one (incl. compliance) | Order total | Gross margin @ target retail |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const q of r.cost.quantities) {
    lines.push(
      `| ${q.quantity} | ${usd(q.personalBuildUsd)} | ${usd(q.unitUsd)} | ${usd(q.orderTotalUsd)} | ${q.grossMarginPct !== undefined ? `${q.grossMarginPct}%` : 'n/a'} |`,
    );
  }
  lines.push('');
  if (first && first.complianceAmortizedUsd > 0) {
    lines.push(
      `_At qty ${first.quantity}, compliance (certification etc.) is ${usd(first.complianceAmortizedUsd)} of the unit cost. Building one does not require it; selling one does._`,
    );
    lines.push('');
  }
  if (first) {
    lines.push(`Cost breakdown at qty ${first.quantity}:`);
    for (const l of first.breakdown) {
      lines.push(`- ${l.label}: ${usd(l.usd)}${l.note ? ` _(${l.note})_` : ''}`);
    }
    lines.push('');
  }
  lines.push(`Assumptions: ${r.cost.assumptions.join(' ')}`);
  lines.push(`Uncertainty: +/-${r.cost.uncertaintyPct}%.`);
  lines.push('');

  // Score axes
  lines.push('## Scorecard');
  lines.push('| Axis | Score | Weight | Basis |');
  lines.push('| --- | --- | --- | --- |');
  for (const a of r.score.axes) {
    lines.push(`| ${a.label} | ${a.score}/5 | ${a.weight} | ${a.basis} |`);
  }
  lines.push('');

  // Findings
  const blocks = r.findings.filter((f) => f.severity === 'block');
  const warns = r.findings.filter((f) => f.severity === 'warn');
  const infos = r.findings.filter((f) => f.severity === 'info');
  lines.push('## Blocking findings');
  lines.push(...renderFindings(blocks));
  lines.push('');
  lines.push('## Warnings');
  lines.push(...renderFindings(warns));
  if (infos.length) {
    lines.push('');
    lines.push('## Notes');
    lines.push(...renderFindings(infos));
  }
  lines.push('');
  lines.push('## Suggested next actions');
  for (const f of [...blocks, ...warns].slice(0, 8)) {
    lines.push(`- [${f.ruleId}] ${f.fix}`);
  }
  return lines.join('\n');
}

function renderFindings(findings: Finding[]): string[] {
  if (!findings.length) return ['- none'];
  const out: string[] = [];
  for (const f of findings) {
    out.push(`- **[${f.ruleId}]** (${f.subject}) ${f.message}`);
    out.push(`  → fix: ${f.fix}`);
    if (f.observed?.length) out.push(`  → seen in the wild: ${f.observed[0]}`);
  }
  return out;
}
