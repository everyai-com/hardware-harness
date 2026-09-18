import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ASTRA_LAMP, FABLE_LAMP, DJ_CONTROLLER } from '../src/fixtures/keil-runs.ts';
import { LAMP_REFERENCE_FEATURES } from '../src/fixtures/lamp.ts';
import { evaluate, runGates } from '../src/engine/evaluate.ts';
import { checkDFM, dropScreening } from '../src/engine/dfm-check.ts';
import { landedCost } from '../src/engine/cost.ts';
import { recommendProcess, unitProcessCostUsd } from '../src/engine/process-select.ts';
import { PROCESSES } from '../src/knowledge/processes.ts';
import { requiredCertifications } from '../src/engine/dfm-check.ts';
import { resolveQuotes } from '../src/quotes/lcsc.ts';
import { parseStl } from '../src/geometry/stl.ts';
import { partVolumeCm3 } from '../src/engine/types.ts';
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

function dropSpec(material: string, mitigation?: string[]): ProductSpec {
  return {
    id: 'drop-test',
    name: 'Drop test shell',
    intent: 'A cube with one large printed or moulded shell.',
    targetQuantities: [1],
    origin: 'china',
    power: { mainsInside: false, wireless: 'none', battery: 'none', usbPowered: false },
    features: [],
    interfaces: [],
    operations: [{ id: 'assemble', label: 'Assemble', minutes: 2, improvised: false }],
    dropTest: { heightM: 1, orientations: 3, mitigation },
    parts: [
      {
        id: 'shell',
        label: 'Shell',
        kind: 'custom',
        process: 'resin_sla',
        material,
        qty: 1,
        bboxMm: { x: 120, y: 120, z: 120 },
        solidFraction: 0.3,
        wallMm: 2,
      },
    ],
  };
}

test('Drop screening computes mass from geometry, and flags a brittle shell', () => {
  const screen = dropScreening(dropSpec('resin_std'));
  assert.ok(screen, 'the screen runs when a drop requirement is declared');
  // 120mm cube at 0.3 solid fraction = 518 cm3; x 1.12 g/cm3 = ~0.58 kg.
  assert.ok(screen!.massKg > 0.5 && screen!.massKg < 0.7, `mass from bbox and density (${screen!.massKg.toFixed(2)}kg)`);
  assert.ok(screen!.energyJ > screen!.thresholdJ, 'drop energy exceeds the brittle-resin threshold');
  const finding = checkDFM(dropSpec('resin_std')).find((f) => f.ruleId === 'DROP_TEST_AT_RISK');
  assert.ok(finding, 'DROP_TEST_AT_RISK raised');
  assert.equal(finding!.severity, 'warn');
});

test('A tougher shell with compliant feet clears the same drop', () => {
  const screen = dropScreening(dropSpec('pc', ['rubber_feet']))!;
  assert.ok(screen.energyJ <= screen.thresholdJ, 'mitigation and a tougher material clear the screen');
  assert.ok(
    !checkDFM(dropSpec('pc', ['rubber_feet'])).some((f) => f.ruleId === 'DROP_TEST_AT_RISK'),
    'no drop finding once it clears',
  );
});

test('No declared drop requirement means no drop finding', () => {
  const spec = structuredClone(ASTRA_LAMP);
  delete spec.dropTest;
  assert.equal(dropScreening(spec), null, 'screening is skipped without a requirement');
  assert.ok(!checkDFM(spec).some((f) => f.ruleId === 'DROP_TEST_AT_RISK'), 'nothing raised');
});

test('Live quotes re-price every catalog part that has an MPN', async () => {
  const spec: ProductSpec = structuredClone(ASTRA_LAMP);
  const withMpn = spec.parts.filter((p) => p.source?.mpn);
  assert.ok(withMpn.length > 0, 'the fixture carries MPNs');
  const before = withMpn.map((p) => p.purchasePriceUsd);

  const calls: string[] = [];
  const { spec: priced, applied, missed } = await resolveQuotes(spec, {
    fetchQuote: async (mpn) => {
      calls.push(mpn);
      return { source: 'lcsc' as const, mpn, priceUsd: 3.5 };
    },
  });

  assert.equal(calls.length, withMpn.length, 'one lookup per MPN-bearing part');
  assert.equal(applied.length, withMpn.length);
  assert.equal(missed.length, 0);
  for (const part of priced.parts) {
    if (part.source?.mpn) assert.equal(part.purchasePriceUsd, 3.5, `${part.id} re-priced`);
  }
  assert.deepEqual(
    spec.parts.filter((p) => p.source?.mpn).map((p) => p.purchasePriceUsd),
    before,
    'the input spec is not mutated',
  );
});

test('A failed quote leaves the harness estimate in place', async () => {
  const spec: ProductSpec = structuredClone(ASTRA_LAMP);
  const { spec: priced, applied, missed } = await resolveQuotes(spec, { fetchQuote: async () => null });
  assert.equal(applied.length, 0, 'nothing re-priced');
  assert.ok(missed.length > 0, 'misses are reported rather than silently dropped');
  assert.deepEqual(
    priced.parts.map((p) => p.purchasePriceUsd),
    spec.parts.map((p) => p.purchasePriceUsd),
    'the estimate is untouched',
  );
});

