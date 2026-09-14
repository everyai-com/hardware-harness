import { NextResponse } from "next/server";
import type { RateCheck } from "@/lib/cf";

/**
 * The API is for agents — open CORS on everything under /api.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** A JSON error with CORS applied, so a browser-based agent can read the reason. */
export function apiError(
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
): NextResponse {
  return withCors(NextResponse.json({ error: message, ...extra }, { status }));
}

const WINDOW_LABEL: Record<number, string> = {
  60: "per minute",
  3600: "per hour",
  86400: "per day",
};

/** 429 with a message that tells the caller exactly which limit they hit and when it resets. */
export function rateLimitResponse(check: RateCheck): NextResponse {
  const window = WINDOW_LABEL[check.windowSeconds] ?? `per ${check.windowSeconds}s`;
  const retryAfter = check.windowSeconds - (Math.floor(Date.now() / 1000) % check.windowSeconds);
  const res = apiError(
    `Rate limit reached: ${check.limit} ${window} on this endpoint. The harness is open source — self-host for unlimited use.`,
    429,
    { limit: check.limit, windowSeconds: check.windowSeconds, retryAfterSeconds: retryAfter },
  );
  res.headers.set("retry-after", String(retryAfter));
  return res;
}
