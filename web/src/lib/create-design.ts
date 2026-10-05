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
  const spec = opts.spec;
  spec.costDisclosed = true; // the platform publishes the number, always
  applyMuseDefaults(spec); // Wi-Fi pairing + radio filing are platform facts
  if (!spec.producedBy) spec.producedBy = opts.model ?? "manual";

  progress?.onStage?.("scoring");
  const slug = await slugFor(spec.name);
  const report = scoreSpec(spec as unknown as ProductSpec);
  const specJson = JSON.stringify(spec);
  const reportJson = JSON.stringify(report);
  progress?.onStage?.("publishing");

  await insertDesign({
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
  });

  // Search index: best-effort, never fails a publish. The text is short and
  // the call is one embedding plus one upsert.
  await indexDesign(slug, searchTextFor(spec)).catch(() => false);

  // Permanent artifacts in R2: the exact bytes that were scored.
  await storeArtifacts(slug, specJson, reportJson).catch(() => false);

  return { slug, scoreTotal: report.score.total, gatesPassed: report.gates.passed };
}
