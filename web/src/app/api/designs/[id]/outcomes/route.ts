import { NextRequest, NextResponse } from "next/server";
import {
  getDesign,
  listOutcomes,
  addOutcome,
  countOutcomesSince,
  parseStoredJson,
  MAX_OUTCOMES_PER_DESIGN_PER_DAY,
} from "@/lib/db/queries";
import { readJsonBody, withinLimits } from "@/lib/cf";
import { voterHashFromHeaders } from "@/lib/voter";
import { apiError, corsPreflight, rateLimitResponse, withCors } from "@/lib/cors";
import { parseReceipt } from "@/lib/receipts";

export const dynamic = "force-dynamic";

const KINDS = new Set(["build", "quote", "test", "note"]);
const MAX_ID_LENGTH = 120;

/** GET /api/designs/[id]/outcomes — the recorded reality for this design. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const design = await getDesign(id);
  if (!design) return apiError("not found", 404);
  const rows = await listOutcomes(id);
  return withCors(
    NextResponse.json({
      designId: id,
      outcomes: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        summary: r.summary,
        data: parseStoredJson<unknown>(r.dataJson),
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
 *
 * It writes rows, so it is rate limited twice: per visitor, and per design, so no
 * single visitor can bury a design in junk whatever headers they send.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > MAX_ID_LENGTH) return apiError("bad design id", 400);

  const voter = await voterHashFromHeaders(req.headers);
  const tripped = await withinLimits([
    { key: `outcome:burst:${voter}`, limit: 5, windowSeconds: 60 },
    { key: `outcome:day:${voter}`, limit: 40, windowSeconds: 86_400 },
  ]);
  if (tripped) return rateLimitResponse(tripped);

  const design = await getDesign(id);
  if (!design) return apiError("not found", 404);

  const since = new Date(Date.now() - 86_400_000).toISOString();
  if ((await countOutcomesSince(id, since)) >= MAX_OUTCOMES_PER_DESIGN_PER_DAY) {
    return apiError(
      `this design already has ${MAX_OUTCOMES_PER_DESIGN_PER_DAY} outcome reports in the last 24 hours`,
      429,
    );
  }

  const body = await readJsonBody(req);
  if (!body.ok) return apiError(body.error, 400);
  const { kind: rawKind, summary: rawSummary, data, author } = body.value as {
    kind?: unknown;
    summary?: unknown;
    data?: unknown;
    author?: unknown;
  };

  const kind = typeof rawKind === "string" && KINDS.has(rawKind) ? rawKind : null;
  const summary = typeof rawSummary === "string" ? rawSummary.trim().slice(0, 1000) : "";
  if (!kind || !summary) {
    return apiError('kind must be one of "build"|"quote"|"test"|"note" and summary must be a non-empty string', 422);
  }

  // The data blob is the receipt: only recognised, validated fields are stored, and
  // they are stored as JSON so the numbers can be read back and aggregated.
  const receipt = parseReceipt(data);
  const row = await addOutcome({
    designId: id,
    kind,
    summary,
    dataJson: Object.keys(receipt).length ? JSON.stringify(receipt) : null,
    author: typeof author === "string" ? author.slice(0, 80) : "anonymous",
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
