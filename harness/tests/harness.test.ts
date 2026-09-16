import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ASTRA_LAMP, FABLE_LAMP, DJ_CONTROLLER } from '../src/fixtures/keil-runs.ts';
import { BLUEPRINT_VOICE_NOTE } from '../src/fixtures/blueprint-voice-note.ts';
import { VOICE_NOTE_FIXED } from '../src/fixtures/voice-note-fixed.ts';
import { LAMP_REFERENCE_FEATURES } from '../src/fixtures/lamp.ts';
import { evaluate, runGates } from '../src/engine/evaluate.ts';
import { checkDFM } from '../src/engine/dfm-check.ts';
import { landedCost } from '../src/engine/cost.ts';
import { recommendProcess, unitProcessCostUsd } from '../src/engine/process-select.ts';
import { PROCESSES } from '../src/knowledge/processes.ts';
import { CERTIFICATIONS } from '../src/knowledge/compliance.ts';
import { RULES } from '../src/knowledge/dfm.ts';
import { requiredCertifications } from '../src/engine/dfm-check.ts';
import { compareModels, costAt, evaluateModel } from '../src/engine/business.ts';
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

test('Counterfeit exposure is graded: an advisory does not fail the gate, a broker channel does', () => {
  // LCSC on an MCU is a real caution but not proof of a fake - it is reported as a
  // warning, and a warning must not fail a hard gate.
  const dj = evaluate(DJ_CONTROLLER);
  const advisory = dj.findings.find((f) => f.ruleId === 'COUNTERFEIT_RISK');
  assert.ok(advisory, 'LCSC MCU is flagged');
  assert.equal(advisory!.severity, 'warn');
  assert.equal(dj.gates.results.find((g) => g.id === 'G7')!.passed, true);

  // A marketplace/broker channel on the same part class is what the thread warned
  // about ("it nearly ordered me knockoffs"), and it fails the gate.
  const brokered: ProductSpec = {
    ...structuredClone(DJ_CONTROLLER),
    id: 'dj-brokered',
    parts: DJ_CONTROLLER.parts.map((p) =>
      p.id === 'mcu' && p.source ? { ...p, source: { ...p.source, distributor: 'broker' as const } } : p,
    ),
  };
  const report = evaluate(brokered);
  const blocking = report.findings.find((f) => f.ruleId === 'COUNTERFEIT_RISK')!;
  assert.equal(blocking.severity, 'block');
  assert.equal(report.gates.results.find((g) => g.id === 'G7')!.passed, false);
});

test('The reference rebuild sources cleanly: authorised ICs, LCSC passives', () => {
  const report = evaluate(VOICE_NOTE_FIXED);
  assert.ok(!report.findings.some((f) => f.ruleId === 'COUNTERFEIT_RISK'), 'no sourcing findings');
  assert.equal(report.gates.results.find((g) => g.id === 'G7')!.passed, true);
  assert.ok(!report.findings.some((f) => f.ruleId === 'ELECTRONICS_WITHOUT_PCB'), 'the board is in the BOM');
});

test('The reference rebuild declares its wiring; the generated designs do not', () => {
  // The net list and the nets-mode wiring diagram are only exercised when a spec
  // declares nets, and no model-generated fixture declares any - that absence is the
  // NO_NETS finding about them. The reference design is the one that shows the pattern.
  const reference = evaluate(VOICE_NOTE_FIXED);
  assert.ok((VOICE_NOTE_FIXED.nets ?? []).length > 0, 'the reference design declares nets');
  assert.ok(!reference.findings.some((f) => f.ruleId === 'NO_NETS'), 'no NO_NETS on the reference design');
  assert.ok(!reference.findings.some((f) => f.ruleId === 'NET_UNKNOWN_PART'), 'every endpoint is a real part');

  for (const generated of [ASTRA_LAMP, FABLE_LAMP, DJ_CONTROLLER, BLUEPRINT_VOICE_NOTE]) {
    assert.equal((generated.nets ?? []).length, 0, `${generated.id} declares no wiring, as generated`);
  }
  // An Astra with nets bolted on would erase a true finding, so the warning must stand.
  assert.ok(
    evaluate(ASTRA_LAMP).findings.some((f) => f.ruleId === 'NO_NETS'),
    'the generated lamp still reports NO_NETS',
  );
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
  ]);

  const init = responses.find((r) => r.id === 1);
  assert.equal(init.result.serverInfo.name, 'hardware-harness');

  const list = responses.find((r) => r.id === 2);
  const names = list.result.tools.map((t: { name: string }) => t.name);
  assert.ok(names.includes('hardware_evaluate'));
  assert.ok(names.includes('hardware_landed_cost'));
  assert.ok(names.length >= 12, `expected 12+ tools, got ${names.length}`);

  const gates = responses.find((r) => r.id === 3);
  assert.equal(gates.result.isError, false);
  const parsed = JSON.parse(gates.result.content[0].text);
  assert.equal(parsed.passed, false, 'Astra design must fail gates through the MCP surface');

  const taxonomy = responses.find((r) => r.id === 4);
  const modes = JSON.parse(taxonomy.result.content[0].text);
  assert.ok(modes.length >= 15, 'failure taxonomy is populated');
});

