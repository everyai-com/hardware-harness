import { NextRequest, NextResponse } from "next/server";
import { getDesign } from "@/lib/db/queries";
import { readArtifact, type ArtifactFile } from "@/lib/artifacts";
import { withCors, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

/**
 * GET /api/designs/[id]/artifact?file=spec|report — the exact bytes that were
 * scored, served from R2. Designs published before artifacts existed (or while
 * R2 was unavailable) fall back to the D1 copy. ?download=1 attaches it.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = req.nextUrl.searchParams.get("file");
  if (file !== "spec" && file !== "report") {
    return withCors(NextResponse.json({ error: "file must be spec or report" }, { status: 400 }));
  }

  const design = await getDesign(id);
  if (!design) return withCors(NextResponse.json({ error: "not found" }, { status: 404 }));

  const body = (await readArtifact(id, file as ArtifactFile)) ?? (file === "spec" ? design.specJson : design.scoreJson);

  const headers = new Headers({ "content-type": "application/json" });
  if (req.nextUrl.searchParams.get("download") === "1") {
    headers.set("content-disposition", `attachment; filename="${id}-${file}.json"`);
  }
  return withCors(new NextResponse(body, { headers }));
}

export async function OPTIONS() {
  return corsPreflight();
}
