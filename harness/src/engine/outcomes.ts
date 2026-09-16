/**
 * The outcome loop.
 *
 * The harness is a prediction machine: estimated cost, estimated minutes,
 * predicted gates. A build receipt is the measurement. This module closes
 * the loop - it validates a recorded outcome, compares it against the
 * estimate, and derives the calibration factor that turns the next
 * prediction from a guess into a measurement-backed number.
 *
 * The harness itself is stateless (no database), so this module computes
 * rather than stores: the caller persists outcome rows, then asks here for
 * the estimate-vs-actual deltas and the aggregate calibration.
 */

import { evaluate } from './evaluate.ts';
import { estimateAssemblyMinutes } from './dfm-check.ts';
import type { ProductSpec } from './types.ts';
import { round } from './util.ts';

export interface BuildOutcomeInput {
  /** Landed cost actually paid for the parts, USD. */
  actualCostUsd?: number;
  /** Hands-on assembly and bring-up time, minutes. */
  actualMinutes?: number;
  /** Did it power on and perform its stated function? */
  poweredOn?: boolean;
  /** Free-text failure notes: what arrived wrong, did not fit, was improvised. */
  failures?: string[];
  /** Photo, video or invoice backing this up. http(s) only. */
  proofUrl?: string;
  /** Who recorded it. */
  author?: string;
}

export interface ValidatedOutcome {
  actualCostUsd?: number;
  actualMinutes?: number;
  poweredOn?: boolean;
  failures: string[];
  proofUrl?: string;
  author: string;
  /** A receipt has numbers in it; an opinion-only build is a comment. */
  measured: boolean;
  /** The full receipt: cost + minutes + working device + evidence. */
  verified: boolean;
  missingForVerification: string[];
}

export interface EstimateVsActual {
  estimatedCostUsd: number;
  actualCostUsd?: number;
  /** >1 means the build cost more than estimated. */
  costRatio?: number;
  estimatedMinutes: number;
  actualMinutes?: number;
  /** >1 means the build took longer than estimated. */
  timeRatio?: number;
  poweredOn?: boolean;
  withinCostTolerance: boolean;
  withinTimeTolerance: boolean;
}

export interface Calibration {
  samples: number;
  /** Multiply future cost estimates by this. 1 = unbiased. */
  costFactor: number;
  /** Multiply future assembly estimates by this. 1 = unbiased. */
  timeFactor: number;
  /** 'low' below 3 samples, 'medium' below 10, 'high' at 10+. */
  confidence: 'low' | 'medium' | 'high';
  note: string;
}

const MAX_COST_USD = 1_000_000;
const MAX_MINUTES = 100_000;
const MAX_FAILURE_CHARS = 1000;
const MAX_FAILURES = 20;

/** Estimates are ±40%, so a receipt within that band confirms the model. */
export const CALIBRATION_TOLERANCE_PCT = 40;

/**
 * Validate and normalise a caller-supplied outcome. Unknown keys are dropped,
 * out-of-range numbers throw - a receipt with a $0 cost or a million minutes
 * is bad data, and bad data must not enter the calibration set.
 */
export function validateOutcome(input: BuildOutcomeInput): ValidatedOutcome {
  if (!input || typeof input !== 'object') throw new Error('Outcome must be an object.');
  const out: ValidatedOutcome = { failures: [], author: 'anonymous', measured: false, verified: false, missingForVerification: [] };

  if (input.actualCostUsd !== undefined) {
    const n = Number(input.actualCostUsd);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_COST_USD) {
      throw new Error(`Outcome.actualCostUsd must be between 0 and ${MAX_COST_USD}, got "${input.actualCostUsd}".`);
    }
    out.actualCostUsd = round(n);
  }
  if (input.actualMinutes !== undefined) {
    const n = Number(input.actualMinutes);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_MINUTES) {
      throw new Error(`Outcome.actualMinutes must be between 0 and ${MAX_MINUTES}, got "${input.actualMinutes}".`);
    }
    out.actualMinutes = round(n);
  }
  if (input.poweredOn !== undefined) {
    if (typeof input.poweredOn !== 'boolean') throw new Error('Outcome.poweredOn must be a boolean.');
    out.poweredOn = input.poweredOn;
  }
  if (input.failures !== undefined) {
    if (!Array.isArray(input.failures)) throw new Error('Outcome.failures must be an array of strings.');
    out.failures = input.failures
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      .slice(0, MAX_FAILURES)
      .map((f) => f.trim().slice(0, MAX_FAILURE_CHARS));
  }
  if (input.proofUrl !== undefined) {
    if (typeof input.proofUrl !== 'string') throw new Error('Outcome.proofUrl must be a string URL.');
    const trimmed = input.proofUrl.trim();
    if (trimmed) {
      let url: URL;
      try {
        url = new URL(trimmed);
      } catch {
        throw new Error('Outcome.proofUrl must be a valid http(s) URL.');
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Outcome.proofUrl must be a valid http(s) URL.');
      }
      out.proofUrl = url.toString().slice(0, 500);
    }
  }
  if (input.author !== undefined) {
    if (typeof input.author !== 'string') throw new Error('Outcome.author must be a string.');
    const name = input.author.trim().slice(0, 80);
    if (name) out.author = name;
  }

  out.measured = out.actualCostUsd !== undefined || out.actualMinutes !== undefined;
  const missing: string[] = [];
  if (out.actualCostUsd === undefined) missing.push('cost actually paid');
  if (out.actualMinutes === undefined) missing.push('assembly minutes');
  if (out.poweredOn === undefined) missing.push('power-on verdict');
  else if (out.poweredOn === false) missing.push('a working device');
  if (out.proofUrl === undefined) missing.push('evidence link (photo, video or invoice)');
  out.missingForVerification = missing;
  out.verified = missing.length === 0;
  return out;
}