test('MCP: a malformed spec gets a readable error, not a crash', async () => {
  const responses = await mcpCall([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    // No power block: previously threw a TypeError from inside the DFM checks.
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'hardware_evaluate', arguments: { spec: { parts: [], features: [] } } } },
    // A process name that does not exist.
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'hardware_evaluate',
        arguments: {
          spec: {
            power: { mainsInside: false, wireless: 'none', battery: 'none', usbPowered: true },
            parts: [{ id: 'a', process: 'laser_beam', bboxMm: { x: 1, y: 1, z: 1 } }],
            features: [],
          },
        },
      },
    },
    // No spec at all.
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'hardware_landed_cost', arguments: {} } },
  ]);

  const noPower = responses.find((r) => r.id === 2);
  assert.equal(noPower.result.isError, true);
  assert.match(noPower.result.content[0].text, /mainsInside/);

  const badProcess = responses.find((r) => r.id === 3);
  assert.equal(badProcess.result.isError, true);
  assert.match(badProcess.result.content[0].text, /unknown process "laser_beam"/i);

  const noSpec = responses.find((r) => r.id === 4);
  assert.equal(noSpec.result.isError, true);
  assert.match(noSpec.result.content[0].text, /Missing "spec"/);
});

test('MCP: process data exposes the mould steel data rather than an undefined field', async () => {
  const responses = await mcpCall([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'hardware_process_data', arguments: {} } },
  ]);
  const data = JSON.parse(responses.find((r) => r.id === 2).result.content[0].text);
  assert.ok(Array.isArray(data.steelShotLife), 'steel shot life is real data');
  assert.ok(data.steelShotLife.length >= 5);
  assert.ok(data.steelShotLife[0].steel);
});

