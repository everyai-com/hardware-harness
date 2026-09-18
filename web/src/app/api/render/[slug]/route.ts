import { NextResponse } from "next/server";
import { getDesign } from "@/lib/db/queries";
import { ensureRender, readRender } from "@/lib/render";
import type { ProductSpec } from "@/lib/harness/score";

export const dynamic = "force-dynamic";

/**
 * GET /api/render/[slug] — the design's reference render.
 * Generated on first request and then served from R2, so every design in the
 * gallery has an image without a separate upload step.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const design = await getDesign(slug);
  if (!design) return new NextResponse("Not found", { status: 404 });

  const spec = JSON.parse(design.specJson) as ProductSpec;
  const ensured = await ensureRender(slug, spec);
  if ("error" in ensured) return new NextResponse(ensured.error, { status: 502 });

  const object = await readRender(ensured.key);
  if (!object) return new NextResponse("Render missing", { status: 404 });

  return new NextResponse(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
