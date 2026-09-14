import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/quotes";
import { withinLimits } from "@/lib/cf";
import { voterHashFromHeaders } from "@/lib/voter";
import { apiError, corsPreflight, rateLimitResponse, withCors } from "@/lib/cors";

export const dynamic = "force-dynamic";

/** Longest real MPN in the catalogue is well under this; anything longer is a probe. */
const MAX_MPN_LENGTH = 60;
/**
 * Part numbers are alphanumeric with separators. No slashes, no traversal sequences,
 * and it has to contain at least one letter or digit - otherwise "..", "/" or "----"
 * would be forwarded to the distributor and cached.
 */
const MPN_PATTERN = /^(?=.*[A-Za-z0-9])[A-Za-z0-9._#+-]+$/;

/**
 * GET /api/quote?mpn=ESP32-S3 — best-effort live distributor lookup (LCSC).
 * Returns { quote: null } on any failure; the harness estimate is the floor.
 *
 * This makes an outbound HTTP call per uncached MPN, so it is rate limited rather
 * than being an open proxy for the distributor's API.
 */
export async function GET(req: NextRequest) {
  const voter = await voterHashFromHeaders(req.headers);
  const tripped = await withinLimits([
    { key: `quote:burst:${voter}`, limit: 20, windowSeconds: 60 },
    { key: `quote:day:${voter}`, limit: 500, windowSeconds: 86_400 },
  ]);
  if (tripped) return rateLimitResponse(tripped);

  const mpn = (req.nextUrl.searchParams.get("mpn") ?? "").trim();
  if (!mpn) return apiError("missing mpn", 400);
  if (mpn.length > MAX_MPN_LENGTH || mpn.includes("..") || !MPN_PATTERN.test(mpn)) {
    return apiError(`mpn must be ${MAX_MPN_LENGTH} characters or fewer, alphanumeric with . _ # + -`, 400);
  }

  const quote = await getQuote(mpn);
  return withCors(
    NextResponse.json({
      mpn,
      quote,
      note: "quote is best-effort live data; harness landed-cost estimates remain ±40%",
    }),
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
