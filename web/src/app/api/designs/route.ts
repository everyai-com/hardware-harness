import { NextRequest, NextResponse } from "next/server";
import { specSchema } from "@/lib/spec-schema";
import { createDesign } from "@/lib/create-design";
import { pageDesigns, parseSort, PAGE_SIZE } from "@/lib/db/queries";
import { readJsonBody, withinLimits } from "@/lib/cf";
import { voterHashFromHeaders } from "@/lib/voter";
import { apiError, corsPreflight, rateLimitResponse, withCors } from "@/lib/cors";

export const dynamic = "force-dynamic";

/**
 * GET /api/designs?sort=new|score|likes&page=1&pageSize=24&q=&gates=pass|fail — the gallery as JSON.
 * Paginated: the earlier version silently capped at 50, so anything older than the
 * cap was unreachable through the API and through the gallery.
 */
export async function GET(req: NextRequest) {
  const sort = parseSort(req.nextUrl.searchParams.get("sort"));
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(req.nextUrl.searchParams.get("pageSize") ?? String(PAGE_SIZE)) || PAGE_SIZE;
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 120) || undefined;
  const gatesParam = req.nextUrl.searchParams.get("gates");
  const gates = gatesParam === "pass" || gatesParam === "fail" ? gatesParam : undefined;

  const result = await pageDesigns(sort, page, pageSize, { q, gates });

  return withCors(
    NextResponse.json({
      designs: result.designs.map((d) => ({
        id: d.id,
        title: d.title,
        score: d.scoreTotal,
        gatesPassed: d.gatesPassed,
        producedBy: d.producedBy,
        remixOf: d.remixOf,
        likes: d.likes,
        views: d.views,
        createdAt: d.createdAt,
        url: `/d/${d.id}`,
      })),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      hasMore: result.hasMore,
      sort,
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
  // Publishes write rows and run the engine, so they get a burst limit and a daily
  // quota. /api/evaluate stays generous for agents that only want a score.
  const tripped = await withinLimits([
    { key: `publish:burst:${vh}`, limit: 5, windowSeconds: 60 },
    { key: `publish:day:${vh}`, limit: 20, windowSeconds: 86_400 },
  ]);
  if (tripped) return rateLimitResponse(tripped);

  const body = await readJsonBody(req);
  if (!body.ok) return apiError(body.error, 400);
  const { spec, prompt, author, remixOf } = body.value as {
    spec?: unknown;
    prompt?: unknown;
    author?: unknown;
    remixOf?: unknown;
  };

  const parsed = specSchema.safeParse(spec);
  if (!parsed.success) {
    return apiError("spec failed validation", 422, { issues: parsed.error.issues.slice(0, 20) });
  }

  try {
    const created = await createDesign({
      prompt: typeof prompt === "string" ? prompt.slice(0, 2000) : undefined,
      spec: parsed.data,
      model: null,
      author: typeof author === "string" ? author.slice(0, 80) : "agent",
      remixOf: typeof remixOf === "string" ? remixOf.slice(0, 120) : undefined,
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
  } catch (e) {
    // A publish that did not land must not report success.
    console.error("createDesign failed:", e instanceof Error ? e.stack : e);
    return apiError("could not publish the design — retry shortly", 503);
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
