import { NextRequest, NextResponse } from "next/server";
import { getDesign, listOutcomes, addOutcome } from "@/lib/db/queries";
import { withCors, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

const KINDS = new Set(["build", "quote", "test", "note"]);

/** GET /api/designs/[id]/outcomes — the recorded reality for this design. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const design = await getDesign(id);
  if (!design) return withCors(NextResponse.json({ error: "not found" }, { status: 404 }));
  const rows = await listOutcomes(id);
  return withCors(
    NextResponse.json({
      designId: id,
      outcomes: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        summary: r.summary,
        data: r.dataJson ? JSON.parse(r.dataJson) : null,
        author: r.author,
        createdAt: r.createdAt,
      })),
    }),
  );
}

/**
 * POST /api/designs/[id]/outcomes — record reality against a design.
 * Body: { kind: "build"|"quote"|"test"|"note", summary, data?, author? }
 * This is the score -> build -> ACTUALS loop: the thing that turns the
 * ±40% estimate into ±10%.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const design = await getDesign(id);
  if (!design) return withCors(NextResponse.json({ error: "not found" }, { status: 404 }));

  let body: { kind?: unknown; summary?: unknown; data?: unknown; author?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors(NextResponse.json({ error: "invalid JSON body" }, { status: 400 }));
  }

  const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : null;
  const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 1000) : "";
  if (!kind || !summary) {
    return withCors(
      NextResponse.json(
        { error: 'kind must be one of "build"|"quote"|"test"|"note" and summary must be a non-empty string' },
        { status: 422 },
      ),
    );
  }

  const row = await addOutcome({
    designId: id,
    kind,
    summary,
    dataJson: body.data !== undefined ? JSON.stringify(body.data).slice(0, 8000) : null,
    author: typeof body.author === "string" ? body.author.slice(0, 80) : "anonymous",
    createdAt: new Date().toISOString(),
  });

  return withCors(
    NextResponse.json(
      { id: row.id, designId: id, kind: row.kind, summary: row.summary, createdAt: row.createdAt },
      { status: 201 },
    ),
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
