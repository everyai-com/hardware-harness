/**
 * Hardening tests: untrusted spec fields must never reach a shell or a file
 * path, prototype keys must not resolve as table entries, and the MCP server
 * must answer every request it reads before it exits.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildMuseScaffold } from '../src/engine/muse-scaffold.ts';
import { MUSE_DESK_COMPANION } from '../src/fixtures/muse-desk-companion.ts';
import { normalizeSpec } from '../src/score-file.ts';
import { evaluate } from '../src/engine/evaluate.ts';
import { museBoard } from '../src/knowledge/platforms.ts';
import { PROCESSES } from '../src/knowledge/processes.ts';
import { MATERIALS } from '../src/knowledge/dfm.ts';
import type { ProductSpec } from '../src/engine/types.ts';

const repoRoot = join(import.meta.dirname, '..');

const HOSTILE_IDS = [
  'x"; touch PWNED; echo "',
  '$(touch PWNED)',
  '`touch PWNED`',
  '../../../../tmp/evil',
  'a\nCONFIG_EVIL=y',
];

function hostile(id: string, extra: Partial<ProductSpec> = {}): ProductSpec {
  return {
    ...MUSE_DESK_COMPANION,
    id,
    target: { ...MUSE_DESK_COMPANION.target!, capabilities: ['ota', 'camera'] },
    ...extra,
  };
}

// ---- Muse kit: no shell or path injection -----------------------------------

for (const id of HOSTILE_IDS) {
  test(`Muse kit: hostile spec.id ${JSON.stringify(id)} stays out of file names and the shell`, () => {
    const kit = buildMuseScaffold(hostile(id), { generatedAt: '2026-01-01T00:00:00Z' });
    for (const name of Object.keys(kit.files)) {
      assert.match(name, /^[A-Za-z0-9._-]+$/, `unsafe kit file name: ${JSON.stringify(name)}`);
    }

    // Run the generated setup.sh against a pre-made SDK dir (so it never clones)
    // and check the injected command never ran.
    const dir = mkdtempSync(join(tmpdir(), 'muse-kit-'));
    try {
      for (const [name, content] of Object.entries(kit.files)) writeFileSync(join(dir, name), content);
      mkdirSync(join(dir, 'sdk', 'esp32', 'devices'), { recursive: true });
      const run = spawnSync('sh', ['setup.sh', 'sdk'], { cwd: dir, encoding: 'utf8' });
      assert.equal(existsSync(join(dir, 'PWNED')), false, 'setup.sh executed an injected command');
      assert.equal(run.status, 0, `setup.sh failed: ${run.stderr}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('Muse kit: a newline in the design name cannot add config lines to the overlay', () => {
  const kit = buildMuseScaffold(hostile('desk', { name: 'Desk\nCONFIG_EVIL=y' }), {
    generatedAt: '2026-01-01T00:00:00Z',
  });
  const overlay = Object.entries(kit.files).find(([n]) => n.startsWith('sdkconfig.'))![1];
  assert.equal(/^CONFIG_EVIL/m.test(overlay), false);
});

test('Muse kit: the stock fixture setup.sh still runs cleanly', () => {
  const kit = buildMuseScaffold(MUSE_DESK_COMPANION, { generatedAt: '2026-01-01T00:00:00Z' });
  const dir = mkdtempSync(join(tmpdir(), 'muse-kit-'));
  try {
    for (const [name, content] of Object.entries(kit.files)) writeFileSync(join(dir, name), content);
    mkdirSync(join(dir, 'sdk', 'esp32', 'devices'), { recursive: true });
    const run = spawnSync('sh', ['setup.sh', 'sdk'], { cwd: dir, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /Build: {2}/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- Lookup tables: prototype keys are not entries ----------------------------

test('Lookup tables do not resolve prototype keys', () => {
  for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.equal(museBoard(key), undefined, `museBoard(${key})`);
    assert.equal(key in PROCESSES, false, `PROCESSES has ${key}`);
    assert.equal(key in MATERIALS, false, `MATERIALS has ${key}`);
  }
});

test('A part whose material is a prototype key scores instead of crashing', () => {
  const raw = JSON.parse(JSON.stringify(MUSE_DESK_COMPANION));
  raw.parts[0] = { ...raw.parts[0], kind: 'custom', process: 'cnc_3axis', material: 'constructor' };
  delete raw.parts[0].purchasePriceUsd;
  const result = normalizeSpec(raw);
  assert.ok(result.ok, JSON.stringify(!result.ok && result.issues));
  assert.doesNotThrow(() => evaluate(result.spec));
});

test('A part whose process is a prototype key is rejected by validation', () => {
  const raw = JSON.parse(JSON.stringify(MUSE_DESK_COMPANION));
  raw.parts[0] = { ...raw.parts[0], process: 'constructor' };
  const result = normalizeSpec(raw);
  assert.equal(result.ok, false);
});

// ---- MCP transport: every request answered, correct error codes -------------

function mcpRaw(payload: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['src/mcp/server.ts'], { cwd: repoRoot });
    let out = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('MCP server timed out'));
    }, 15000);
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('close', () => {
      clearTimeout(timeout);
      try {
        resolve(out.split('\n').filter(Boolean).map((l) => JSON.parse(l)));
      } catch (err) {
        reject(err);
      }
    });
    child.stdin.end(payload);
  });
}

test('MCP: answers every large request even when stdin closes immediately', async () => {
  const n = 20;
  const lines = Array.from({ length: n }, (_, i) =>
    JSON.stringify({ jsonrpc: '2.0', id: i + 1, method: 'tools/call', params: { name: 'hardware_rules', arguments: {} } }),
  );
  const responses = await mcpRaw(lines.join('\n') + '\n');
  assert.equal(responses.length, n);
  assert.deepEqual(
    responses.map((r) => r.id).sort((a, b) => a - b),
    Array.from({ length: n }, (_, i) => i + 1),
  );
});

test('MCP: a final request without a trailing newline is still answered', async () => {
  const responses = await mcpRaw(JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'ping' }));
  assert.equal(responses.length, 1);
  assert.equal(responses[0].id, 9);
});

test('MCP: malformed JSON is -32700, a non-request is -32600', async () => {
  const responses = await mcpRaw('{not json\nnull\n42\n');
  assert.deepEqual(
    responses.map((r) => r.error?.code),
    [-32700, -32600, -32600],
  );
});
