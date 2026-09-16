import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ASTRA_LAMP, FABLE_LAMP } from '../src/fixtures/keil-runs.ts';
import { evaluate } from '../src/engine/evaluate.ts';
import { lookupPart, partByMpn, suggestAlternates, catalogueStats } from '../src/knowledge/parts.ts';
import {
  validateOutcome,
  compareOutcomeToEstimate,
  calibrateFromOutcomes,
  recordOutcome,
} from '../src/engine/outcomes.ts';
import { diffSpecs } from '../src/engine/spec-diff.ts';
import type { ProductSpec } from '../src/engine/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

// ---- part catalogue ---------------------------------------------------------

test('Part lookup finds exact MPNs first, then prefixes, then categories', () => {
  const exact = lookupPart('ESP32-WROOM-32E');
  assert.equal(exact[0]!.mpn, 'ESP32-WROOM-32E');

  const prefix = lookupPart('esp32');
  assert.ok(prefix.length >= 2, 'both ESP32 modules match');
  assert.ok(prefix.every((p) => p.mpn.toLowerCase().includes('esp32') || p.label.toLowerCase().includes('esp32')));

  const category = lookupPart('regulator');
  assert.ok(category.length >= 3, 'regulator category is populated');
  assert.ok(category.every((p) => p.category === 'regulator' || p.partType === 'regulator'));
});

test('Part lookup is case-insensitive and capped', () => {
  const lower = lookupPart('stm32f103c8t6');
  assert.equal(lower[0]!.mpn, 'STM32F103C8T6');
  assert.equal(lookupPart('a', 3).length, 3);
});

test('Every catalogue entry is orderable: price band, distributors, evidence', () => {
  const stats = catalogueStats();
  assert.ok(stats.parts >= 30, `catalogue holds ${stats.parts} parts`);
  assert.ok(stats.categories.length >= 10, 'categories cover a real build');
  for (const part of lookupPart('', 100)) {
    assert.ok(part.typicalPriceUsd[0] > 0 && part.typicalPriceUsd[1] >= part.typicalPriceUsd[0], `${part.mpn} price band sane`);
    assert.ok(part.distributors.length > 0, `${part.mpn} has a channel`);
    assert.ok(part.evidence.length > 10, `${part.mpn} carries evidence`);
  }
});

test('High counterfeit risk flags the known-bad aisle', () => {
  const { highRisk } = catalogueStats();
  assert.ok(highRisk.includes('STM32F103C8T6'), 'the most-cloned MCU is flagged');
  assert.ok(highRisk.includes('AMS1117-3.3'), 'the most-cloned regulator is flagged');
  const blue = partByMpn('stm32f103c8t6')!;
  assert.deepEqual(blue.distributors, ['authorized'], 'no marketplace channel on a high-risk part');
});

test('Alternates resolve to real catalogue entries', () => {
  const alts = suggestAlternates('ESP32-WROOM-32E');
  assert.ok(alts.some((p) => p.mpn === 'ESP32-S3-WROOM-1'), 'S3 module is the drop-in upgrade');
  assert.deepEqual(suggestAlternates('NOT-A-PART'), [], 'unknown MPN has no alternates');
});

// ---- outcomes ---------------------------------------------------------------

test('A complete outcome validates as a verified receipt', () => {
  const outcome = validateOutcome({
    actualCostUsd: 42.5,
    actualMinutes: 35,
    poweredOn: true,
    failures: ['Dome needed a reprint'],
    proofUrl: 'https://example.com/build-log',
    author: 'builder-1',
  });
  assert.equal(outcome.measured, true);
  assert.equal(outcome.verified, true);
  assert.deepEqual(outcome.missingForVerification, []);
  assert.equal(outcome.author, 'builder-1');
});

test('An opinion-only outcome is stored but not measured or verified', () => {
  const outcome = validateOutcome({ poweredOn: true });
  assert.equal(outcome.measured, false);
  assert.equal(outcome.verified, false);
  assert.ok(outcome.missingForVerification.includes('cost actually paid'));
  assert.ok(outcome.missingForVerification.includes('assembly minutes'));
});

