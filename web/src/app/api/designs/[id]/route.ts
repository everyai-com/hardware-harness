import { NextResponse } from "next/server";
import { getDesign, listRemixes, parseStoredJson } from "@/lib/db/queries";
import { apiError, corsPreflight, withCors } from "@/lib/cors";

export const dynamic = "force-dynamic";

/**
 * GET /api/designs/[id] — the spec and its full report as JSON.
 *
 * The two blobs are parsed defensively: a corrupt row is a 500 on the API, not an
 * unhandled crash, and it never takes down a page render.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const design = await getDesign(id);
  if (!design) return apiError("not found", 404);

  const spec = parseStoredJson<Record<string, unknown>>(design.specJson);
  const report = parseStoredJson<Record<string, unknown>>(design.scoreJson);
  if (!spec || !report) {
    console.error(`design ${id} has an unreadable spec or report blob`);
    return apiError("this design's stored record is unreadable — re-publish it via POST /api/designs", 500);
  }

  const remixes = await listRemixes(id);
  return withCors(
    NextResponse.json({
      id: design.id,
      title: design.title,
      producedBy: design.producedBy,
      prompt: design.prompt,
      remixOf: design.remixOf,
      likes: design.likes,
      views: design.views,
      createdAt: design.createdAt,
      spec,
      report,
      remixes: remixes.map((r) => ({ id: r.id, title: r.title, score: r.scoreTotal, url: `/d/${r.id}` })),
    }),
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
