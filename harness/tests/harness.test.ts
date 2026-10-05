import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ASTRA_LAMP, FABLE_LAMP, DJ_CONTROLLER } from '../src/fixtures/keil-runs.ts';
import { MUSE_DESK_COMPANION } from '../src/fixtures/muse-desk-companion.ts';
import { LAMP_REFERENCE_FEATURES } from '../src/fixtures/lamp.ts';
import { evaluate, runGates } from '../src/engine/evaluate.ts';
import { checkDFM } from '../src/engine/dfm-check.ts';
import { buildMuseScaffold } from '../src/engine/muse-scaffold.ts';
import { landedCost } from '../src/engine/cost.ts';
import { recommendProcess, unitProcessCostUsd } from '../src/engine/process-select.ts';
import { PROCESSES } from '../src/knowledge/processes.ts';
import { requiredCertifications } from '../src/engine/dfm-check.ts';
import type { ProductSpec } from '../src/engine/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

test('Astra design fails the feature-placement gate (face on the back)', () => {
  const report = evaluate(ASTRA_LAMP);
  const gate = report.gates.results.find((g) => g.id === 'G9');
  assert.ok(gate, 'G9 gate exists');
  assert.equal(gate!.passed, false, 'G9 must fail');
  assert.match(gate!.detail, /face/i);
  assert.equal(report.metrics.featurePlacementErrors, 1);
  const finding = report.findings.find((f) => f.ruleId === 'FEATURE_MISPLACED');
  assert.ok(finding, 'FEATURE_MISPLACED finding raised');
  assert.match(finding!.message, /back/);
});

test('Astra design is otherwise lean: fewer parts and a quicker build than Fable', () => {
  const astra = evaluate(ASTRA_LAMP);
  const fable = evaluate(FABLE_LAMP);
  assert.ok(astra.metrics.partCount < fable.metrics.partCount, 'Astra has fewer parts');
  assert.ok(
    astra.metrics.assemblyMinutes < fable.metrics.assemblyMinutes,
    'Astra assembles faster - the tradeoff the run reported',
  );
});

test('Fable design is caught by wall thickness and part count', () => {
  const report = evaluate(FABLE_LAMP);
  const rules = report.findings.map((f) => f.ruleId);
  assert.ok(rules.includes('WALL_TOO_THIN'), 'thin dome wall flagged');
  assert.ok(rules.includes('PART_COUNT_HIGH'), 'part count over budget flagged');
  const wall = report.findings.find((f) => f.ruleId === 'WALL_TOO_THIN')!;
  assert.match(wall.message, /0\.9mm/);
  assert.equal(report.gates.results.find((g) => g.id === 'G5')!.passed, false);
});

test('Fable design conforms on features - it is the reference-faithful design', () => {
  const report = evaluate(FABLE_LAMP);
  assert.equal(report.metrics.featurePlacementErrors, 0);
  assert.equal(report.gates.results.find((g) => g.id === 'G9')!.passed, true);
});

test('Neither design disclosed cost, so both are flagged', () => {
  for (const spec of [ASTRA_LAMP, FABLE_LAMP]) {
    const report = evaluate(spec);
    assert.ok(
      report.findings.some((f) => f.ruleId === 'COST_NOT_DISCLOSED'),
      `${spec.id} flagged for missing cost`,
    );
    const axis = report.score.axes.find((a) => a.id === 'transparency')!;
    assert.equal(axis.score, 0);
  }
});

test('Tooling amortisation is the number that decides viability', () => {
  const tooling = 5200;
  const perUnitAt250 = tooling / 250;
  const perUnitAt1000 = tooling / 1000;
  assert.equal(Math.round(perUnitAt250 * 100) / 100, 20.8);
  assert.equal(Math.round(perUnitAt1000 * 100) / 100, 5.2);
});

