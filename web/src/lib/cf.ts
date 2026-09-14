import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Typed access to the Cloudflare bindings declared in wrangler.jsonc.
 * The ambient CloudflareEnv interface is augmented in src/types/cloudflare-env.d.ts.
 */
export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env;
}

const DEFAULT_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export function aiModel(): string {
  return getEnv().AI_MODEL ?? DEFAULT_AI_MODEL;
}

export interface RateCheck {
  key: string;
  /** Allowed calls inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/**
 * Fixed-window counter in KV.
 *
 * KV is eventually consistent and read-modify-write is not atomic, so a determined
 * burst can exceed the limit by a few calls. That is the right trade here: the goal
 * is to stop a runaway agent or a scraper from burning the AI and CPU budget, not to
 * meter a paid API. Move to a Durable Object if exact accounting is ever needed.
 */
export async function rateLimit(keyPrefix: string, limit: number, windowSeconds = 86_400): Promise<boolean> {
  const { KV } = getEnv();
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `${keyPrefix}:${windowSeconds}:${bucket}`;
  const current = Number((await KV.get(key)) ?? 0);
  if (current >= limit) return false;
  await KV.put(key, String(current + 1), { expirationTtl: windowSeconds * 2 });
  return true;
}

/**
 * Apply several limits and return the first one that trips, or null if all pass.
 * Endpoints that cost CPU or money get a burst limit *and* a daily quota: a single
 * daily number lets a burst spend the whole day's budget in a minute.
 */
export async function withinLimits(checks: RateCheck[]): Promise<RateCheck | null> {
  for (const check of checks) {
    if (!(await rateLimit(check.key, check.limit, check.windowSeconds))) return check;
  }
  return null;
}

/** Requests larger than this are rejected before parsing. */
export const MAX_BODY_BYTES = 256 * 1024;

export type BodyResult = { ok: true; value: unknown } | { ok: false; error: string };


/**
 * Read and size-check a JSON request body. `Content-Length` is a hint a client can
 * lie about, so the byte length of what actually arrived is what counts.
 */
export async function readJsonBody(req: Request, maxBytes = MAX_BODY_BYTES): Promise<BodyResult> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, error: `body too large (limit ${Math.round(maxBytes / 1024)} KiB)` };
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, error: "could not read request body" };
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, error: `body too large (limit ${Math.round(maxBytes / 1024)} KiB)` };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: "invalid JSON body" };
  }
}
