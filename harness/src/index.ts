#!/usr/bin/env node
/**
 * Hardware Harness - CLI demo.
 *
 * Runs the fixtures through the full pipeline so you can see what the harness
 * catches. Bring your own agent: the same engine is exposed over MCP in
 * src/mcp/server.ts for Claude Code, Codex or anything else that speaks MCP.
 */

import { FIXTURES, ASTRA_LAMP } from './fixtures/keil-runs.ts';
import { BLUEPRINT_VOICE_NOTE } from './fixtures/blueprint-voice-note.ts';
import { VOICE_NOTE_FIXED } from './fixtures/voice-note-fixed.ts';
import { evaluate } from './engine/evaluate.ts';
import { renderReport } from './engine/report.ts';
import { FAILURE_TAXONOMY } from './knowledge/taxonomy.ts';
import { compareModels } from './engine/business.ts';
import { compareFulfilment } from './engine/fulfilment.ts';

/** Which blocking finding is the headline for each design. Most structural first. */
const HEADLINE_PRIORITY = [
  'MISSING_POWER_SOURCE',
  'ELECTRONICS_WITHOUT_PCB',
  'CERT_GAP',
  'MAINS_INSIDE_PRODUCT',
  'LITHIUM_CELL',
  'FEATURE_MISPLACED',
  'RENDER_CAD_DIVERGENCE',
  'TOLERANCE_STACK',
  'TOLERANCE_UNACHIEVABLE',
  'WALL_TOO_THIN',
  'COUNTERFEIT_RISK',
  'IMPROVISED_OPERATION',
  'MOQ_MISMATCH',
];

function headline(report: { findings: Array<{ ruleId: string; severity: string }> }): string {
  const blocks = report.findings.filter((f) => f.severity === 'block').map((f) => f.ruleId);
  for (const rule of HEADLINE_PRIORITY) if (blocks.includes(rule)) return rule;
  return blocks[0] ?? 'none';
}

const args = process.argv.slice(2);
const fullIdx = args.indexOf('--full');
const wantJson = args.includes('--json');
const taxonomy = args.includes('--taxonomy');
const business = args.includes('--business');
const fulfilment = args.includes('--fulfilment');

if (fulfilment) {
  const inputs = {
    partsCostUsd: 14.4,
    assemblyMinutes: 35,
    supplierCount: 3,
    batchSize: 20,
    labourRatePerHourUsd: 35,
    outboundShipUsd: 9,
    inboundParcelUsd: 12,
    priceUsd: 149,
    coordinationMinutesPerOrder: 25,
    imported: true,
  };
  console.log('# Fulfilment: one unit at a time vs batched\n');
  console.log('Same product, same price, same customer experience - one unit, delivered.\n');
  console.log('| Model | Cost/unit | Gross | Margin | Labour | $/labour hr |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  const r = compareFulfilment(inputs);
  for (const [name, o] of [['One at a time', r.single], [`Batched x${inputs.batchSize}`, r.batched]]) {
    console.log(
      `| ${name} | $${o.totalCostUsd} | $${o.grossProfitUsd} | ${o.grossMarginPct}% | ${o.labourMinutesPerUnit} min | $${o.grossProfitPerLabourHourUsd} |`,
    );
  }
  console.log('');
  console.log('Where the money goes (one at a time → batched):');
  const keys: Array<keyof typeof r.single> = ['partsUsd', 'inboundFreightUsd', 'dutyUsd', 'assemblyUsd', 'coordinationUsd', 'packagingUsd', 'outboundShipUsd'];
  for (const k of keys) {
    console.log(`- ${String(k).replace('Usd', '')}: $${r.single[k]} → $${r.batched[k]}`);
  }
  console.log('');
  console.log(`50% margin floor price: one-at-a-time $${r.single.minPriceFor50PctMarginUsd} · batched $${r.batched.minPriceFor50PctMarginUsd}`);
  process.exit(0);
}

if (business) {
  const models = compareModels({ lamp: ASTRA_LAMP, voiceNote: BLUEPRINT_VOICE_NOTE, voiceNoteFixed: VOICE_NOTE_FIXED });
  console.log('# Business model comparison\n');
  console.log('| Model | Price | Unit cost | Gross margin | /month @ volume | Labour hrs/mo | Gross profit per labour hour | Verdict |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const m of models) {
    console.log(
      `| ${m.label} | $${m.unitPriceUsd} | $${m.unitCostUsd} | ${m.grossMarginPct}% | $${m.monthly.grossProfitUsd} | ${m.monthly.labourHours} | **$${m.grossProfitPerLabourHourUsd}** | ${m.verdict.toUpperCase()} |`,
    );
  }
  console.log('');
  for (const m of models) {
    console.log(`**${m.label}** — ${m.description}`);
    console.log(`- ${m.blocker ?? 'No blocking arithmetic.'}`);
    console.log(`- To work: ${m.requirement}`);
    console.log(`- Annual gross profit at this volume: $${m.annualGrossProfitUsd.toLocaleString('en-US')}`);
    console.log('');
  }
  console.log('The yardstick is gross profit per hour of your own labour. Software can scale labour away; hardware cannot.');
  process.exit(0);
}

if (taxonomy) {
  console.log('# Failure taxonomy\n');
  for (const f of FAILURE_TAXONOMY) {
    console.log(`## ${f.label}`);
    console.log(`${f.symptom}`);
    console.log(`Evidence: ${f.evidence}`);
    console.log(`Observed in: ${f.observedIn.join(', ')}\n`);
  }
  process.exit(0);
}

const reports = FIXTURES.map((spec) => evaluate(spec));

if (wantJson) {
  console.log(JSON.stringify(reports, null, 2));
  process.exit(0);
}

if (fullIdx >= 0) {
  const id = args[fullIdx + 1];
  const report = reports.find((r) => r.spec.id === id) ?? reports[0];
  console.log(renderReport(report));
  process.exit(0);
}

// Default: head-to-head comparison, then the full report for the weaker design.
console.log('# Hardware Harness - first live run, re-scored\n');
console.log('Fixtures are reconstructions of the 12 Sep 2026 public run (see src/fixtures/keil-runs.ts).\n');

console.log('| Design | Model | Score | Gates | Parts | Assembly | Worst block |');
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const r of reports) {
  console.log(
    `| ${r.spec.name} | ${r.spec.producedBy ?? '-'} | **${r.score.total}/5** | ${r.gates.passed ? 'PASS' : 'FAIL'} | ${r.metrics.partCount} | ${r.metrics.assemblyMinutes} min | ${headline(r)} |`,
  );
}
console.log('');
console.log('## What each design got wrong\n');
for (const r of reports) {
  const blocks = r.findings.filter((f) => f.severity === 'block');
  console.log(`**${r.spec.name}** (${r.spec.producedBy})`);
  if (!blocks.length) console.log('- no blocking findings');
  for (const b of blocks) console.log(`- [${b.ruleId}] ${b.message}`);
  console.log('');
}
console.log(`Run \`node src/index.ts --full <id>\` for a complete report, or \`--taxonomy\` for the failure library.`);
console.log(`IDs: ${reports.map((r) => r.spec.id).join(', ')}`);
