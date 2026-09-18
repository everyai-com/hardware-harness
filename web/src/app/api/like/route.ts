import { NextRequest, NextResponse } from "next/server";
import { addVote } from "@/lib/db/queries";
import { voterHashFromHeaders } from "@/lib/voter";
import { withCors, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let id: string | undefined;
  try {
    ({ id } = (await req.json()) as { id?: string });
  } catch {
    return withCors(NextResponse.json({ error: "invalid JSON body" }, { status: 400 }));
  }
  if (!id) return withCors(NextResponse.json({ error: "missing id" }, { status: 400 }));

  const vh = await voterHashFromHeaders(req.headers);
  const likes = await addVote(id, vh);
  if (likes === null) {
    return withCors(NextResponse.json({ likes: null, voted: false }));
  }
  return withCors(NextResponse.json({ likes, voted: true }));
}

export async function OPTIONS() {
  return corsPreflight();
}