test('MCP: every tool the README advertises is registered and callable', async () => {
  const responses = await mcpCall([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ]);
  const names: string[] = responses.find((r) => r.id === 2).result.tools.map((t: { name: string }) => t.name);
  for (const tool of [
    'hardware_evaluate',
    'hardware_gates',
    'hardware_dfm_check',
    'hardware_landed_cost',
    'hardware_process_select',
    'hardware_certification',
    'hardware_sourcing_rules',
    'hardware_failure_taxonomy',
    'hardware_process_data',
    'hardware_rules',
    'hardware_fixture',
    'hardware_spec_schema',
    'hardware_business_model',
    'hardware_fulfilment',
    'hardware_part_lookup',
    'hardware_record_outcome',
    'hardware_calibration',
    'hardware_spec_diff',
  ]) {
    assert.ok(names.includes(tool), `${tool} is registered`);
  }
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

test('Every rule in the catalogue is wired into the engine', () => {
  // Five rules were once declared, documented and advertised while never being
  // emitted by any check. This test is what stops that happening again.
  const engineDir = path.join(repoRoot, 'src', 'engine');
  const source = readdirSync(engineDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => readFileSync(path.join(engineDir, f), 'utf8'))
    .join('\n');

  const missing = Object.keys(RULES).filter((id) => !source.includes(`'${id}'`));
  assert.deepEqual(missing, [], `rules documented but never raised: ${missing.join(', ')}`);

  const emitted = new Set<string>();
  for (const match of source.matchAll(/push\(\s*'([A-Z_]+)'/g)) emitted.add(match[1]!);
  for (const match of source.matchAll(/ruleId:\s*'([A-Z_]+)'/g)) emitted.add(match[1]!);
  const unreachable = Object.keys(RULES).filter((id) => !emitted.has(id) && id !== 'TOOLING_AMORTIZATION');
  assert.deepEqual(unreachable, [], `rules with no emitting call site: ${unreachable.join(', ')}`);
});

test('Every certification in the catalogue can be triggered by some input', () => {
  const base: ProductSpec = structuredClone(ASTRA_LAMP);
  const triggered = new Set<string>();
  const cases: ProductSpec[] = [
    base,
    { ...base, power: { ...base.power, wireless: 'bluetooth' } },
    { ...base, power: { ...base.power, wireless: 'bluetooth', radioModulePrecertified: true } },
    { ...base, power: { ...base.power, wireless: 'custom' } },
    { ...base, power: { ...base.power, mainsInside: true } },
    { ...base, power: { ...base.power, battery: 'lithium' } },
    { ...base, power: { ...base.power, usbPowered: true, includesAdapter: true, externalAdapterCertified: false } },
    { ...base, markets: ['eu'] },
    { ...base, markets: ['eu'], power: { ...base.power, battery: 'lithium' } },
    { ...base, audience: 'children' },
  ];
  for (const spec of cases) for (const id of requiredCertifications(spec)) triggered.add(id);

  const unreachable = CERTIFICATIONS.map((c) => c.id).filter((id) => !triggered.has(id));
  assert.deepEqual(unreachable, [], `certifications no input can trigger: ${unreachable.join(', ')}`);
});

// ---- CLI output regressions --------------------------------------------------

/** Run the CLI and capture stdout through a pipe, which is how an agent consumes it. */
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
    child.stderr.on('data', () => {});
  });
}

test('CLI --json survives a pipe: no truncation at the 64 KiB write boundary', async () => {
  // console.log to a pipe is asynchronous. With a trailing process.exit(0) the output
  // was cut at exactly 65536 bytes, so `--json | jq` got invalid JSON while a file
  // redirect worked. The report is larger than that boundary on purpose.
  const { stdout, code } = await runCli(['--json']);
  assert.equal(code, 0);
  assert.ok(stdout.length > 65_536, `payload must exceed the pipe boundary, got ${stdout.length}`);
  const reports = JSON.parse(stdout) as Array<{ spec: { id: string } }>;
  assert.equal(reports.length, 5, 'all five fixtures present in the piped output');
});

test('CLI prints exactly one report per invocation', async () => {
  const cases: Array<[string[], string]> = [
    [['--json'], '['],
    [['--business'], '# Business model comparison'],
    [['--taxonomy'], '# Failure taxonomy'],
    [['--fulfilment'], '# Fulfilment'],
    [['--full', 'lamp-astra'], '# Cube lamp'],
    [['--parts', 'ESP32'], '# Parts matching'],
    [['--diff', 'lamp-astra', 'lamp-fable'], '# Diff:'],
    [[], '# Hardware Harness'],
  ];
  for (const [args, firstLine] of cases) {
    const { stdout } = await runCli(args);
    const first = stdout.split('\n')[0] ?? '';
    assert.ok(first.startsWith(firstLine), `${args.join(' ') || '(default)'} starts with "${firstLine}", got "${first}"`);
    // A mode that falls through prints the default table after its own report.
    const defaultReports = stdout.split('# Hardware Harness - first live run, re-scored').length - 1;
    assert.ok(defaultReports <= 1, `${args.join(' ')} printed the default report ${defaultReports} times`);
    if (args[0] !== undefined) assert.equal(defaultReports, 0, `${args.join(' ')} must not print the default report`);
  }
});

// ---- cost engine regressions -------------------------------------------------

