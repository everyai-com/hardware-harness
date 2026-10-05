import { getEnv } from "./cf";

/**
 * Turnstile bot protection, optional and off by default. Set both
 * TURNSTILE_SITE_KEY (public var) and TURNSTILE_SECRET_KEY (secret) and the
 * generate form plus POST /api/designs require a valid widget token.
 * Half-configured stays off — a missing key must never brick publishing.
 */

export function turnstileEnabled(): boolean {
  const env = getEnv();
  const on = !!env.TURNSTILE_SITE_KEY && !!env.TURNSTILE_SECRET_KEY;
  if (!on && (env.TURNSTILE_SITE_KEY || env.TURNSTILE_SECRET_KEY)) {
    console.warn("[turnstile] half-configured: needs both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY; checks are OFF");
  }
  return on;
}

/** Verify a widget token with the siteverify API. False on any failure — never throws. */
export async function verifyTurnstile(token: unknown, remoteip?: string | null): Promise<boolean> {
  const secret = getEnv().TURNSTILE_SECRET_KEY;
  if (!secret || typeof token !== "string" || token.length === 0 || token.length > 2048) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: remoteip ?? undefined }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    console.warn("[turnstile] siteverify failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
