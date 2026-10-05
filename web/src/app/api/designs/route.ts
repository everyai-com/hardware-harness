import { NextRequest, NextResponse } from "next/server";
import { specSchema } from "@/lib/spec-schema";
import { createDesign } from "@/lib/create-design";
import { getDesign, listDesigns } from "@/lib/db/queries";
import { rateLimit } from "@/lib/cf";
import { turnstileEnabled, verifyTurnstile } from "@/lib/turnstile";
import { clientIp, readJsonObject, MAX_PROMPT_CHARS } from "@/lib/request";
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
 * Body: { spec: ProductSpec, prompt?, author?, remixOf?, turnstileToken? }
 * (turnstileToken is required only when the deployment enables Turnstile.)
 */
export async function POST(req: NextRequest) {
  const read = await readJsonObject(req);
  if (!read.ok) return withCors(NextResponse.json({ error: read.error }, { status: read.status }));
  const body = read.body as { spec?: unknown; prompt?: unknown; author?: unknown; remixOf?: unknown; turnstileToken?: unknown };

  const ip = clientIp(req.headers);
  if (turnstileEnabled()) {
    if (!(await verifyTurnstile(body.turnstileToken, ip))) {
      return withCors(NextResponse.json({ error: "Bot verification failed or expired." }, { status: 403 }));
    }
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

  const remixOf = typeof body.remixOf === "string" && body.remixOf ? body.remixOf : undefined;
  if (remixOf && !(await getDesign(remixOf))) {
    return withCors(NextResponse.json({ error: `remixOf '${remixOf}' is not a published design` }, { status: 422 }));
  }

  // Charged only for a publish that will go through, so agents iterating on
  // 422 issues don't burn their quota. 20 per IP per day, agents included.
  // Score-only /api/evaluate stays unlimited.
  if (!(await rateLimit(`publish:${ip}`, 20))) {
    return withCors(
      NextResponse.json(
        { error: "Daily limit of 20 published designs reached. /api/evaluate is unlimited; self-host for unlimited publishes." },
        { status: 429 },
      ),
    );
  }

  const created = await createDesign({
    prompt: typeof body.prompt === "string" ? body.prompt.slice(0, MAX_PROMPT_CHARS) : undefined,
    spec: parsed.data,
    model: null,
    author: typeof body.author === "string" ? body.author.slice(0, 80) : "agent",
    remixOf,
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
