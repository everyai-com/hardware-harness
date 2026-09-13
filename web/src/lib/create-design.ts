import { scoreSpec } from "@/lib/harness/score";
import type { ProductSpec } from "@/lib/harness/score";
import type { SpecInput } from "@/lib/spec-schema";
import { slugFor } from "@/lib/slug";
import { insertDesign } from "@/lib/db/queries";

export type CreatedDesign = { slug: string; scoreTotal: number; gatesPassed: boolean };

/**
 * Score a spec with the harness and publish it to the public gallery.
 * Shared by the /generate server action and the /api/designs agent endpoint.
 */
export async function createDesign(opts: {
  prompt?: string;
  spec: SpecInput;
  model: string | null;
  author?: string;
  remixOf?: string;
  category?: string;
}): Promise<CreatedDesign> {
  const spec = opts.spec;
  spec.costDisclosed = true; // the platform publishes the number, always
  if (!spec.producedBy) spec.producedBy = opts.model ?? "manual";

  const slug = await slugFor(spec.name);
  const report = scoreSpec(spec as unknown as ProductSpec);

  await insertDesign({
    id: slug,
    title: spec.name,
    prompt: opts.prompt ?? null,
    specJson: JSON.stringify(spec),
    scoreJson: JSON.stringify(report),
    scoreTotal: report.score.total,
    gatesPassed: report.gates.passed,
    modelUsed: opts.model,
    producedBy: spec.producedBy ?? null,
    remixOf: opts.remixOf ?? null,
    category: opts.category ?? null,
    author: opts.author ?? "anonymous",
    isPublic: true,
    createdAt: new Date().toISOString(),
  });

  return { slug, scoreTotal: report.score.total, gatesPassed: report.gates.passed };
}
