import { NextRequest, NextResponse } from "next/server";
import { specSchema } from "@/lib/spec-schema";
import { scoreSpec } from "@/lib/harness/score";
import type { ProductSpec } from "@/lib/harness/score";

export const dynamic = "force-dynamic";

/**
 * POST /api/evaluate — the harness over HTTP.
 * Body: a ProductSpec JSON. Response: the full LuxoBench EvaluationReport.
 * Nothing is stored. To publish into the gallery, use POST /api/designs.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = specSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "spec failed validation", issues: parsed.error.issues.slice(0, 20) },
      { status: 422 },
    );
  }

  const report = scoreSpec(parsed.data as unknown as ProductSpec);
  return NextResponse.json({ report });
}