test('Bad outcome data throws instead of entering the calibration set', () => {
  assert.throws(() => validateOutcome({ actualCostUsd: 0 }), /actualCostUsd/);
  assert.throws(() => validateOutcome({ actualCostUsd: -5 }), /actualCostUsd/);
  assert.throws(() => validateOutcome({ actualMinutes: 999999999 }), /actualMinutes/);
  assert.throws(() => validateOutcome({ poweredOn: 'yes' as unknown as boolean }), /poweredOn/);
  assert.throws(() => validateOutcome({ proofUrl: 'javascript:alert(1)' }), /proofUrl/);
  assert.throws(() => validateOutcome({ proofUrl: 'not a url' }), /proofUrl/);
  assert.throws(() => validateOutcome(null as unknown as Record<string, unknown>), /object/);
});

test('Estimate-vs-actual reports ratios and tolerance', () => {
  const estimate = evaluate(ASTRA_LAMP);
  const qty1 = estimate.cost.quantities.find((q) => q.quantity === 1)!;
  // A build that came in exactly on estimate.
  const onTarget = compareOutcomeToEstimate(
    ASTRA_LAMP,
    validateOutcome({ actualCostUsd: qty1.personalBuildUsd, actualMinutes: estimate.metrics.assemblyMinutes, poweredOn: true }),
  );
  assert.equal(onTarget.costRatio, 1);
  assert.equal(onTarget.timeRatio, 1);
  assert.equal(onTarget.withinCostTolerance, true);

  // A build at double the estimate is outside the ±40% band.
  const overrun = compareOutcomeToEstimate(
    ASTRA_LAMP,
    validateOutcome({ actualCostUsd: qty1.personalBuildUsd * 2, poweredOn: false }),
  );
  assert.equal(overrun.costRatio, 2);
  assert.equal(overrun.withinCostTolerance, false);
  assert.equal(overrun.timeRatio, undefined, 'unmeasured lines stay undefined, not zero');
});

test('Calibration uses the median so one disaster does not drag the factor', () => {
  const cal = calibrateFromOutcomes([
    { estimatedCostUsd: 30, estimatedMinutes: 20, costRatio: 1.1, timeRatio: 1.0, withinCostTolerance: true, withinTimeTolerance: true },
    { estimatedCostUsd: 30, estimatedMinutes: 20, costRatio: 1.2, timeRatio: 1.1, withinCostTolerance: true, withinTimeTolerance: true },
    { estimatedCostUsd: 30, estimatedMinutes: 20, costRatio: 5.0, timeRatio: 4.0, withinCostTolerance: false, withinTimeTolerance: false },
  ]);
  assert.equal(cal.samples, 3);
  assert.equal(cal.costFactor, 1.2, 'median, not the 2.43 mean');
  assert.equal(cal.confidence, 'medium');
  assert.match(cal.note, /3 measured builds/);
});

test('Calibration confidence grows with samples, and empty is explicit', () => {
  const empty = calibrateFromOutcomes([]);
  assert.equal(empty.samples, 0);
  assert.equal(empty.costFactor, 1);
  assert.equal(empty.confidence, 'low');
  assert.match(empty.note, /uncalibrated/);

  const many = calibrateFromOutcomes(
    Array.from({ length: 10 }, () => ({
      estimatedCostUsd: 30, estimatedMinutes: 20, costRatio: 1.0, timeRatio: 1.0,
      withinCostTolerance: true, withinTimeTolerance: true,
    })),
  );
  assert.equal(many.confidence, 'high');
});

test('recordOutcome validates and compares in one call', () => {
  const { outcome, comparison } = recordOutcome(ASTRA_LAMP, {
    actualCostUsd: 31.04,
    actualMinutes: 25,
    poweredOn: true,
    proofUrl: 'https://example.com/receipt',
  });
  assert.equal(outcome.measured, true);
  assert.equal(outcome.verified, true);
  assert.ok(comparison.estimatedCostUsd > 0);
  assert.ok(comparison.costRatio !== undefined && comparison.costRatio > 0);
});

// ---- spec diff ----------------------------------------------------------------

