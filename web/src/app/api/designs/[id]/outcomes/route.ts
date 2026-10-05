import { NextRequest, NextResponse } from "next/server";
import { getDesign, listOutcomes, addOutcome } from "@/lib/db/queries";
import { withCors, corsPreflight } from "@/lib/cors";
import { rateLimit } from "@/lib/cf";
import { clientIp, readJsonObject } from "@/lib/request";

export const dynamic = "force-dynamic";

const KINDS = new Set(["build", "quote", "test", "note"]);
const MAX_DATA_CHARS = 8000;

/** Rows written before the size check may hold truncated JSON; show them as missing data rather than failing. */
function parseStoredJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

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
        data: parseStoredJson(r.dataJson),
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

  const read = await readJsonObject(req, 32 * 1024);
  if (!read.ok) return withCors(NextResponse.json({ error: read.error }, { status: read.status }));
  const body = read.body as { kind?: unknown; summary?: unknown; data?: unknown; author?: unknown };

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

  // Truncating serialized JSON stored invalid JSON and broke GET for the whole
  // design, so oversized data is refused instead.
  const dataJson = body.data !== undefined ? JSON.stringify(body.data) : null;
  if (dataJson !== null && dataJson.length > MAX_DATA_CHARS) {
    return withCors(
      NextResponse.json({ error: `data is too large (max ${MAX_DATA_CHARS} characters as JSON)` }, { status: 413 }),
    );
  }

  if (!(await rateLimit(`outcome:${clientIp(req.headers)}`, 30))) {
    return withCors(NextResponse.json({ error: "Daily limit of 30 outcome reports reached." }, { status: 429 }));
  }

  const row = await addOutcome({
    designId: id,
    kind,
    summary,
    dataJson,
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
