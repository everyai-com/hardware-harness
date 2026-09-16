import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseReceipt,
  isMeasuredReceipt,
  isVerifiedBuild,
  receiptSummary,
  missingForVerification,
  safeProofUrl,
} from "../src/lib/receipts.ts";
import { slugify } from "../src/lib/slug.ts";

test("A full receipt parses and verifies", () => {
  const r = parseReceipt({
    costPaidUsd: 42.5,
    assemblyMinutes: 35,
    poweredOn: true,
    failed: "USB cutout needed filing",
    proofUrl: "https://example.com/photo.jpg",
  });
  assert.equal(isMeasuredReceipt(r), true);
  assert.equal(isVerifiedBuild(r), true);
  assert.deepEqual(missingForVerification(r), []);
  assert.match(receiptSummary(r), /\$42\.50/);
  assert.match(receiptSummary(r), /35 min/);
  assert.match(receiptSummary(r), /powered on/);
});

test("Unknown keys are dropped, bad numbers are dropped, text is capped", () => {
  const r = parseReceipt({
    costPaidUsd: "not a number",
    assemblyMinutes: -3,
    poweredOn: "yes",
    injected: "drop me",
    failed: "x".repeat(5000),
  });
  assert.deepEqual(r, { failed: "x".repeat(1000) });
  assert.equal(isMeasuredReceipt(r), false);
  assert.equal(isVerifiedBuild(r), false);
});

test("Only http(s) proof URLs survive", () => {
  assert.equal(safeProofUrl("https://example.com/a"), "https://example.com/a");
  assert.equal(safeProofUrl("javascript:alert(1)"), undefined);
  assert.equal(safeProofUrl("ftp://example.com/a"), undefined);
  assert.equal(safeProofUrl("not a url"), undefined);
  assert.equal(safeProofUrl(42), undefined);
});

test("Missing pieces are named so the form can ask for them", () => {
  const missing = missingForVerification(parseReceipt({ poweredOn: false }));
  assert.ok(missing.includes("cost actually paid"));
  assert.ok(missing.includes("a working device"), "a failed build names the real gap");
});

test("slugify is URL-safe, bounded and never empty", () => {
  assert.equal(slugify("Cube Lamp — Astra's Design!"), "cube-lamp-astras-design");
  assert.equal(slugify("!!!"), "design");
  assert.ok(slugify("x".repeat(200)).length <= 60);
});
