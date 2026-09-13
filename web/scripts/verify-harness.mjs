/**
 * Verifies the esbuild-bundled engine produces byte-identical scores to the
 * original harness CLI (which runs the source TS via Node type-stripping).
 * Run: npm run harness:verify
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate, FIXTURES } from "../src/lib/harness/engine.mjs";

const webDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webDir, "../..");

const cli = execSync("node harness/src/index.ts", { cwd: repoRoot, encoding: "utf8" });
const rows = new Map();
for (const m of cli.matchAll(/^\| (.+?) \| (.+?) \| \*\*([\d.]+)\/5\*\* \| (PASS|FAIL) \|/gm)) {
  rows.set(m[1].trim(), { score: Number(m[3]), gates: m[4] });
}

let failed = 0;
for (const spec of FIXTURES) {
  const r = evaluate(spec);
  const expected = rows.get(spec.name);
  if (!expected) {
    console.error(`✗ ${spec.name}: no CLI row found`);
    failed++;
    continue;
  }
  const scoreOk = r.score.total === expected.score;
  const gatesOk = (r.gates.passed ? "PASS" : "FAIL") === expected.gates;
  const ok = scoreOk && gatesOk;
  if (!ok) failed++;
  console.log(
    `${ok ? "✓" : "✗"} ${spec.name}: bundle ${r.score.total}/5 ${r.gates.passed ? "PASS" : "FAIL"} | cli ${expected.score}/5 ${expected.gates}`,
  );
}

if (failed) {
  console.error(`\n${failed} fixture(s) diverge from the CLI.`);
  process.exit(1);
}
console.log("\nBundle matches the harness CLI on all fixtures.");
