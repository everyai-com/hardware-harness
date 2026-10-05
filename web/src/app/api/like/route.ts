import { NextRequest, NextResponse } from "next/server";
import { addVote, getDesign } from "@/lib/db/queries";
import { rateLimit } from "@/lib/cf";
import { voterHashFromHeaders } from "@/lib/voter";
import { clientIp, readJsonObject } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const read = await readJsonObject(req, 4096);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status });
  const id = read.body.id;
  if (typeof id !== "string" || !id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const design = await getDesign(id);
  if (!design) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Votes dedupe per browser (IP + UA); the IP cap stops a script from
  // rotating User-Agents to stuff one design's count.
  if (!(await rateLimit(`like:${clientIp(req.headers)}`, 100))) {
    return NextResponse.json({ likes: design.likes, voted: false }, { status: 429 });
  }

  const vh = await voterHashFromHeaders(req.headers);
  const likes = await addVote(id, vh);
  if (likes === null) {
    // Already voted — still report the current count, not null.
    return NextResponse.json({ likes: design.likes, voted: false });
  }
  return NextResponse.json({ likes, voted: true });
}
