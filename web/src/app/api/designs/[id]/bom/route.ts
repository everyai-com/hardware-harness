import { NextResponse } from "next/server";
import { getDesign, parseStoredJson } from "@/lib/db/queries";
import { apiError, corsPreflight, withCors } from "@/lib/cors";
import { buildBomCsv, bomFilename, type BomCsvPart } from "@/lib/bom-csv";
import { getQuote } from "@/lib/quotes";
import type { ProductSpec } from "@/lib/harness/score";

export const dynamic = "force-dynamic";

/**
 * GET /api/designs/[id]/bom?qty=1 — the bill of materials as CSV.
 *
 * The supply-chain artifact: one row per part with channel, quantity and
 * price (live LCSC where cached, estimate otherwise). `qty` scales the order
 * quantities; the total covers BOM lines only, never tooling/duty/freight.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const design = await getDesign(id);
  if (!design) return apiError("not found", 404);

  const spec = parseStoredJson<ProductSpec>(design.specJson);
  if (!spec) return apiError("this design's stored spec is unreadable — re-publish it via POST /api/designs", 500);

  const url = new URL(req.url);
  const qty = Math.min(Math.max(Math.floor(Number(url.searchParams.get("qty") ?? "1")) || 1, 1), 100000);

  const mpns = [
    ...new Set(
      spec.parts.filter((p) => p.kind === "catalog" && p.source?.mpn).map((p) => p.source!.mpn!),
    ),
  ].slice(0, 20);
  const quotes =
    mpns.length > 0
      ? new Map(await Promise.all(mpns.map(async (mpn) => [mpn, await getQuote(mpn)] as const)))
      : undefined;

  const csv = buildBomCsv(design.title, spec.parts as unknown as BomCsvPart[], quotes, qty);
  const res = new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${bomFilename(design.id, qty)}"`,
    },
  });
  return withCors(res);
}

export async function OPTIONS() {
  return corsPreflight();
}
