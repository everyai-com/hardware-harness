import { NextResponse } from "next/server";
import { getDesign } from "@/lib/db/queries";
import { listRemixes } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** GET /api/designs/[id] — the spec and its full report as JSON. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const design = await getDesign(id);
  if (!design) return NextResponse.json({ error: "not found" }, { status: 404 });
  const remixes = await listRemixes(id);
  return NextResponse.json({
    id: design.id,
    title: design.title,
    producedBy: design.producedBy,
    prompt: design.prompt,
    remixOf: design.remixOf,
    createdAt: design.createdAt,
    spec: JSON.parse(design.specJson),
    report: JSON.parse(design.scoreJson),
    remixes: remixes.map((r) => ({ id: r.id, title: r.title, score: r.scoreTotal, url: `/d/${r.id}` })),
  });
}