test('Process recommendation reports a crossover quantity for tooled processes', () => {
  const part = ASTRA_LAMP.parts[0];
  const rec = recommendProcess(part, [1, 100, 1000]);
  assert.ok(rec.quotes.length > 0);
  assert.ok(rec.crossover.length >= 1);
  const injection = rec.crossover.find((c) => c.tooled === 'injection_molding')!;
  assert.ok(injection, 'injection moulding considered');
  // A tooled process must be expensive at qty 1 and cheap at volume.
  const unit1 = unitProcessCostUsd(part, PROCESSES.injection_molding, 1);
  const unit1k = unitProcessCostUsd(part, PROCESSES.injection_molding, 1000);
  assert.ok(unit1k < unit1, 'unit cost falls with volume');
});

test('Landed cost falls with quantity and includes the hidden lines', () => {
  const report = landedCost(DJ_CONTROLLER);
  const q1 = report.quantities.find((q) => q.quantity === 1)!;
  const q1000 = report.quantities.find((q) => q.quantity === 1000)!;
  assert.ok(q1000.unitUsd < q1.unitUsd, 'unit cost falls as quantity rises');
  const labels = q1.breakdown.map((l) => l.label).join(' | ');
  assert.match(labels, /Signed driver/, 'signed driver line present - the invisible BOM cost');
  assert.match(labels, /Duty/, 'duty line present after the de minimis repeal');
  assert.ok(
    report.hiddenLinesFlagged.some((l) => /driver/i.test(l)),
    'hidden line flagged',
  );
});

test('DJ controller flags counterfeit exposure on MCU-class parts', () => {
  const report = evaluate(DJ_CONTROLLER);
  assert.ok(report.findings.some((f) => f.ruleId === 'COUNTERFEIT_RISK'));
  assert.equal(report.gates.results.find((g) => g.id === 'G7')!.passed, false);
});

test('Tolerance stacks are computed from contributors, not assumed', () => {
  const spec: ProductSpec = {
    ...ASTRA_LAMP,
    id: 'tolerance-test',
    interfaces: [{ id: 'tight', between: ['base', 'dome'], clearanceMm: 0.1, contributors: ['base', 'dome'] }],
  };
  const findings = checkDFM(spec);
  const stack = findings.find((f) => f.ruleId === 'TOLERANCE_STACK');
  assert.ok(stack, 'tight interface flagged');
  assert.equal(stack!.severity, 'block');
});

test('Certification triggers follow the power spec', () => {
  const bluetooth: ProductSpec = {
    ...ASTRA_LAMP,
    id: 'bt',
    power: { ...ASTRA_LAMP.power, wireless: 'bluetooth' },
  };
  assert.ok(requiredCertifications(bluetooth).includes('fcc_radio'));

  const mains: ProductSpec = { ...ASTRA_LAMP, id: 'mains', power: { ...ASTRA_LAMP.power, mainsInside: true } };
  assert.ok(requiredCertifications(mains).includes('ul_etl_mains'));

  const battery: ProductSpec = { ...ASTRA_LAMP, id: 'batt', power: { ...ASTRA_LAMP.power, battery: 'lithium' } };
  assert.ok(requiredCertifications(battery).includes('un383'));

  // The lamp, correctly designed for the US only, needs just the unintentional-radiator filing.
  assert.deepEqual(requiredCertifications(ASTRA_LAMP), ['fcc_unintentional']);

  // Selling into the EU adds CE + GPSR, and that follows the market, not the sourcing country.
  const eu: ProductSpec = { ...ASTRA_LAMP, id: 'eu', markets: ['eu'] };
  assert.deepEqual(requiredCertifications(eu).sort(), ['eu_ce', 'eu_gpsr', 'fcc_unintentional'].sort());

  // A shipped uncertified mains adapter drags a listing back in. Charging over USB-C
  // with no adapter in the box does not.
  const uncertifiedAdapter: ProductSpec = {
    ...ASTRA_LAMP,
    id: 'adapter',
    power: { ...ASTRA_LAMP.power, includesAdapter: true, externalAdapterCertified: false },
  };
  assert.ok(requiredCertifications(uncertifiedAdapter).includes('ul_etl_mains'));
  const adapterless: ProductSpec = {
    ...ASTRA_LAMP,
    id: 'no-adapter',
    power: { ...ASTRA_LAMP.power, includesAdapter: false, externalAdapterCertified: false },
  };
  assert.ok(!requiredCertifications(adapterless).includes('ul_etl_mains'));
});

