import { evaluate } from "./engine.mjs";
import type { EvaluationReport, ProductSpec } from "./engine.mjs";

export type { EvaluationReport, ProductSpec } from "./engine.mjs";

export {
  PROCESSES,
  MATERIALS,
  RULES,
  CERTIFICATIONS,
  SOURCING_RULES,
  TARIFF_2026,
  LABOR_AND_QC,
  HIDDEN_COSTS,
  FAILURE_TAXONOMY,
  failuresForRule,
  checkDFM,
  MUSE_SDK,
  MUSE_BOARDS,
  MUSE_LINUX,
  MUSE_CAPABILITIES,
  MUSE_OTA_DEFAULT_OFF,
  museBoard,
  museBoardIds,
  buildMuseScaffold,
} from "./engine.mjs";

export type {
  RuleDef,
  Process,
  Material,
  CertRequirement,
  FailureMode,
  Finding,
  PlatformTarget,
  MuseBoard,
  MuseCapability,
  MuseScaffold,
  MuseScaffoldBoard,
  MuseScaffoldCommands,
} from "./engine.mjs";

/**
 * Score a ProductSpec with the BlinkyBench engine.
 * Same function the CLI and the MCP server run — one engine, three surfaces.
 */
export function scoreSpec(spec: ProductSpec): EvaluationReport {
  return evaluate(spec);
}
