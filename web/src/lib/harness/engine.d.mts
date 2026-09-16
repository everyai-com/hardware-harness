/**
 * Type declarations for the esbuild-bundled harness engine (engine.mjs).
 * Re-exports the original source types so the app gets full type safety
 * without shipping harness TypeScript through Next's compiler.
 */
export { evaluate, runGates } from "../../../../harness/src/engine/evaluate.ts";
export type { EvaluationReport, GateResult, ScoreAxis } from "../../../../harness/src/engine/evaluate.ts";

export { landedCost } from "../../../../harness/src/engine/cost.ts";
export type { CostReport, UnitCost, CostLine } from "../../../../harness/src/engine/cost.ts";

export {
  checkDFM,
  estimateAssemblyMinutes,
  requiredCertifications,
  PART_COUNT_BUDGET,
  ASSEMBLY_MINUTE_BUDGET,
} from "../../../../harness/src/engine/dfm-check.ts";
export type { Finding } from "../../../../harness/src/engine/dfm-check.ts";

export { recommendProcess } from "../../../../harness/src/engine/process-select.ts";
export { renderReport } from "../../../../harness/src/engine/report.ts";
export { partVolumeCm3, totalPartCount } from "../../../../harness/src/engine/types.ts";
export { usd } from "../../../../harness/src/engine/util.ts";
export { diffSpecs } from "../../../../harness/src/engine/spec-diff.ts";
export type { SpecDiff, PartChange, GateFlip, CostDelta } from "../../../../harness/src/engine/spec-diff.ts";
export {
  validateOutcome,
  compareOutcomeToEstimate,
  calibrateFromOutcomes,
  recordOutcome,
  CALIBRATION_TOLERANCE_PCT,
} from "../../../../harness/src/engine/outcomes.ts";
export type {
  BuildOutcomeInput,
  ValidatedOutcome,
  EstimateVsActual,
  Calibration,
} from "../../../../harness/src/engine/outcomes.ts";
export {
  PART_CATALOGUE,
  lookupPart,
  partByMpn,
  suggestAlternates,
  catalogueStats,
} from "../../../../harness/src/knowledge/parts.ts";
export type { CatalogPart, CounterfeitRisk } from "../../../../harness/src/knowledge/parts.ts";
export type {
  ProductSpec,
  Part,
  PartKind,
  PartType,
  Distributor,
  CatalogSource,
  Interface,
  Operation,
  FeatureIntent,
  PowerSpec,
  Face,
  Market,
} from "../../../../harness/src/engine/types.ts";

export { PROCESSES } from "../../../../harness/src/knowledge/processes.ts";
export type { ProcessId, Process } from "../../../../harness/src/knowledge/processes.ts";
export { MATERIALS, RULES } from "../../../../harness/src/knowledge/dfm.ts";
export type { RuleId, RuleDef, Material, Severity } from "../../../../harness/src/knowledge/dfm.ts";
export {
  CERTIFICATIONS,
  SOURCING_RULES,
  SOURCING_CHANNELS,
  DEFECT_RATE_REALITY,
  PRICING_GUIDANCE,
} from "../../../../harness/src/knowledge/compliance.ts";
export type { CertRequirement } from "../../../../harness/src/knowledge/compliance.ts";
export { TARIFF_2026, LABOR_AND_QC, HIDDEN_COSTS } from "../../../../harness/src/knowledge/economics.ts";
export { FAILURE_TAXONOMY, failuresForRule } from "../../../../harness/src/knowledge/taxonomy.ts";
export type { FailureMode } from "../../../../harness/src/knowledge/taxonomy.ts";

export { FIXTURES, ASTRA_LAMP, FABLE_LAMP, DJ_CONTROLLER } from "../../../../harness/src/fixtures/keil-runs.ts";
export { BLUEPRINT_VOICE_NOTE } from "../../../../harness/src/fixtures/blueprint-voice-note.ts";
export { VOICE_NOTE_FIXED } from "../../../../harness/src/fixtures/voice-note-fixed.ts";
export { LAMP_ACCEPTANCE_CRITERIA, LAMP_REFERENCE_FEATURES, emptyLampSpec } from "../../../../harness/src/fixtures/lamp.ts";