test('Mains inside the product and lithium cells are hard blocks', () => {
  const bad: ProductSpec = {
    ...ASTRA_LAMP,
    id: 'bad',
    power: { ...ASTRA_LAMP.power, mainsInside: true, battery: 'lithium' },
  };
  const gates = runGates(bad, checkDFM(bad));
  assert.equal(gates.results.find((g) => g.id === 'G4')!.passed, false);
});

test('The lamp reference declares five features with expected faces', () => {
  assert.equal(LAMP_REFERENCE_FEATURES.length, 5);
  assert.equal(LAMP_REFERENCE_FEATURES.find((f) => f.id === 'face')!.expectedFace, 'front');
  assert.equal(LAMP_REFERENCE_FEATURES.find((f) => f.id === 'usb')!.expectedFace, 'back');
});

// ---- Muse Gadgets targets --------------------------------------------------

test('The Muse reference design passes the platform gate and every other gate', () => {
  const report = evaluate(MUSE_DESK_COMPANION);
  const g11 = report.gates.results.find((g) => g.id === 'G11');
  assert.ok(g11, 'G11 gate exists');
  assert.equal(g11!.passed, true);
  assert.match(g11!.detail, /verified/);
  assert.equal(
    report.findings.filter((f) => f.ruleId.startsWith('TARGET_')).length,
    0,
    'no platform findings on a correct target',
  );
  assert.equal(report.gates.passed, true, 'the reference fixture passes all gates');
});

test('An unsupported board blocks the compatibility claim', () => {
  const spec: ProductSpec = structuredClone(MUSE_DESK_COMPANION);
  spec.target = { ...spec.target!, board: 'nodemcu-esp8266' };
  const report = evaluate(spec);
  const finding = report.findings.find((f) => f.ruleId === 'TARGET_BOARD_UNSUPPORTED');
  assert.ok(finding, 'unsupported board flagged');
  assert.equal(finding!.severity, 'block');
  assert.match(finding!.message, /nodemcu-esp8266/);
  assert.equal(report.gates.results.find((g) => g.id === 'G11')!.passed, false);
  assert.equal(report.gates.passed, false);
});

test('A toolchain that is not the pinned ESP-IDF is flagged', () => {
  const wrong: ProductSpec = structuredClone(MUSE_DESK_COMPANION);
  wrong.firmware = { ...wrong.firmware, toolchain: 'ESP-IDF v5.4, pinned' };
  const finding = checkDFM(wrong).find((f) => f.ruleId === 'TARGET_TOOLCHAIN_MISMATCH');
  assert.ok(finding, 'wrong version flagged');
  assert.equal(finding!.severity, 'warn');
  assert.match(finding!.message, /6\.0\.1/);

  const missing: ProductSpec = structuredClone(MUSE_DESK_COMPANION);
  missing.firmware = { ...missing.firmware, toolchain: undefined };
  assert.ok(
    checkDFM(missing).some((f) => f.ruleId === 'TARGET_TOOLCHAIN_MISMATCH'),
    'undeclared toolchain flagged',
  );
});

test('Capabilities are checked against the board matrix, not the wish list', () => {
  const spec: ProductSpec = structuredClone(MUSE_DESK_COMPANION);
  spec.target = { ...spec.target!, board: 'esp32-c5-devkitc-1', capabilities: ['images', 'camera'] };
  const caps = checkDFM(spec).filter((f) => f.ruleId === 'TARGET_CAPABILITY_UNSUPPORTED');
  assert.equal(caps.length, 2, 'both gaps flagged');
  assert.ok(caps.every((f) => f.severity === 'warn'));
  const images = caps.find((f) => f.subject === 'images')!;
  assert.match(images.message, /does not support "images"/);

  // The no-PSRAM explanation is for boards where that is the actual reason.
  const c6: ProductSpec = structuredClone(MUSE_DESK_COMPANION);
  c6.target = { ...c6.target!, board: 'waveshare-esp32-c6-touch-amoled-1.8', capabilities: ['images'] };
  const c6Images = checkDFM(c6).find((f) => f.ruleId === 'TARGET_CAPABILITY_UNSUPPORTED')!;
  assert.match(c6Images.message, /no PSRAM/);
});

