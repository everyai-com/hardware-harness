/**
 * Request helpers shared by the API routes. Kept free of Next and Cloudflare
 * imports so they run under plain `node --test`.
 */

/** Largest JSON body any route accepts. A full spec is a few KB; 256 KB is generous. */
export const MAX_BODY_BYTES = 256 * 1024;

/** Longest generate prompt (description + clarifying answers) sent to the model and stored. */
export const MAX_PROMPT_CHARS = 4000;
/** Longest refine request. */
export const MAX_REQUEST_CHARS = 1000;

export type JsonObjectResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: 400 | 413; error: string };

/**
 * Read a JSON object body with a size cap. `null`, arrays and primitives are
 * rejected up front, so handlers can destructure fields without crashing.
 */
export async function readJsonObject(req: Request, maxBytes = MAX_BODY_BYTES): Promise<JsonObjectResult> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413, error: `body too large (max ${maxBytes} bytes)` };
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, status: 400, error: "could not read body" };
  }
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, status: 413, error: `body too large (max ${maxBytes} bytes)` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, error: "invalid JSON body" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: "body must be a JSON object" };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

/**
 * The caller's IP, as a rate-limit key. On Cloudflare `cf-connecting-ip` is
 * always set by the edge and cannot be spoofed. An IPv6 address is reduced to
 * its /64 — one subscriber usually owns the whole /64, so keying on the full
 * address would let them rotate through 2^64 identities.
 */
export function clientIp(headers: Headers): string {
  const raw = (headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  if (!raw) return "local";
  if (!raw.includes(":")) return raw;
  const mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];
  return `${ipv6Prefix64(raw)}::/64`;
}

function ipv6Prefix64(address: string): string {
  const [head, tail] = address.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const groups =
    tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return groups
    .slice(0, 4)
    .map((g) => (g || "0").replace(/^0+(?=.)/, ""))
    .join(":");
}
