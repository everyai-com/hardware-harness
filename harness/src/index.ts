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
import { loadSpecFile, starterSpecText } from './score-file.ts';

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

const HELP = `# Hardware Harness

Verify a hardware design before anyone spends money: are the parts real, does
the CAD hold up, what does it truly cost at 1 / 100 / 1,000 units.

Score your own design:
  node src/index.ts score my-design.json         human-readable verdict
  node src/index.ts score my-design.json --json  machine-readable report
  node src/index.ts score --init > my-design.json   starter spec — edit it, score it

Explore the built-ins:
  node src/index.ts                  re-score the first public benchmark run
  node src/index.ts --full <id>      full report for one fixture
  node src/index.ts --business       which business models actually clear
  node src/index.ts --fulfilment     one unit at a time vs batched production
  node src/index.ts --taxonomy       the accumulated failure library

A spec is JSON: name, intent, parts, operations, and the power, features,
interfaces and wiring the design declares. See examples/minimal-spec.json.`;

if (args.includes('--help') || args.includes('-h') || args[0] === 'help') {
  console.log(HELP);
  process.exit(0);
}

if (args[0] === 'score') {
  const rest = args.slice(1).filter((a) => a !== '--json');
  if (rest[0] === '--init' || rest[0] === 'init') {
    console.log(await starterSpecText());
    process.exit(0);
  }
  const file = rest[0];
  if (!file) {
    console.error('Usage: node src/index.ts score <spec.json>   (or: score --init to print a starter spec)');
    process.exit(2);
  }
  const result = await loadSpecFile(file);
  if (!result.ok) {
    const n = result.issues.length;
    console.error(`"${file}" needs ${n} fix${n === 1 ? '' : 'es'} before it can be scored:\n`);
    for (const i of result.issues) console.error(`- ${i.path || '<spec>'}: ${i.message}`);
    process.exit(2);
  }
  let report;
  try {
    report = evaluate(result.spec);
  } catch (e) {
    console.error(`Scoring crashed: ${e instanceof Error ? e.message : String(e)}`);
    console.error('The spec passed validation, so this is a harness bug — please report it with the spec file.');
    process.exit(1);
  }
  console.log(wantJson ? JSON.stringify(report, null, 2) : renderReport(report));
  process.exit(0);
}

if (args[0] && !args[0].startsWith('-')) {
  console.error(`Unknown command "${args[0]}". Did you mean "score <spec.json>"? Run with --help.`);
  process.exit(2);
}

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
  const rows: Array<[string, typeof r.single]> = [
    ['One at a time', r.single],
    [`Batched x${inputs.batchSize}`, r.batched],
  ];
  for (const [name, o] of rows) {
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