test('Diffing a spec against itself reports no changes', () => {
  const d = diffSpecs(ASTRA_LAMP, ASTRA_LAMP);
  assert.equal(d.scoreDelta, 0);
  assert.equal(d.blocksDelta, 0);
  assert.deepEqual(d.partsAdded, []);
  assert.deepEqual(d.partsRemoved, []);
  assert.deepEqual(d.partsChanged, []);
  assert.deepEqual(d.gatesFlipped, []);
  assert.ok(d.costDeltas.every((c) => c.deltaUsd === 0));
  assert.match(d.summary, /Score unchanged/);
});

test('Astra vs Fable diff shows the fidelity-for-buildability tradeoff', () => {
  const d = diffSpecs(ASTRA_LAMP, FABLE_LAMP);
  assert.equal(d.before.id, 'lamp-astra');
  assert.equal(d.after.id, 'lamp-fable');
  assert.equal(d.scoreDelta, Math.round((evaluate(FABLE_LAMP).score.total - evaluate(ASTRA_LAMP).score.total) * 100) / 100);
  assert.ok(d.partsAdded.length + d.partsRemoved.length + d.partsChanged.length > 0, 'BOMs differ');
  assert.ok(d.gatesFlipped.some((g) => g.id === 'G9' && g.direction === 'fixed'), 'Fable fixes the face-on-the-back gate');
  assert.ok(d.summary.length > 20);
});

test('Fixing the face flips G9 from broke to fixed in the diff', () => {
  const fixed: ProductSpec = structuredClone(ASTRA_LAMP);
  for (const f of fixed.features) {
    if (f.id === 'face') f.actualFace = 'front';
  }
  const d = diffSpecs(ASTRA_LAMP, fixed);
  assert.deepEqual(d.gatesFlipped, [{ id: 'G9', label: evaluate(fixed).gates.results.find((g) => g.id === 'G9')!.label, direction: 'fixed' }]);
  assert.ok(d.scoreDelta > 0, 'fixing intent raises the score');
  assert.equal(d.blocksDelta, -1);
});

test('An added catalog part names its MPN, not a placeholder process', () => {
  const extended: ProductSpec = structuredClone(ASTRA_LAMP);
  extended.parts.push({
    id: 'extra-mcu',
    label: 'Spare ESP32 module',
    kind: 'catalog',
    process: 'fdm',
    material: 'module',
    qty: 1,
    bboxMm: { x: 25, y: 18, z: 3 },
    purchasePriceUsd: 3.5,
    source: { distributor: 'lcsc', mpn: 'ESP32-WROOM-32E', inStock: true, stockVerified: true, partType: 'mcu' },
  });
  const d = diffSpecs(ASTRA_LAMP, extended);
  const added = d.partsAdded.find((p) => p.id === 'extra-mcu');
  assert.ok(added, 'the new line is reported as added');
  assert.match(added!.changes.join('; '), /ESP32-WROOM-32E/);
  assert.ok(!added!.changes.join('; ').includes('fdm'), 'placeholder process is not shown for a bought part');
});

test('A part swap shows as changed with the fields that moved', () => {
  const swapped: ProductSpec = structuredClone(FABLE_LAMP);
  const mcu = swapped.parts.find((p) => p.source?.partType === 'mcu');
  assert.ok(mcu, 'fixture has an MCU line to swap');
  mcu!.source = { ...mcu!.source!, distributor: 'authorized', mpn: 'ESP32-S3-WROOM-1' };
  const d = diffSpecs(FABLE_LAMP, swapped);
  const change = d.partsChanged.find((p) => p.id === mcu!.id);
  assert.ok(change, 'the swapped line is reported as changed');
  assert.ok(change!.changes.some((c) => c.startsWith('source:')), `source change listed: ${change!.changes.join('; ')}`);
});

// ---- MCP surface for the new tools -------------------------------------------

function mcpCall(lines: unknown[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['src/mcp/server.ts'], { cwd: repoRoot });
    let out = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('MCP server timed out'));
    }, 8000);
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.on('close', () => {
      clearTimeout(timeout);
      try {
        resolve(out.split('\n').filter(Boolean).map((l) => JSON.parse(l)));
      } catch (err) {
        reject(err);
      }
    });
    for (const line of lines) child.stdin.write(JSON.stringify(line) + '\n');
    child.stdin.end();
  });
}