test('A per-order process minimum is charged once per order, not once per unit', () => {
  // A tiny part priced well below the FDM floor. The floor is a per-order minimum, so
  // at volume it is nearly free per unit - charging it to every unit added dollars.
  const tiny: ProductSpec = {
    ...structuredClone(ASTRA_LAMP),
    id: 'tiny-part',
    targetQuantities: [1, 1000],
    parts: [
      {
        id: 'spacer',
        label: 'Small spacer',
        kind: 'custom',
        process: 'fdm',
        material: 'petg',
        qty: 1,
        bboxMm: { x: 10, y: 10, z: 2 },
        solidFraction: 0.5,
      },
    ],
    interfaces: [],
    operations: [{ id: 'op', label: 'Print', minutes: 1, improvised: false }],
  };
  const report = landedCost(tiny);
  const q1 = report.quantities.find((q) => q.quantity === 1)!;
  const q1000 = report.quantities.find((q) => q.quantity === 1000)!;

  // At qty 1 the $5 minimum dominates the part.
  const parts1 = q1.breakdown.find((l) => l.label.startsWith('Parts'))!;
  assert.ok(parts1.usd >= 5 && parts1.usd < 6, `qty 1 parts ${parts1.usd} should be the $5 order minimum`);
  // At qty 1000 the whole order is worth far more than the minimum, so it must not appear.
  const parts1000 = q1000.breakdown.find((l) => l.label.startsWith('Parts'))!;
  assert.ok(parts1000.usd < 0.5, `qty 1000 parts ${parts1000.usd} must not carry the order minimum`);
});

test('Certification is booked at the midpoint of the published range, and reported as a range', () => {
  const report = landedCost(ASTRA_LAMP);
  // FCC Part 15 unintentional radiator is published at $3,000-$5,000.
  assert.deepEqual(
    { low: report.certification.lowUsd, high: report.certification.highUsd, estimate: report.certification.estimateUsd },
    { low: 3000, high: 5000, estimate: 4000 },
  );
  const at100 = report.quantities.find((q) => q.quantity === 100)!;
  assert.equal(at100.complianceAmortizedUsd, 40, 'the midpoint, not the cheapest bound, is amortised');
});

test('Certifications with no published price are flagged rather than silently dropped', () => {
  const spec: ProductSpec = {
    ...structuredClone(ASTRA_LAMP),
    id: 'mains-budgeted',
    power: { ...ASTRA_LAMP.power, mainsInside: true },
    certificationsBudgeted: ['ul_etl_mains'],
  };
  const report = landedCost(spec);
  assert.ok(
    report.hiddenLinesFlagged.some((l) => /UL \/ ETL/.test(l)),
    `unpriced certification surfaced: ${report.hiddenLinesFlagged.join(' | ')}`,
  );
});

test('Freight mass uses real material density, not a volume proxy', () => {
  const asPlastic: ProductSpec = structuredClone(ASTRA_LAMP);
  const asAluminium: ProductSpec = structuredClone(ASTRA_LAMP);
  for (const p of asPlastic.parts) p.material = 'petg';
  for (const p of asAluminium.parts) p.material = 'alu6061';
  const plastic = landedCost(asPlastic).quantities[0]!;
  const metal = landedCost(asAluminium).quantities[0]!;
  const airPlastic = plastic.breakdown.find((l) => l.label === 'Air freight')!;
  const airMetal = metal.breakdown.find((l) => l.label === 'Air freight')!;
  assert.ok(airMetal.usd > airPlastic.usd * 2, 'aluminium must not be freighted as if it were plastic');
});

// ---- business engine regressions ---------------------------------------------

test('Costing a quantity between the spec targets returns a figure instead of crashing', () => {
  // The spec is costed at 1/100/1000. A caller asking for 250 previously hit a
  // non-null assertion on a failed lookup and threw.
  assert.equal(costAt(ASTRA_LAMP, 250), costAt(ASTRA_LAMP, 100), '250 falls back to the nearest costed quantity');
  assert.equal(costAt(ASTRA_LAMP, 900), costAt(ASTRA_LAMP, 1000), '900 falls back upward');
  const outcome = evaluateModel({
    id: 'x',
    label: 'X',
    description: '',
    unitPriceUsd: 100,
    spec: ASTRA_LAMP,
    costAtQuantity: 250,
    monthlyVolume: 10,
    fixedMonthlyCostUsd: 0,
  });
  assert.ok(outcome.unitCostUsd > 0);
});

