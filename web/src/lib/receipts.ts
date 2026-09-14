/**
 * The receipt.
 *
 * This is the artifact the whole project exists to produce: what a design actually
 * cost, how long it actually took, whether it actually worked, and what actually
 * went wrong. Estimates are claims; a receipt is a measurement.
 *
 * The contract is deliberately small. It is also deliberately *measurable*: a build
 * that says "it works!" with a photo is not a receipt — that is the version of
 * community proof the funded tools already run, and it is the version this project
 * exists to beat. Numbers are what make it a receipt.
 */

export interface BuildReceipt {
  /** Landed cost actually paid for the parts, USD. */
  costPaidUsd?: number;
  /** Hands-on assembly and bring-up time, minutes. */
  assemblyMinutes?: number;
  /** Did it power on and perform its stated function? */
  poweredOn?: boolean;
  /** What arrived wrong, did not fit, or had to be improvised. */
  failed?: string;
  /** Photo, video or invoice backing this up. http(s) only. */
  proofUrl?: string;
}

/** Longest user-supplied text we store, per field. */
const MAX_TEXT = 1000;
const MAX_URL = 500;

/** Only http(s) evidence links are rendered as links; anything else is dropped. */
export function safeProofUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_URL);
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function optionalPositiveNumber(value: unknown, max: number): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > max) return undefined;
  return Math.round(n * 100) / 100;
}

/**
 * Validate and normalise a receipt from an API caller or a form.
 * Unknown keys are dropped rather than stored.
 */
export function parseReceipt(input: unknown): BuildReceipt {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const receipt: BuildReceipt = {};

  const cost = optionalPositiveNumber(raw.costPaidUsd, 1_000_000);
  if (cost !== undefined) receipt.costPaidUsd = cost;

  const minutes = optionalPositiveNumber(raw.assemblyMinutes, 100_000);
  if (minutes !== undefined) receipt.assemblyMinutes = minutes;

  if (typeof raw.poweredOn === "boolean") receipt.poweredOn = raw.poweredOn;

  if (typeof raw.failed === "string" && raw.failed.trim()) {
    receipt.failed = raw.failed.trim().slice(0, MAX_TEXT);
  }

  const proof = safeProofUrl(raw.proofUrl);
  if (proof) receipt.proofUrl = proof;

  return receipt;
}

/** Read a stored receipt back out of an outcome's data blob. */
export function receiptFrom(data: unknown): BuildReceipt {
  return parseReceipt(data);
}

/**
 * A receipt has *numbers* in it. A build that reports only an opinion is a comment.
 */
export function isMeasuredReceipt(receipt: BuildReceipt): boolean {
  return receipt.costPaidUsd !== undefined || receipt.assemblyMinutes !== undefined;
}

/**
 * The top tier: the invoice, the time, the power-on and the evidence that it is not
 * a story. This is the thing `PLAN.md` sells.
 */
export function isVerifiedBuild(receipt: BuildReceipt): boolean {
  return (
    receipt.poweredOn === true &&
    receipt.costPaidUsd !== undefined &&
    receipt.assemblyMinutes !== undefined &&
    receipt.proofUrl !== undefined
  );
}

/** Human line for the numbers in a receipt. */
export function receiptSummary(receipt: BuildReceipt): string {
  const parts: string[] = [];
  if (receipt.costPaidUsd !== undefined) parts.push(`$${receipt.costPaidUsd.toFixed(2)} of parts`);
  if (receipt.assemblyMinutes !== undefined) parts.push(`${receipt.assemblyMinutes} min build`);
  if (receipt.poweredOn === true) parts.push("powered on");
  else if (receipt.poweredOn === false) parts.push("did not work");
  return parts.join(" · ");
}

/** What is still missing before this counts as a full verified receipt. */
export function missingForVerification(receipt: BuildReceipt): string[] {
  const missing: string[] = [];
  if (receipt.costPaidUsd === undefined) missing.push("cost actually paid");
  if (receipt.assemblyMinutes === undefined) missing.push("assembly minutes");
  if (receipt.poweredOn === undefined) missing.push("power-on verdict");
  else if (receipt.poweredOn === false) missing.push("a working device");
  if (receipt.proofUrl === undefined) missing.push("evidence link (photo, video or invoice)");
  return missing;
}