test('MCP: the four new tools are registered and callable', async () => {
  const responses = await mcpCall([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'hardware_part_lookup', arguments: { query: 'ultrasonic' } } },
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'hardware_record_outcome', arguments: { spec: ASTRA_LAMP, actualCostUsd: 35, poweredOn: true } },
    },
    {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'hardware_spec_diff', arguments: { specA: ASTRA_LAMP, specB: FABLE_LAMP } },
    },
    {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'hardware_calibration', arguments: { pairs: [{ costRatio: 1.1, timeRatio: 1.0 }] } },
    },
  ]);

  const names: string[] = responses.find((r) => r.id === 2).result.tools.map((t: { name: string }) => t.name);
  for (const tool of ['hardware_part_lookup', 'hardware_record_outcome', 'hardware_calibration', 'hardware_spec_diff']) {
    assert.ok(names.includes(tool), `${tool} is registered`);
  }
  assert.equal(names.length, 18, `18 tools registered, got ${names.length}`);

  const lookup = JSON.parse(responses.find((r) => r.id === 3).result.content[0].text);
  assert.ok(lookup.results.some((p: { mpn: string }) => p.mpn === 'HC-SR04'), 'ultrasonic search finds the HC-SR04');

  const outcome = JSON.parse(responses.find((r) => r.id === 4).result.content[0].text);
  assert.equal(outcome.outcome.measured, true);
  assert.ok(outcome.comparison.costRatio > 0);

  const diff = JSON.parse(responses.find((r) => r.id === 5).result.content[0].text);
  assert.equal(diff.before.id, 'lamp-astra');
  assert.ok(diff.scoreDelta !== 0);

  const cal = JSON.parse(responses.find((r) => r.id === 6).result.content[0].text);
  assert.equal(cal.samples, 1);
  assert.equal(cal.costFactor, 1.1);
});

test('MCP: lookup and diff errors are readable, not crashes', async () => {
  const responses = await mcpCall([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'hardware_part_lookup', arguments: { mpn: 'NOT-A-PART' } } },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'hardware_spec_diff', arguments: { specA: ASTRA_LAMP } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'hardware_calibration', arguments: { pairs: 'nope' } } },
  ]);
  assert.equal(responses.find((r) => r.id === 2).result.isError, true);
  assert.match(responses.find((r) => r.id === 2).result.content[0].text, /Unknown MPN/);
  assert.equal(responses.find((r) => r.id === 3).result.isError, true);
  assert.match(responses.find((r) => r.id === 3).result.content[0].text, /specA/);
  assert.equal(responses.find((r) => r.id === 4).result.isError, true);
});

// ---- CLI ----------------------------------------------------------------------

function runCli(args: string[]): Promise<{ stdout: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['src/index.ts', ...args], { cwd: repoRoot });
    let stdout = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI timed out: ${args.join(' ')}`));
    }, 20_000);
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ stdout, code });
    });
  });
}

test('CLI --parts searches the catalogue and --diff diffs two fixtures', async () => {
  const parts = await runCli(['--parts', 'ESP32']);
  assert.equal(parts.code, 0);
  assert.match(parts.stdout, /ESP32-WROOM-32E/);
  assert.ok(!parts.stdout.includes('# Hardware Harness - first live run'), 'parts mode prints only its own report');

  const stats = await runCli(['--parts']);
  assert.match(stats.stdout, /Part catalogue/);

  const diff = await runCli(['--diff', 'lamp-astra', 'lamp-fable']);
  assert.equal(diff.code, 0);
  assert.match(diff.stdout, /Diff: .* -> /);
  assert.match(diff.stdout, /Score:/);
  assert.ok(!diff.stdout.includes('# Hardware Harness - first live run'), 'diff mode prints only its own report');

  const usage = await runCli(['--diff', 'nope', 'lamp-astra']);
  assert.match(usage.stdout, /Usage/);
});
