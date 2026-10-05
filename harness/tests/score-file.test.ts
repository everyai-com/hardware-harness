import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { normalizeSpec, loadSpecFile, starterSpecText } from '../src/score-file.ts';
import { evaluate } from '../src/engine/evaluate.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const examplePath = path.resolve(here, '..', 'examples', 'minimal-spec.json');

function minimal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Test widget',
    intent: 'A widget for testing.',
    parts: [
      {
        id: 'case',
        label: 'Case',
        process: 'fdm',
        material: 'PETG',
        qty: 1,
        bboxMm: { x: 50, y: 50, z: 20 },
        wallMm: 1.6,
        toleranceMm: 0.5,
      },
    ],
    operations: [{ id: 'assemble', label: 'Snap it together', minutes: 5, improvised: false }],
    ...overrides,
  };
}

function okSpec(input: unknown) {
  const r = normalizeSpec(input);
  assert.equal(r.ok, true, `expected valid spec, got: ${r.ok ? '' : JSON.stringify(r.issues)}`);
  return r.spec;
}

function badPaths(input: unknown): string[] {
  const r = normalizeSpec(input);
  assert.equal(r.ok, false, 'expected validation to fail');
  return r.issues.map((i) => i.path);
}

test('The shipped starter spec validates and scores', () => {
  return loadSpecFile(examplePath).then((r) => {
    assert.equal(r.ok, true, `starter spec must validate: ${r.ok ? '' : JSON.stringify(r.issues)}`);
    const report = evaluate(r.spec);
    assert.equal(report.gates.results.length, 11, 'all gates run on a user spec');
    assert.ok(report.score.total >= 0 && report.score.total <= 5, 'score in range');
    assert.equal(report.spec.name, 'Tiny 3-key macro keypad');
  });
});

test('score --init prints the same starter spec that validates', () => {
  return starterSpecText().then((text) => {
    const r = normalizeSpec(JSON.parse(text));
    assert.equal(r.ok, true, 'starter text must validate');
  });
});

test('Bare-minimum spec gets the same defaults as the web API', () => {
  const spec = okSpec(minimal());
  assert.equal(spec.id, 'test-widget', 'id is slugged from the name');
  assert.deepEqual(spec.targetQuantities, [1, 100, 1000]);
  assert.equal(spec.origin, 'china');
  assert.deepEqual(spec.power, {
    mainsInside: false,
    wireless: 'none',
    battery: 'none',
    usbPowered: false,
    externalAdapterCertified: undefined,
    includesAdapter: undefined,
    maxWatts: undefined,
  });
  assert.deepEqual(spec.features, []);
  assert.deepEqual(spec.interfaces, []);
  assert.equal(spec.parts[0].kind, 'custom');
});

test('Enums are case-insensitive, numbers arrive as strings', () => {
  const spec = okSpec(
    minimal({
      origin: 'Domestic',
      parts: [
        {
          id: 'case',
          label: 'Case',
          kind: 'CUSTOM',
          process: 'FDM',
          material: 'PETG',
          qty: '2',
          bboxMm: { x: '50', y: 50, z: 20 },
          wallMm: '1.6',
          toleranceMm: 0.5,
        },
      ],
      operations: [{ id: 'assemble', label: 'Snap it together', minutes: '5', improvised: false }],
    }),
  );
  assert.equal(spec.origin, 'domestic');
  assert.equal(spec.parts[0].process, 'fdm');
  assert.equal(spec.parts[0].qty, 2);
  assert.equal(spec.operations[0].minutes, 5);
});

test('Missing required fields come back as pathed issues, all at once', () => {
  const paths = badPaths({ name: 'x' });
  assert.ok(paths.includes('intent'), 'intent flagged');
  assert.ok(paths.includes('parts'), 'parts flagged');
  assert.ok(paths.includes('operations'), 'operations flagged');
});

test('Unknown enum values name the allowed set', () => {
  const r = normalizeSpec(minimal({ origin: 'atlantis' }));
  assert.equal(r.ok, false);
  assert.equal(r.issues[0].path, 'origin');
  assert.match(r.issues[0].message, /china, domestic, other/);
});

test('Part problems carry the part index', () => {
  const paths = badPaths(
    minimal({
      parts: [{ id: 'case', label: 'Case', process: 'fdm', material: 'PETG', qty: 0, bboxMm: { x: 1, y: 1, z: 1 } }],
    }),
  );
  assert.ok(paths.includes('parts[0].qty'), `qty flagged, got: ${paths.join(', ')}`);
});

test('A net with one endpoint is rejected before scoring', () => {
  const paths = badPaths(
    minimal({ nets: [{ id: 'n', name: 'N', endpoints: [{ part: 'case' }] }] }),
  );
  assert.ok(paths.includes('nets[0].endpoints'), `endpoints flagged, got: ${paths.join(', ')}`);
});

test('A 0V ground net validates; a negative rail does not', () => {
  const gnd = okSpec(
    minimal({
      nets: [{ id: 'gnd', name: 'GND', signal: 'gnd', voltage: 0, endpoints: [{ part: 'case' }, { part: 'case' }] }],
    }),
  );
  assert.equal(gnd.nets?.[0].voltage, 0);
  const paths = badPaths(
    minimal({
      nets: [{ id: 'n', name: 'N', voltage: -5, endpoints: [{ part: 'case' }, { part: 'case' }] }],
    }),
  );
  assert.ok(paths.includes('nets[0].voltage'), `negative voltage flagged, got: ${paths.join(', ')}`);
});

test('A non-object spec and a missing file fail cleanly', () => {
  assert.deepEqual(badPaths([1, 2, 3]), ['']);
  return loadSpecFile(path.resolve(here, 'does-not-exist.json')).then((r) => {
    assert.equal(r.ok, false);
    assert.equal(r.issues[0].path, '<file>');
    assert.match(r.issues[0].message, /score --init/);
  });
});

test('Malformed JSON fails with the file named', () => {
  return import('node:fs/promises').then(async (fs) => {
    const tmp = path.resolve(here, 'tmp-malformed.json');
    await fs.writeFile(tmp, '{"name": oops');
    try {
      const r = await loadSpecFile(tmp);
      assert.equal(r.ok, false);
      assert.equal(r.issues[0].path, '<json>');
    } finally {
      await fs.unlink(tmp);
    }
  });
});
