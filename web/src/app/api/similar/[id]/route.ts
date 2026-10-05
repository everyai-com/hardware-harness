import { NextRequest, NextResponse } from "next/server";
import { getDesign, getDesigns } from "@/lib/db/queries";
import { findSimilarIds, searchTextFor } from "@/lib/similar";
import type { ProductSpec } from "@/lib/harness/score";
import { withCors, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

/**
 * GET /api/similar/[id]?limit=4 — designs nearest this one in embedding space.
 * Empty array when search is unavailable (no index in this environment).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const design = await getDesign(id);
  if (!design) return withCors(NextResponse.json({ error: "not found" }, { status: 404 }));

  let spec: ProductSpec;
  try {
    spec = JSON.parse(design.specJson) as ProductSpec;
  } catch {
    return withCors(NextResponse.json({ error: "design spec unreadable" }, { status: 500 }));
  }

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 4, 1), 12);
  const ids = await findSimilarIds(searchTextFor(spec), id, limit);
  const rows = await getDesigns(ids);

  return withCors(
    NextResponse.json({
      designId: id,
      similar: rows.map((d) => ({
        id: d.id,
        title: d.title,
        score: d.scoreTotal,
        gatesPassed: d.gatesPassed,
        producedBy: d.producedBy,
        url: `/d/${d.id}`,
      })),
    }),
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
