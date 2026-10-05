import { NextResponse } from "next/server";
import { getDesign } from "@/lib/db/queries";
import { withCors, corsPreflight } from "@/lib/cors";
import { buildMuseScaffold } from "@/lib/harness/score";
import type { ProductSpec } from "@/lib/harness/score";
import { zipMuseKit } from "@/lib/muse-zip";

export const dynamic = "force-dynamic";

/**
 * GET /api/designs/[id]/muse — the Muse Gadgets build kit for a targeted design.
 * JSON by default (board, capability check, exact commands, notes);
 * `?format=zip` downloads sdkconfig overlay + README + design.json + setup.sh.
 * Same engine as the CLI and the design page: one builder, three surfaces.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const design = await getDesign(id);
  if (!design) return withCors(NextResponse.json({ error: "not found" }, { status: 404 }));

  const spec = JSON.parse(design.specJson) as ProductSpec;
  let scaffold;
  try {
    scaffold = buildMuseScaffold(spec);
  } catch (e) {
    return withCors(
      NextResponse.json(
        { error: e instanceof Error ? e.message : "This design has no Muse Gadgets target." },
        { status: 400 },
      ),
    );
  }

  if (new URL(req.url).searchParams.get("format") === "zip") {
    const zip = zipMuseKit(scaffold.files, `muse-gadget-${id}`);
    const res = new NextResponse(zip as unknown as BodyInit, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="muse-gadget-${id}.zip"`,
      },
    });
    return withCors(res);
  }

  return withCors(
    NextResponse.json({
      design: { id: design.id, title: design.title, url: `/d/${design.id}` },
      ...scaffold,
    }),
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
