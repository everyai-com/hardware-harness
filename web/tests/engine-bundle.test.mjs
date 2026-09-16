import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluate,
  diffSpecs,
  lookupPart,
  partByMpn,
  catalogueStats,
  recordOutcome,
  calibrateFromOutcomes,
  ASTRA_LAMP,
  FABLE_LAMP,
} from "../src/lib/harness/engine.mjs";

/**
 * The web bundle is the same engine as the CLI — these tests guard the
 * *bundled* surface the pages and API routes actually call, so a missed
 * harness-entry export breaks here instead of in production.
 */

test("Bundle exports the verification loop: diff, outcomes, catalogue", () => {
  for (const fn of [diffSpecs, lookupPart, partByMpn, catalogueStats, recordOutcome, calibrateFromOutcomes]) {
    assert.equal(typeof fn, "function", `${fn?.name ?? fn} is exported from the bundle`);
  }
});

test("Bundle diff matches the CLI story: Fable fixes G9", () => {
  const d = diffSpecs(ASTRA_LAMP, FABLE_LAMP);
  assert.equal(d.before.id, "lamp-astra");
  assert.equal(d.after.id, "lamp-fable");
  assert.equal(d.scoreDelta, Math.round((evaluate(FABLE_LAMP).score.total - evaluate(ASTRA_LAMP).score.total) * 100) / 100);
  assert.ok(d.gatesFlipped.some((g) => g.id === "G9" && g.direction === "fixed"));
  assert.match(d.summary, /Score/);
});

test("Bundle catalogue answers the BOM questions", () => {
  const stats = catalogueStats();
  assert.ok(stats.parts >= 30);
  const esp = lookupPart("ESP32");
  assert.ok(esp.length >= 2);
  const stm = partByMpn("stm32f103c8t6");
  assert.equal(stm.counterfeitRisk, "high");
  assert.deepEqual(stm.distributors, ["authorized"]);
});

test("Bundle outcome loop validates and compares", () => {
  const { outcome, comparison } = recordOutcome(ASTRA_LAMP, {
    actualCostUsd: 35,
    actualMinutes: 40,
    poweredOn: true,
    proofUrl: "https://example.com/receipt",
  });
  assert.equal(outcome.verified, true);
  assert.ok(comparison.costRatio > 0);
  assert.ok(comparison.timeRatio > 0);

  const cal = calibrateFromOutcomes([comparison, comparison, comparison]);
  assert.equal(cal.samples, 3);
  assert.equal(cal.confidence, "medium");
});

test("Bundle outcome validation rejects bad receipts", () => {
  assert.throws(() => recordOutcome(ASTRA_LAMP, { actualCostUsd: -1 }), /actualCostUsd/);
  assert.throws(() => recordOutcome(ASTRA_LAMP, { proofUrl: "javascript:alert(1)" }), /proofUrl/);
});
