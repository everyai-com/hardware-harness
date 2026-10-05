import { NextRequest, NextResponse } from "next/server";
import { listDesigns } from "@/lib/db/queries";
import { indexMany, searchTextFor } from "@/lib/similar";
import type { ProductSpec } from "@/lib/harness/score";
import { adminTokenValid } from "@/lib/admin";
import { withCors, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

/**
 * POST /api/similar/backfill — embed every public design into the Vectorize
 * index. Token-gated: { "token": "<ADMIN_TOKEN>" }. One embedding call and
 * one upsert call for the whole gallery. 404 when ADMIN_TOKEN is unset.
 */
export async function POST(req: NextRequest) {
  let body: { token?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors(NextResponse.json({ error: "invalid JSON body" }, { status: 400 }));
  }
  if (!(await adminTokenValid(body.token))) {
    return withCors(NextResponse.json({ error: "not found" }, { status: 404 }));
  }

  const designs = await listDesigns("new", 1000);
  const items = designs.flatMap((d) => {
    try {
      const spec = JSON.parse(d.specJson) as ProductSpec;
      return [{ id: d.id, text: searchTextFor(spec) }];
    } catch {
      return [];
    }
  });

  const indexed = await indexMany(items);
  return withCors(NextResponse.json({ designs: items.length, indexed }));
}

export async function OPTIONS() {
  return corsPreflight();
}
