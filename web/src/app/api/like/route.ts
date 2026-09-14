import { NextRequest, NextResponse } from "next/server";
import { addVote } from "@/lib/db/queries";
import { voterHashFromHeaders } from "@/lib/voter";
import { withinLimits } from "@/lib/cf";
import { apiError, corsPreflight, rateLimitResponse, withCors } from "@/lib/cors";

export const dynamic = "force-dynamic";

/** Slugs are short; anything longer is junk and should not be written to the table. */
const MAX_ID_LENGTH = 120;

export async function POST(req: NextRequest) {
  const voter = await voterHashFromHeaders(req.headers);
  const tripped = await withinLimits([{ key: `like:${voter}`, limit: 60, windowSeconds: 3600 }]);
  if (tripped) return rateLimitResponse(tripped);

  let id: unknown;
  try {
    ({ id } = (await req.json()) as { id?: unknown });
  } catch {
    return apiError("invalid JSON body", 400);
  }
  if (typeof id !== "string" || !id || id.length > MAX_ID_LENGTH) {
    return apiError(`missing or oversized id (max ${MAX_ID_LENGTH} chars)`, 400);
  }

  const likes = await addVote(id, voter);
  if (likes === null) {
    // Either the visitor already voted, or the design does not exist. Both are a
    // no-op rather than a new row.
    return withCors(NextResponse.json({ likes: null, voted: false }));
  }
  return withCors(NextResponse.json({ likes, voted: true }));
}

export async function OPTIONS() {
  return corsPreflight();
}