type V = { x: number; y: number; z: number };

/** The 12 triangles of a closed cube, wound outward. */
function cubeTriangles(size: number): Array<[V, V, V]> {
  const v = (x: number, y: number, z: number): V => ({ x: x * size, y: y * size, z: z * size });
  const a = v(0, 0, 0);
  const b = v(1, 0, 0);
  const c = v(1, 1, 0);
  const d = v(0, 1, 0);
  const e = v(0, 0, 1);
  const f = v(1, 0, 1);
  const g = v(1, 1, 1);
  const h = v(0, 1, 1);
  return [
    [a, d, c],
    [a, c, b], // bottom
    [e, f, g],
    [e, g, h], // top
    [a, b, f],
    [a, f, e], // front
    [d, h, g],
    [d, g, c], // back
    [a, e, h],
    [a, h, d], // left
    [b, c, g],
    [b, g, f], // right
  ];
}

function encodeBinaryStl(triangles: Array<[V, V, V]>): Uint8Array {
  const buffer = new ArrayBuffer(84 + 50 * triangles.length);
  const view = new DataView(buffer);
  view.setUint32(80, triangles.length, true);
  triangles.forEach((tri, i) => {
    const base = 84 + i * 50 + 12;
    tri.forEach((vertex, k) => {
      view.setFloat32(base + k * 12, vertex.x, true);
      view.setFloat32(base + k * 12 + 4, vertex.y, true);
      view.setFloat32(base + k * 12 + 8, vertex.z, true);
    });
  });
  return new Uint8Array(buffer);
}

test('STL ingestion measures a closed cube instead of trusting the declaration', () => {
  const geometry = parseStl(encodeBinaryStl(cubeTriangles(20)));
  assert.equal(geometry.format, 'binary');
  assert.equal(geometry.triangles, 12);
  assert.equal(geometry.watertight, true);
  assert.equal(Math.round(geometry.bboxMm.x), 20);
  assert.equal(Math.round(geometry.bboxMm.y), 20);
  assert.equal(Math.round(geometry.bboxMm.z), 20);
  assert.ok(Math.abs(geometry.volumeMm3 - 8000) < 1, `volume measured at ${geometry.volumeMm3}`);
  assert.ok(Math.abs(geometry.surfaceAreaMm2 - 2400) < 1, `area measured at ${geometry.surfaceAreaMm2}`);
});

test('An open mesh is caught as not watertight', () => {
  const geometry = parseStl(encodeBinaryStl(cubeTriangles(10).slice(0, 11)));
  assert.equal(geometry.watertight, false);
  assert.equal(geometry.triangles, 11);
});

test('ASCII STL parses too', () => {
  const ascii =
    'solid cube\n' +
    cubeTriangles(5)
      .map(
        ([p, q, r]) =>
          `facet normal 0 0 0\nouter loop\nvertex ${p.x} ${p.y} ${p.z}\nvertex ${q.x} ${q.y} ${q.z}\nvertex ${r.x} ${r.y} ${r.z}\nendloop\nendfacet`,
      )
      .join('\n') +
    '\nendsolid cube\n';

  const geometry = parseStl(new TextEncoder().encode(ascii));
  assert.equal(geometry.format, 'ascii');
  assert.equal(geometry.triangles, 12);
  assert.equal(geometry.watertight, true);
  assert.ok(Math.abs(geometry.volumeMm3 - 125) < 0.5, `volume measured at ${geometry.volumeMm3}`);
});

test('Measured geometry drives volume, and drift from the spec is flagged', () => {
  const spec: ProductSpec = structuredClone(ASTRA_LAMP);
  const part = spec.parts.find((p) => p.kind === 'custom');
  assert.ok(part, 'the fixture has a custom part');
  part!.bboxMm = { x: 100, y: 100, z: 100 };
  part!.solidFraction = 0.25;
  part!.measured = {
    source: 'stl',
    bboxMm: { x: 140, y: 140, z: 140 },
    volumeMm3: 12_000,
    watertight: true,
    triangles: 12,
  };

  const rules = checkDFM(spec).map((f) => f.ruleId);
  assert.ok(rules.includes('GEOMETRY_MISMATCH'), 'declared vs measured bbox drift is flagged');
  assert.ok(!rules.includes('GEOMETRY_NOT_WATERTIGHT'), 'a closed mesh is not flagged');
  // 12000 mm3, from the mesh - not 100x100x100 x 0.25 = 250 cm3 from the declaration.
  assert.equal(partVolumeCm3(part!), 12);
});

test('A non-watertight mesh is a block', () => {
  const spec: ProductSpec = structuredClone(ASTRA_LAMP);
  const part = spec.parts.find((p) => p.kind === 'custom');
  assert.ok(part, 'the fixture has a custom part');
  part!.measured = {
    source: 'stl',
    bboxMm: { ...part!.bboxMm },
    volumeMm3: 5000,
    watertight: false,
    triangles: 11,
  };

  const finding = checkDFM(spec).find((f) => f.ruleId === 'GEOMETRY_NOT_WATERTIGHT');
  assert.ok(finding, 'GEOMETRY_NOT_WATERTIGHT raised for an open mesh');
  assert.equal(finding!.severity, 'block');
});