test('Linux targets get the command surface, not a device UI', () => {
  const spec: ProductSpec = structuredClone(MUSE_DESK_COMPANION);
  spec.target = { platform: 'muse-gadgets', sdk: 'linux', board: 'raspberry-pi', capabilities: ['device_health', 'display'] };
  const findings = checkDFM(spec);
  const caps = findings.filter((f) => f.ruleId === 'TARGET_CAPABILITY_UNSUPPORTED');
  assert.equal(caps.length, 1, 'only the display gap');
  assert.match(caps[0].message, /no device UI/);
  assert.ok(!findings.some((f) => f.ruleId === 'TARGET_TOOLCHAIN_MISMATCH'), 'no ESP-IDF requirement on Linux');

  const bad: ProductSpec = structuredClone(spec);
  bad.target = { ...spec.target!, board: 'windows-pc' };
  assert.ok(checkDFM(bad).some((f) => f.ruleId === 'TARGET_BOARD_UNSUPPORTED'));
});

test('A board-only Muse gadget without firmware fails the firmware gate', () => {
  const spec: ProductSpec = structuredClone(MUSE_DESK_COMPANION);
  spec.firmware = { ...spec.firmware, provided: false };
  const report = evaluate(spec);
  assert.equal(report.gates.results.find((g) => g.id === 'G10')!.passed, false);
  assert.ok(report.findings.some((f) => f.ruleId === 'FIRMWARE_MISSING'));
});

test('The build kit carries the overlay, commands and guide for the board', () => {
  const scaffold = buildMuseScaffold(MUSE_DESK_COMPANION, { generatedAt: '2026-10-04T00:00:00.000Z' });
  assert.equal(scaffold.sdk, 'esp32');
  assert.equal(scaffold.board.id, 'waveshare-esp32-s3-touch-amoled-1.75');
  assert.ok(scaffold.files['README.md'].includes('ESP-IDF v6.0.1'));
  assert.ok(scaffold.files['README.md'].includes('MuseGadget'));
  assert.ok(scaffold.files['README.md'].includes('musecases.netlify.app'), 'community builds link present');
  assert.ok(scaffold.files['sdkconfig.muse-desk-companion'].includes('SDKCONFIG_DEFAULTS'));
  assert.ok(scaffold.files['setup.sh'].startsWith('#!/usr/bin/env sh'));
  const design = JSON.parse(scaffold.files['design.json']);
  assert.equal(design.target.board, 'waveshare-esp32-s3-touch-amoled-1.75');
  assert.equal(design.commands.build, scaffold.commands.build);
  assert.equal(design.generatedAt, '2026-10-04T00:00:00.000Z');

  // OTA asked on a board where it is off by default: the documented delta appears
  // and the build command appends this design's overlay to the board's chain.
  const c5: ProductSpec = structuredClone(MUSE_DESK_COMPANION);
  c5.target = { ...c5.target!, board: 'esp32-c5-devkitc-1', capabilities: ['tunnel', 'ota'] };
  const c5kit = buildMuseScaffold(c5);
  assert.match(c5kit.files['sdkconfig.muse-desk-companion'], /CONFIG_HOMEHUB_OTA_ENABLED=y/);
  assert.match(c5kit.commands.build, /muse-design\/sdkconfig\.muse-desk-companion/);

  // Camera on the Watcher: opt-in config, emitted only there.
  const watcher: ProductSpec = structuredClone(MUSE_DESK_COMPANION);
  watcher.target = { ...watcher.target!, board: 'sensecap-watcher', capabilities: ['camera'] };
  const wkit = buildMuseScaffold(watcher);
  assert.match(wkit.files['sdkconfig.muse-desk-companion'], /CONFIG_MUSE_WATCHER_CAMERA=y/);

  // A design with no target cannot have a kit.
  assert.throws(() => buildMuseScaffold(ASTRA_LAMP), /no Muse Gadgets target/i);
});

