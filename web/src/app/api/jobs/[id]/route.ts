import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/db/queries";
import { withCors, corsPreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/[id] — job status for pollers: status queued|running|done|failed,
 * the current stage, and the result slug (or error) when finished.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return withCors(NextResponse.json({ error: "not found" }, { status: 404 }));
  return withCors(
    NextResponse.json({
      id: job.id,
      type: job.type,
      status: job.status,
      stage: job.stage,
      slug: job.resultSlug,
      url: job.resultSlug ? `/d/${job.resultSlug}` : null,
      error: job.error,
      updatedAt: job.updatedAt,
    }),
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
