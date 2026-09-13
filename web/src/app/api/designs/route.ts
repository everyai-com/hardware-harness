import { NextRequest, NextResponse } from "next/server";
import { specSchema } from "@/lib/spec-schema";
import { createDesign } from "@/lib/create-design";
import { listDesigns } from "@/lib/db/queries";
import { rateLimit } from "@/lib/cf";
import { voterHashFromHeaders } from "@/lib/voter";
import { withCors, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

/**
 * GET /api/designs — recent public designs (agent-friendly leaderboard feed).
 */
export async function GET(req: NextRequest) {
  const sort = (req.nextUrl.searchParams.get("sort") ?? "new") as "new" | "score" | "likes";
  const designs = await listDesigns(sort, 50);
  return withCors(
    NextResponse.json({
      designs: designs.map((d) => ({
        id: d.id,
        title: d.title,
        score: d.scoreTotal,
        gatesPassed: d.gatesPassed,
        producedBy: d.producedBy,
        remixOf: d.remixOf,
        createdAt: d.createdAt,
        url: `/d/${d.id}`,
      })),
    }),
  );
}

/**
 * POST /api/designs — "push to hub": validate a spec, score it with the
 * harness, and publish it into the public gallery. Returns the share URL.
 * Body: { spec: ProductSpec, prompt?, author?, remixOf? }
 */
export async function POST(req: NextRequest) {
  const vh = await voterHashFromHeaders(req.headers);
  // 20 publishes per visitor per day — agents included. Score-only /api/evaluate stays unlimited.
  if (!(await rateLimit(`publish:${vh}`, 20))) {
    return withCors(
      NextResponse.json(
        { error: "Daily limit of 20 published designs reached. /api/evaluate is unlimited; self-host for unlimited publishes." },
        { status: 429 },
      ),
    );
  }

  let body: { spec?: unknown; prompt?: unknown; author?: unknown; remixOf?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors(NextResponse.json({ error: "invalid JSON body" }, { status: 400 }));
  }

  const parsed = specSchema.safeParse(body.spec);
  if (!parsed.success) {
    return withCors(
      NextResponse.json(
        { error: "spec failed validation", issues: parsed.error.issues.slice(0, 20) },
        { status: 422 },
      ),
    );
  }

  const created = await createDesign({
    prompt: typeof body.prompt === "string" ? body.prompt : undefined,
    spec: parsed.data,
    model: null,
    author: typeof body.author === "string" ? body.author.slice(0, 80) : "agent",
    remixOf: typeof body.remixOf === "string" ? body.remixOf : undefined,
  });

  return withCors(
    NextResponse.json(
      {
        slug: created.slug,
        score: created.scoreTotal,
        gatesPassed: created.gatesPassed,
        url: `/d/${created.slug}`,
      },
      { status: 201 },
    ),
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
