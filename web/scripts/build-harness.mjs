import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(here, "..", "src", "lib", "harness", "engine.mjs");

await mkdir(path.dirname(outfile), { recursive: true });

await build({
  entryPoints: [path.join(here, "harness-entry.ts")],
  bundle: true,
  format: "esm",
  target: "es2022",
  // "neutral" keeps the bundle runtime-agnostic: the engine is pure TypeScript
  // with zero Node dependencies, so it runs identically in workerd.
  platform: "neutral",
  outfile,
  logLevel: "info",
});
