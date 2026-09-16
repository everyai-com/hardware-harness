/**
 * Bundle entry for the harness engine.
 * Re-exports the pure-TS evaluation engine from ../harness so it can be bundled
 * into the Cloudflare Worker (and imported by Next.js server code).
 */
export { evaluate, runGates } from "../../harness/src/engine/evaluate.ts";
export { landedCost } from "../../harness/src/engine/cost.ts";
export {
  checkDFM,
  estimateAssemblyMinutes,
  requiredCertifications,
  PART_COUNT_BUDGET,
  ASSEMBLY_MINUTE_BUDGET,
} from "../../harness/src/engine/dfm-check.ts";
export { recommendProcess } from "../../harness/src/engine/process-select.ts";
export { renderReport } from "../../harness/src/engine/report.ts";
export { partVolumeCm3, totalPartCount } from "../../harness/src/engine/types.ts";
export { usd } from "../../harness/src/engine/util.ts";
export { diffSpecs } from "../../harness/src/engine/spec-diff.ts";
export {
  validateOutcome,
  compareOutcomeToEstimate,
  calibrateFromOutcomes,
  recordOutcome,
  CALIBRATION_TOLERANCE_PCT,
} from "../../harness/src/engine/outcomes.ts";
export {
  PART_CATALOGUE,
  lookupPart,
  partByMpn,
  suggestAlternates,
  catalogueStats,
} from "../../harness/src/knowledge/parts.ts";

// Knowledge modules — rendered on /reference
export { PROCESSES } from "../../harness/src/knowledge/processes.ts";
export { MATERIALS, RULES } from "../../harness/src/knowledge/dfm.ts";
export {
  CERTIFICATIONS,
  SOURCING_RULES,
  SOURCING_CHANNELS,
  DEFECT_RATE_REALITY,
  PRICING_GUIDANCE,
} from "../../harness/src/knowledge/compliance.ts";
export { TARIFF_2026, LABOR_AND_QC, HIDDEN_COSTS } from "../../harness/src/knowledge/economics.ts";
export { FAILURE_TAXONOMY, failuresForRule } from "../../harness/src/knowledge/taxonomy.ts";

// Fixtures — seed data for the gallery
export { FIXTURES, ASTRA_LAMP, FABLE_LAMP, DJ_CONTROLLER } from "../../harness/src/fixtures/keil-runs.ts";
export { BLUEPRINT_VOICE_NOTE } from "../../harness/src/fixtures/blueprint-voice-note.ts";
export { VOICE_NOTE_FIXED } from "../../harness/src/fixtures/voice-note-fixed.ts";
export { LAMP_ACCEPTANCE_CRITERIA, LAMP_REFERENCE_FEATURES, emptyLampSpec } from "../../harness/src/fixtures/lamp.ts";