test('Every business model produces a number, including the rebuilt-electronics row', () => {
  const models = compareModels({ lamp: ASTRA_LAMP, voiceNote: BLUEPRINT_VOICE_NOTE, voiceNoteFixed: VOICE_NOTE_FIXED });
  assert.equal(models.length, 6);
  const rebuilt = models.find((m) => m.id === 'rebuilt-electronics')!;
  const original = models.find((m) => m.id === 'consumer-electronics')!;
  assert.ok(rebuilt, 'the rebuild is modelled rather than described in prose');
  assert.ok(rebuilt.labourMinutesPerUnit < original.labourMinutesPerUnit, 'the rebuild designs the labour out');
  for (const m of models) {
    assert.ok(Number.isFinite(m.grossProfitPerLabourHourUsd), `${m.id} per-hour figure is finite`);
    assert.ok(Number.isFinite(m.monthly.grossProfitUsd), `${m.id} monthly profit is finite`);
  }
});

test('Profit per labour hour is on the same base as monthly profit', () => {
  const outcome = evaluateModel({
    id: 'base-check',
    label: 'Base check',
    description: '',
    unitPriceUsd: 100,
    unitCostOverrideUsd: 40,
    labourMinutesOverride: 60,
    monthlyVolume: 10,
    fixedMonthlyCostUsd: 100,
  });
  // 10 units x $60 gross = $600, less $100 fixed = $500, over 10 labour hours.
  assert.equal(outcome.monthly.grossProfitUsd, 500);
  assert.equal(outcome.grossProfitPerLabourHourUsd, 50);
});

// ---- fixtures that carry the argument ----------------------------------------

test('The generated voice note-taker is caught for firmware, board and sourcing', () => {
  const report = evaluate(BLUEPRINT_VOICE_NOTE);
  const rules = report.findings.map((f) => f.ruleId);
  assert.ok(rules.includes('FIRMWARE_MISSING'), 'no firmware shipped');
  assert.ok(rules.includes('ELECTRONICS_WITHOUT_PCB'), 'no board in the BOM');
  assert.ok(rules.includes('MISSING_POWER_SOURCE'), 'a charger with no cell specified');
  assert.ok(rules.includes('COUNTERFEIT_RISK'), 'marketplace sourcing on MCU-class parts');
  assert.equal(report.gates.results.find((g) => g.id === 'G10')!.passed, false);
  assert.ok(report.findings.some((f) => f.ruleId === 'NO_NETS'), 'wiring declared nowhere');
});

test('Gate order reads G1 through G10', () => {
  const ids = evaluate(ASTRA_LAMP).gates.results.map((g) => g.id);
  assert.deepEqual(ids, ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10']);
});

test('Tooling that outweighs the unit cost is raised as a finding', () => {
  const spec: ProductSpec = {
    ...structuredClone(ASTRA_LAMP),
    id: 'tooled-too-early',
    targetQuantities: [1, 100],
    parts: [
      {
        id: 'shell',
        label: 'Moulded shell',
        kind: 'custom',
        process: 'injection_molding',
        material: 'abs',
        qty: 1,
        bboxMm: { x: 90, y: 90, z: 40 },
        solidFraction: 0.2,
        wallMm: 2,
        draftDeg: 2,
        toleranceMm: 0.2,
      },
    ],
    interfaces: [],
    operations: [{ id: 'op', label: 'Assemble', minutes: 2, improvised: false }],
  };
  const report = evaluate(spec);
  const finding = report.findings.find((f) => f.ruleId === 'TOOLING_AMORTIZATION');
  assert.ok(finding, 'tooling share finding raised');
  assert.match(finding!.message, /Tooling is \d+(\.\d+)?% of the unit cost/);
  assert.ok(report.cost.quantities.some((q) => q.toolingSharePct > 20));
});

test('A warm device with no programmable part needs no firmware', () => {
  const spec: ProductSpec = structuredClone(FABLE_LAMP);
  // Drop the touch controller and the firmware: an LED and a USB socket are not software.
  spec.parts = spec.parts.filter((p) => p.source?.partType !== 'mcu');
  delete spec.firmware;
  const report = evaluate(spec);
  assert.ok(!report.findings.some((f) => f.ruleId === 'FIRMWARE_MISSING'), 'no firmware demanded');
  const gate = report.gates.results.find((g) => g.id === 'G10')!;
  assert.equal(gate.passed, true);
  assert.match(gate.detail, /no programmable part/i);
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