/**
 * Compare one validated outcome against the harness estimate for the same
 * spec. Cost is compared at qty 1 (the personal-build line), minutes against
 * the assembly estimate.
 */
export function compareOutcomeToEstimate(spec: ProductSpec, outcome: ValidatedOutcome): EstimateVsActual {
  const report = evaluate(spec);
  const qty1 = report.cost.quantities.find((q) => q.quantity === 1) ?? report.cost.quantities[0];
  const estimatedCostUsd = qty1 ? qty1.personalBuildUsd : 0;
  const estimatedMinutes = estimateAssemblyMinutes(spec);

  const costRatio = outcome.actualCostUsd !== undefined && estimatedCostUsd > 0
    ? round(outcome.actualCostUsd / estimatedCostUsd)
    : undefined;
  const timeRatio = outcome.actualMinutes !== undefined && estimatedMinutes > 0
    ? round(outcome.actualMinutes / estimatedMinutes)
    : undefined;

  const within = (ratio: number | undefined) =>
    ratio === undefined ? true : Math.abs(ratio - 1) * 100 <= CALIBRATION_TOLERANCE_PCT;

  return {
    estimatedCostUsd,
    actualCostUsd: outcome.actualCostUsd,
    costRatio,
    estimatedMinutes,
    actualMinutes: outcome.actualMinutes,
    timeRatio,
    poweredOn: outcome.poweredOn,
    withinCostTolerance: within(costRatio),
    withinTimeTolerance: within(timeRatio),
  };
}

/**
 * Aggregate calibration from a set of estimate-vs-actual pairs. Uses the
 * median ratio so one disastrous build does not drag the factor - the
 * median is the honest centre of a small, skewed sample.
 */
export function calibrateFromOutcomes(pairs: EstimateVsActual[]): Calibration {
  const costs = pairs.map((p) => p.costRatio).filter((r): r is number => r !== undefined && Number.isFinite(r) && r > 0);
  const times = pairs.map((p) => p.timeRatio).filter((r): r is number => r !== undefined && Number.isFinite(r) && r > 0);
  const samples = pairs.length;
  const costFactor = costs.length ? round(median(costs)) : 1;
  const timeFactor = times.length ? round(median(times)) : 1;
  const confidence = samples >= 10 ? 'high' : samples >= 3 ? 'medium' : 'low';
  const note = samples === 0
    ? 'No measured outcomes yet - estimates are uncalibrated (±40%).'
    : `From ${samples} measured build${samples === 1 ? '' : 's'}: costs run ${describeFactor(costFactor)}, assembly runs ${describeFactor(timeFactor)}.`;
  return { samples, costFactor, timeFactor, confidence, note };
}

/**
 * Record an outcome against a spec in one call: validate, compare, and
 * report. The caller persists the validated outcome; the harness never
 * stores anything.
 */
export function recordOutcome(spec: ProductSpec, input: BuildOutcomeInput): {
  outcome: ValidatedOutcome;
  comparison: EstimateVsActual;
} {
  const outcome = validateOutcome(input);
  const comparison = compareOutcomeToEstimate(spec, outcome);
  return { outcome, comparison };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function describeFactor(factor: number): string {
  const pct = Math.round((factor - 1) * 100);
  if (Math.abs(pct) <= 5) return 'about as estimated';
  return pct > 0 ? `${pct}% over estimate` : `${Math.abs(pct)}% under estimate`;
}
