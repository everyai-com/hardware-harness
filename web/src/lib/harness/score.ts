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
  diffSpecs,
  validateOutcome,
  compareOutcomeToEstimate,
  calibrateFromOutcomes,
  recordOutcome,
  CALIBRATION_TOLERANCE_PCT,
  PART_CATALOGUE,
  lookupPart,
  partByMpn,
  suggestAlternates,
  catalogueStats,
} from "./engine.mjs";

export type {
  RuleDef,
  Process,
  Material,
  CertRequirement,
  FailureMode,
  Finding,
  SpecDiff,
  PartChange,
  GateFlip,
  CostDelta,
  ValidatedOutcome,
  EstimateVsActual,
  Calibration,
  CatalogPart,
} from "./engine.mjs";

/**
 * Score a ProductSpec with the LuxoBench engine.
 * Same function the CLI and the MCP server run — one engine, three surfaces.
 */
export function scoreSpec(spec: ProductSpec): EvaluationReport {
  return evaluate(spec);
}
