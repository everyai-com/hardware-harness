import { NextRequest, NextResponse } from "next/server";
import { specSchema } from "@/lib/spec-schema";
import { scoreSpec } from "@/lib/harness/score";
import type { ProductSpec } from "@/lib/harness/score";
import { readJsonBody, withinLimits } from "@/lib/cf";
import { voterHashFromHeaders } from "@/lib/voter";
import { apiError, corsPreflight, rateLimitResponse, withCors } from "@/lib/cors";

export const dynamic = "force-dynamic";

/**
 * POST /api/evaluate — the harness over HTTP.
 * Body: a ProductSpec JSON. Response: the full LuxoBench EvaluationReport.
 * Nothing is stored. To publish into the gallery, use POST /api/designs.
 *
 * Scoring runs the whole engine (DFM, cost at three quantities, gates), so this is
 * rate limited: it is free to use, not free to run.
 */
export async function POST(req: NextRequest) {
  const voter = await voterHashFromHeaders(req.headers);
  const tripped = await withinLimits([
    { key: `evaluate:burst:${voter}`, limit: 30, windowSeconds: 60 },
    { key: `evaluate:day:${voter}`, limit: 2000, windowSeconds: 86_400 },
  ]);
  if (tripped) return rateLimitResponse(tripped);

  const body = await readJsonBody(req);
  if (!body.ok) return apiError(body.error, 400);

  const parsed = specSchema.safeParse(body.value);
  if (!parsed.success) {
    return apiError("spec failed validation", 422, { issues: parsed.error.issues.slice(0, 20) });
  }

  const report = scoreSpec(parsed.data as unknown as ProductSpec);
  return withCors(NextResponse.json({ report }));
}

export async function OPTIONS() {
  return corsPreflight();
}
