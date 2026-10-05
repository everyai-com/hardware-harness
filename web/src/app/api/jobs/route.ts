import { NextRequest, NextResponse } from "next/server";
import { createJob } from "@/lib/db/queries";
import { runGenerateJob, runRefineJob } from "@/lib/jobs";
import type { TargetRequest } from "@/lib/ai/generate";
import { MUSE_BOARDS, MUSE_LINUX } from "@/lib/harness/score";
import { rateLimit } from "@/lib/cf";
import { turnstileEnabled, verifyTurnstile } from "@/lib/turnstile";
import { withCors, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

type JobBody = {
  type?: unknown;
  prompt?: unknown;
  targetSdk?: unknown;
  targetBoard?: unknown;
  remixOf?: unknown;
  designId?: unknown;
  request?: unknown;
  turnstileToken?: unknown;
};

/**
 * POST /api/jobs — start an AI generate/refine run with live stages.
 * Returns text/event-stream: `{"stage":"drafting"}` … then a terminal
 * `{"done":true,"slug","url"}` or `{"done":true,"error"}`. The same run is
 * recorded in D1 — poll GET /api/jobs/[id] instead if you prefer polling.
 */
export async function POST(req: NextRequest) {
  let body: JobBody;
  try {
    body = (await req.json()) as JobBody;
  } catch {
    return withCors(NextResponse.json({ error: "invalid JSON body" }, { status: 400 }));
  }

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "local";
  if (turnstileEnabled() && !(await verifyTurnstile(body.turnstileToken, ip))) {
    return withCors(NextResponse.json({ error: "Bot verification failed or expired." }, { status: 403 }));
  }

  if (body.type === "generate") {
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 10) {
      return withCors(
        NextResponse.json({ error: "Describe the thing you want to build — one sentence at least." }, { status: 422 }),
      );
    }
    const sdk = typeof body.targetSdk === "string" ? body.targetSdk : "";
    const boardId = typeof body.targetBoard === "string" ? body.targetBoard : "";
    let target: TargetRequest | undefined;
    if (sdk === "esp32") {
      const board = MUSE_BOARDS[boardId];
      if (!board) return withCors(NextResponse.json({ error: `Unknown Muse Gadget board '${boardId}'.` }, { status: 422 }));
      target = { sdk: "esp32", board: board.id, label: board.label };
    } else if (sdk === "linux") {
      const board = MUSE_LINUX.boards.find((b) => b.id === boardId);
      if (!board) return withCors(NextResponse.json({ error: `Unknown Linux target '${boardId}'.` }, { status: 422 }));
      target = { sdk: "linux", board: board.id, label: board.label };
    } else if (sdk) {
      return withCors(NextResponse.json({ error: `Unknown target platform '${sdk}'.` }, { status: 422 }));
    }
    const remixOf = typeof body.remixOf === "string" && body.remixOf ? body.remixOf : undefined;

    if (!(await rateLimit(`gen:${ip}`, 10))) {
      return withCors(
        NextResponse.json(
          { error: "Daily limit of 10 generations reached. Blinky is open source — self-host it for unlimited, or come back tomorrow." },
          { status: 429 },
        ),
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await createJob({
      id,
      type: "generate",
      status: "queued",
      stage: "queued",
      payloadJson: JSON.stringify({ prompt, target, remixOf }),
      createdAt: now,
      updatedAt: now,
    });
    return streamJob(id, (send) => runGenerateJob(id, { prompt, target, remixOf }, send));
  }

  if (body.type === "refine") {
    const designId = typeof body.designId === "string" ? body.designId : "";
    const request = typeof body.request === "string" ? body.request.trim() : "";
    if (!designId) return withCors(NextResponse.json({ error: "designId is required." }, { status: 422 }));
    if (request.length < 5) {
      return withCors(NextResponse.json({ error: "Say what should change — one sentence at least." }, { status: 422 }));
    }

    if (!(await rateLimit(`refine:${ip}`, 10))) {
      return withCors(
        NextResponse.json(
          { error: "Daily limit of 10 refinements reached. Blinky is open source — self-host it for unlimited, or come back tomorrow." },
          { status: 429 },
        ),
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await createJob({
      id,
      type: "refine",
      status: "queued",
      stage: "queued",
      payloadJson: JSON.stringify({ designId, request }),
      createdAt: now,
      updatedAt: now,
    });
    return streamJob(id, (send) => runRefineJob(id, { designId, request }, send));
  }

  return withCors(NextResponse.json({ error: 'type must be "generate" or "refine".' }, { status: 400 }));
}

function streamJob(id: string, run: (send: (stage: string) => void) => Promise<{ slug: string } | { error: string }>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (stage: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id, stage })}\n\n`));
      };
      try {
        const out = await run(send);
        const payload =
          "slug" in out
            ? { id, done: true, slug: out.slug, url: `/d/${out.slug}` }
            : { id, done: true, error: out.error };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id, done: true, error: "Job failed." })}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return corsPreflight();
}
