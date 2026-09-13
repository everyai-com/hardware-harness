import { NextRequest, NextResponse } from "next/server";
import { addVote } from "@/lib/db/queries";
import { voterHashFromHeaders } from "@/lib/voter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let id: string | undefined;
  try {
    ({ id } = (await req.json()) as { id?: string });
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const vh = await voterHashFromHeaders(req.headers);
  const likes = await addVote(id, vh);
  if (likes === null) {
    return NextResponse.json({ likes: null, voted: false });
  }
  return NextResponse.json({ likes, voted: true });
}