// ---- MCP transport ---------------------------------------------------------

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
    child.stderr.on('data', (d) => process.stderr.write(d.toString()));
    for (const line of lines) child.stdin.write(JSON.stringify(line) + '\n');
    child.stdin.end();
  });
}

test('MCP: initialize, tools/list and tools/call all work over stdio', async () => {
  const responses = await mcpCall([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'hardware_gates', arguments: { spec: ASTRA_LAMP } },
    },
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'hardware_failure_taxonomy', arguments: {} },
    },
    {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'hardware_muse_platform', arguments: { board: 'm5stack-cores3' } },
    },
    {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'hardware_muse_scaffold', arguments: { spec: MUSE_DESK_COMPANION } },
    },
  ]);

  const init = responses.find((r) => r.id === 1);
  assert.equal(init.result.serverInfo.name, 'hardware-harness');

  const list = responses.find((r) => r.id === 2);
  const names = list.result.tools.map((t: { name: string }) => t.name);
  assert.ok(names.includes('hardware_evaluate'));
  assert.ok(names.includes('hardware_landed_cost'));
  assert.ok(names.includes('hardware_muse_platform'));
  assert.ok(names.includes('hardware_muse_scaffold'));
  assert.ok(names.length >= 16, `expected 16+ tools, got ${names.length}`);

  const gates = responses.find((r) => r.id === 3);
  assert.equal(gates.result.isError, false);
  const parsed = JSON.parse(gates.result.content[0].text);
  assert.equal(parsed.passed, false, 'Astra design must fail gates through the MCP surface');

  const taxonomy = responses.find((r) => r.id === 4);
  const modes = JSON.parse(taxonomy.result.content[0].text);
  assert.ok(modes.length >= 15, 'failure taxonomy is populated');

  const platform = responses.find((r) => r.id === 5);
  const board = JSON.parse(platform.result.content[0].text);
  assert.equal(board.board.chip, 'esp32s3');
  assert.ok(board.board.capabilities.includes('push_to_talk'));
  assert.equal(board.sdk.espIdf, 'v6.0.1');

  const kit = responses.find((r) => r.id === 6);
  const scaffold = JSON.parse(kit.result.content[0].text);
  assert.ok(scaffold.files['README.md'].includes('ESP-IDF v6.0.1'));
  assert.equal(scaffold.board.id, 'waveshare-esp32-s3-touch-amoled-1.75');
});

test('Electronics with no nets are flagged: wiring is a guess', () => {
  const spec: ProductSpec = structuredClone(ASTRA_LAMP);
  delete spec.nets;
  const findings = checkDFM(spec);
  const noNets = findings.find((f) => f.ruleId === 'NO_NETS');
  assert.ok(noNets, 'NO_NETS raised when a spec has electronics and no nets');
  assert.equal(noNets!.severity, 'warn');
});

test('A net referencing a phantom part is a block', () => {
  const spec: ProductSpec = structuredClone(ASTRA_LAMP);
  spec.nets = [
    {
      id: 'n1',
      name: '3V3_RAIL',
      signal: 'power',
      voltage: 3.3,
      endpoints: [
        { part: 'base', pin: 'VCC' },
        { part: 'ghost-part', pin: '3V3' },
      ],
    },
  ];
  const findings = checkDFM(spec);
  const bad = findings.find((f) => f.ruleId === 'NET_UNKNOWN_PART');
  assert.ok(bad, 'NET_UNKNOWN_PART raised for the phantom endpoint');
  assert.equal(bad!.severity, 'block');
  assert.match(bad!.message, /ghost-part/);
});

test('Complete nets produce no net findings', () => {
  const spec: ProductSpec = structuredClone(ASTRA_LAMP);
  const partIds = new Set(spec.parts.map((p) => p.id));
  spec.nets = [
    {
      id: 'n1',
      name: '5V_RAIL',
      signal: 'power',
      voltage: 5,
      endpoints: [...partIds].slice(0, 2).map((id) => ({ part: id, pin: 'V+' })),
    },
  ];
  const findings = checkDFM(spec);
  assert.ok(!findings.some((f) => f.ruleId === 'NET_UNKNOWN_PART'), 'no phantom-part findings');
});
