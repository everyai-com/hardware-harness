import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/quotes";
import { withCors, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

/**
 * GET /api/quote?mpn=ESP32-S3 — best-effort live distributor lookup (LCSC).
 * Returns { quote: null } on any failure; the harness estimate is the floor.
 */
export async function GET(req: NextRequest) {
  const mpn = req.nextUrl.searchParams.get("mpn");
  if (!mpn) return NextResponse.json({ error: "missing mpn" }, { status: 400 });
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
