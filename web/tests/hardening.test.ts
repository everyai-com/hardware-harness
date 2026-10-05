/**
 * Pure-logic tests for the publish pipeline's input handling. They import only
 * modules free of Next/Cloudflare bindings, so plain `node --test` runs them.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { unzipSync } from "fflate";

import { readJsonObject, clientIp, MAX_BODY_BYTES } from "../src/lib/request.ts";
import { slugify, withSuffix, MAX_SLUG_BYTES } from "../src/lib/slug.ts";
import { zipMuseKit } from "../src/lib/muse-zip.ts";
import { specSchema } from "../src/lib/spec-schema.ts";

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api", { method: "POST", body, headers });
}

// ---- readJsonObject ---------------------------------------------------------

test("readJsonObject accepts a JSON object", async () => {
  const r = await readJsonObject(post('{"id":"lamp"}'));
  assert.deepEqual(r, { ok: true, body: { id: "lamp" } });
});

for (const body of ["null", "42", '"x"', "[1,2]"]) {
  test(`readJsonObject rejects non-object body ${body} with 400`, async () => {
    const r = await readJsonObject(post(body));
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.status, 400);
  });
}

test("readJsonObject rejects malformed JSON with 400", async () => {
  const r = await readJsonObject(post("{nope"));
  assert.equal(!r.ok && r.status, 400);
});

test("readJsonObject rejects an oversized body with 413", async () => {
  const big = JSON.stringify({ pad: "x".repeat(MAX_BODY_BYTES) });
  const r = await readJsonObject(post(big));
  assert.equal(!r.ok && r.status, 413);
});

test("readJsonObject trusts a declared oversize content-length without reading", async () => {
  const r = await readJsonObject(post("{}", { "content-length": String(MAX_BODY_BYTES + 1) }));
  assert.equal(!r.ok && r.status, 413);
});

// ---- clientIp -----------------------------------------------------------------

test("clientIp prefers cf-connecting-ip and ignores the user agent", () => {
  const a = clientIp(new Headers({ "cf-connecting-ip": "203.0.113.7", "user-agent": "a" }));
  const b = clientIp(new Headers({ "cf-connecting-ip": "203.0.113.7", "user-agent": "b" }));
  assert.equal(a, "203.0.113.7");
  assert.equal(a, b);
});

test("clientIp collapses an IPv6 address to its /64", () => {
  const a = clientIp(new Headers({ "cf-connecting-ip": "2001:db8:1:2:aaaa:bbbb:cccc:dddd" }));
  const b = clientIp(new Headers({ "cf-connecting-ip": "2001:0db8:0001:0002::1" }));
  assert.equal(a, "2001:db8:1:2::/64");
  assert.equal(b, a);
});

test("clientIp handles compressed and IPv4-mapped forms", () => {
  assert.equal(clientIp(new Headers({ "cf-connecting-ip": "2001:db8::1" })), "2001:db8:0:0::/64");
  assert.equal(clientIp(new Headers({ "cf-connecting-ip": "::ffff:198.51.100.4" })), "198.51.100.4");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "198.51.100.9, 10.0.0.1" })), "198.51.100.9");
  assert.equal(clientIp(new Headers()), "local");
});

// ---- slugs --------------------------------------------------------------------

test("suffixed slugs fit Vectorize's 64-byte id limit", () => {
  const base = slugify("a".repeat(200));
  assert.equal(base.length, 60);
  for (const suffix of ["k3x9", Date.now().toString(36)]) {
    const slug = withSuffix(base, suffix);
    assert.ok(slug.length <= MAX_SLUG_BYTES, `${slug} is ${slug.length} bytes`);
    assert.ok(slug.endsWith(`-${suffix}`));
  }
});

// ---- Muse kit zip -------------------------------------------------------------

test("zipMuseKit writes every file under one directory", () => {
  const zip = zipMuseKit({ "README.md": "# hi", "setup.sh": "#!/bin/sh" }, "muse-gadget-lamp");
  assert.deepEqual(Object.keys(unzipSync(zip)).sort(), ["muse-gadget-lamp/README.md", "muse-gadget-lamp/setup.sh"]);
});

for (const name of ["../evil", "a/b", "..", "/etc/passwd", "a\\b", ""]) {
  test(`zipMuseKit refuses unsafe entry name ${JSON.stringify(name)}`, () => {
    assert.throws(() => zipMuseKit({ [name]: "x" }, "muse-gadget-lamp"));
  });
}

// ---- spec schema numbers --------------------------------------------------------

const BASE_SPEC = {
  name: "Desk lamp",
  intent: "A small lamp",
  parts: [{ id: "shade", label: "Shade", process: "fdm", material: "PLA", qty: 1, bboxMm: { x: 80, y: 80, z: 60 } }],
  operations: [{ id: "assemble", label: "Assemble", minutes: 5 }],
};

function withPart(extra: Record<string, unknown>) {
  return { ...BASE_SPEC, parts: [{ ...BASE_SPEC.parts[0], ...extra }] };
}

test("spec schema reads numeric strings, as LLMs often send them", () => {
  const r = specSchema.safeParse(withPart({ qty: "2", purchasePriceUsd: "3.5" }));
  assert.ok(r.success, JSON.stringify(!r.success && r.error.issues));
  assert.equal(r.data.parts[0].qty, 2);
  assert.equal(r.data.parts[0].purchasePriceUsd, 3.5);
});

test("spec schema treats null on an optional number as absent, not 0", () => {
  const r = specSchema.safeParse(withPart({ purchasePriceUsd: null }));
  assert.ok(r.success, JSON.stringify(!r.success && r.error.issues));
  assert.equal(r.data.parts[0].purchasePriceUsd, undefined);
});

for (const bad of [null, "", false, [12], "1e400", "abc"]) {
  test(`spec schema rejects qty ${JSON.stringify(bad)} instead of coercing it`, () => {
    assert.equal(specSchema.safeParse(withPart({ qty: bad })).success, false);
  });
}

test("spec schema caps list sizes", () => {
  const parts = Array.from({ length: 201 }, (_, i) => ({ ...BASE_SPEC.parts[0], id: `p${i}` }));
  assert.equal(specSchema.safeParse({ ...BASE_SPEC, parts }).success, false);
});
