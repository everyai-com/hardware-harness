import { scoreSpec } from "@/lib/harness/score";
import type { ProductSpec } from "@/lib/harness/score";
import type { SpecInput } from "@/lib/spec-schema";
import { applyMuseDefaults } from "@/lib/muse-defaults";
import { slugFor } from "@/lib/slug";
import { insertDesign } from "@/lib/db/queries";
import { indexDesign, searchTextFor } from "@/lib/similar";
import { storeArtifacts } from "@/lib/artifacts";

export type CreatedDesign = { slug: string; scoreTotal: number; gatesPassed: boolean };

/**
 * Score a spec with the harness and publish it to the public gallery.
 * Shared by the /generate server action and the /api/designs agent endpoint.
 */
export async function createDesign(
  opts: {
    prompt?: string;
    spec: SpecInput;
    model: string | null;
    author?: string;
    remixOf?: string;
    category?: string;
  },
  progress?: { onStage?: (stage: "scoring" | "publishing") => void },
): Promise<CreatedDesign> {
  // Work on a copy: callers keep their input untouched.
  const base: SpecInput = structuredClone(opts.spec);
  base.costDisclosed = true; // the platform publishes the number, always
  applyMuseDefaults(base); // Wi-Fi pairing + radio filing are platform facts
  if (!base.producedBy) base.producedBy = opts.model ?? "manual";

  // The slug is the design's id everywhere (URL, R2 key, vector id, Muse kit
  // file names), so it is server-owned: a client-supplied spec.id is replaced.
  // slugFor only checks availability, so a concurrent publish can still take
  // the slug first; the insert reports that and we pick another.
  for (let attempt = 0; attempt < 3; attempt++) {
    progress?.onStage?.("scoring");
    const slug = await slugFor(base.name);
    const spec: SpecInput = { ...base, id: slug };
    const report = scoreSpec(spec as unknown as ProductSpec);
    const specJson = JSON.stringify(spec);
    const reportJson = JSON.stringify(report);
    progress?.onStage?.("publishing");

    const inserted = await insertDesign(designRow(slug, spec, specJson, reportJson, report, opts));
    if (!inserted) continue;

    // Search index: best-effort, never fails a publish. The text is short and
    // the call is one embedding plus one upsert.
    await indexDesign(slug, searchTextFor(spec)).catch(() => false);

    // Permanent artifacts in R2: the exact bytes that were scored.
    await storeArtifacts(slug, specJson, reportJson).catch(() => false);

    return { slug, scoreTotal: report.score.total, gatesPassed: report.gates.passed };
  }
  throw new Error("Could not find a free name for this design. Try again.");
}

function designRow(
  slug: string,
  spec: SpecInput,
  specJson: string,
  reportJson: string,
  report: ReturnType<typeof scoreSpec>,
  opts: { prompt?: string; model: string | null; author?: string; remixOf?: string; category?: string },
) {
  return {
    id: slug,
    title: spec.name,
    prompt: opts.prompt ?? null,
    specJson,
    scoreJson: reportJson,
    scoreTotal: report.score.total,
    gatesPassed: report.gates.passed,
    modelUsed: opts.model,
    producedBy: spec.producedBy ?? null,
    remixOf: opts.remixOf ?? null,
    category: opts.category ?? null,
    targetPlatform: spec.target?.platform ?? null,
    author: opts.author ?? "anonymous",
    isPublic: true,
    createdAt: new Date().toISOString(),
  };
}
