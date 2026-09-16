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
import { lookupPart, catalogueStats } from './knowledge/parts.ts';
import { diffSpecs } from './engine/spec-diff.ts';

/** Which blocking finding is the headline for each design. Most structural first. */
const HEADLINE_PRIORITY = [
  'MISSING_POWER_SOURCE',
  'ELECTRONICS_WITHOUT_PCB',
  'FIRMWARE_MISSING',
  'FIRMWARE_DOES_NOT_BUILD',
  'PINMAP_MISMATCH',
  'NET_UNKNOWN_PART',
  'CERT_GAP',
  'MAINS_INSIDE_PRODUCT',
  'LITHIUM_CELL',
  'FEATURE_MISPLACED',
  'RENDER_CAD_DIVERGENCE',
  'TOLERANCE_STACK',
  'TOLERANCE_UNACHIEVABLE',
  'WALL_TOO_THIN',
  'COUNTERFEIT_RISK',
  'DRIVER_SIGNING_UNBUDGETED',
  'IMPROVISED_OPERATION',
  'MOQ_MISMATCH',
];

function headline(report: { findings: Array<{ ruleId: string; severity: string }> }): string {
  const blocks = report.findings.filter((f) => f.severity === 'block').map((f) => f.ruleId);
  for (const rule of HEADLINE_PRIORITY) if (blocks.includes(rule)) return rule;
  return blocks[0] ?? 'none';
}

/**
 * Exit after stdout has drained.
 *
 * Writing to a pipe is asynchronous, and process.exit() does not wait for it. With a
 * plain `console.log(...); process.exit(0)` after a large report, the last chunk was
 * dropped - `node src/index.ts --json | jq` failed at exactly 64 KiB with invalid
 * JSON, while `> file.json` worked because a file write is synchronous. That is the
 * worst shape of bug: correct in the shell, broken in the pipeline an agent uses.
 */
function finish(code = 0): void {
  const done = () => process.exit(code);
  if (process.stdout.writableLength === 0 && !process.stdout.writableNeedDrain) done();
  else process.stdout.once('drain', done);
}

const args = process.argv.slice(2);
const fullIdx = args.indexOf('--full');
const partsIdx = args.indexOf('--parts');
const diffIdx = args.indexOf('--diff');
const wantJson = args.includes('--json');
const taxonomy = args.includes('--taxonomy');
const business = args.includes('--business');
const fulfilment = args.includes('--fulfilment');

/**
 * One report per run. Every mode returns when it is done - none of them exits the
 * process itself, so exactly one thing is printed and stdout gets to flush.
 */
function main(): void {
  if (partsIdx >= 0) {
    const query = args[partsIdx + 1] ?? '';
    if (!query) {
      const stats = catalogueStats();
      console.log(`# Part catalogue: ${stats.parts} parts in ${stats.categories.length} categories\n`);
      console.log(`Categories: ${stats.categories.join(', ')}`);
      console.log(`High counterfeit risk: ${stats.highRisk.join(', ')}`);
      console.log('\nRun `node src/index.ts --parts <query>` to search (e.g. ESP32, ultrasonic, regulator).');
      return;
    }
    const results = lookupPart(query, 10);
    console.log(`# Parts matching "${query}"\n`);
    if (!results.length) console.log('No matches. Try an MPN fragment, a category (sensor, regulator) or a part type (mcu).');
    for (const p of results) {
      console.log(`## ${p.mpn} - ${p.label}`);
      console.log(`Typical qty-1: $${p.typicalPriceUsd[0]}-$${p.typicalPriceUsd[1]} · via ${p.distributors.join('/')} · counterfeit risk: ${p.counterfeitRisk}`);
      console.log(`${p.note}`);
      if (p.alternates.length) console.log(`Alternates: ${p.alternates.join(', ')}`);
      console.log('');
    }
    return;
  }

  if (diffIdx >= 0) {
    const idA = args[diffIdx + 1];
    const idB = args[diffIdx + 2];
    const specA = FIXTURES.find((f) => f.id === idA);
    const specB = FIXTURES.find((f) => f.id === idB);
    if (!specA || !specB) {
      console.log(`Usage: node src/index.ts --diff <idA> <idB>\nIDs: ${FIXTURES.map((f) => f.id).join(', ')}`);
      return;
    }
    const d = diffSpecs(specA, specB);
    console.log(`# Diff: ${d.before.name} -> ${d.after.name}\n`);
    console.log(`${d.summary}\n`);
    console.log(`Score: ${d.before.score} -> ${d.after.score} (${d.scoreDelta >= 0 ? '+' : ''}${d.scoreDelta})`);
    for (const g of d.gatesFlipped) console.log(`- Gate ${g.id} ${g.direction === 'fixed' ? 'FIXED' : 'BROKE'}: ${g.label}`);
    for (const p of d.partsAdded) console.log(`- + ${p.id} (${p.label})`);
    for (const p of d.partsRemoved) console.log(`- - ${p.id} (${p.label})`);
    for (const p of d.partsChanged) console.log(`- ~ ${p.id}: ${p.changes.join('; ')}`);
    console.log('');
    console.log('| Qty | Before | After | Delta |');
    console.log('| --- | --- | --- | --- |');
    for (const c of d.costDeltas) {
      console.log(`| ${c.quantity} | $${c.beforeUsd} | $${c.afterUsd} | ${c.deltaUsd >= 0 ? '+' : ''}$${c.deltaUsd}${c.deltaPct !== undefined ? ` (${c.deltaPct}%)` : ''} |`);
    }
    return;
  }

  if (fulfilment) {
    // The lamp's own numbers: $14.40 of parts, 35 minutes of hands on it, sold at $149.
    // Illustrative inputs for the CLI demo - the MCP surface takes them from the caller.
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
    return;
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
    return;
  }

  if (taxonomy) {
    console.log('# Failure taxonomy\n');
    for (const f of FAILURE_TAXONOMY) {
      console.log(`## ${f.label}`);
      console.log(`${f.symptom}`);
      console.log(`Evidence: ${f.evidence}`);
      console.log(`Observed in: ${f.observedIn.join(', ')}\n`);
    }
    return;
  }

  const reports = FIXTURES.map((spec) => evaluate(spec));

  if (wantJson) {
    console.log(JSON.stringify(reports, null, 2));
    return;
  }

  if (fullIdx >= 0) {
    const id = args[fullIdx + 1];
    const report = reports.find((r) => r.spec.id === id) ?? reports[0];
    console.log(renderReport(report));
    return;
  }

  // Default: the head-to-head table, then what each design got wrong.
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
}

main();
finish();
