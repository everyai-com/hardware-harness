import { scoreSpec } from "@/lib/harness/score";
import type { ProductSpec } from "@/lib/harness/score";
import type { SpecInput } from "@/lib/spec-schema";
import { slugFor } from "@/lib/slug";
import { insertDesign } from "@/lib/db/queries";

export type CreatedDesign = { slug: string; scoreTotal: number; gatesPassed: boolean };

/** How many slug collisions to absorb before giving up. */
const SLUG_ATTEMPTS = 4;

/**
 * Score a spec with the harness and publish it to the public gallery.
 * Shared by the /generate server action and the /api/designs agent endpoint.
 *
 * The insert is verified. An earlier version used a bare `onConflictDoNothing()`
 * and returned 201 regardless, so a slug race produced a published design that
 * 404'd — a silent success is worse than an error.
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
  // Only record a producer when a model actually produced it. The old "manual"
  // placeholder shadowed the author on every card, so an agent that signed its
  // upload was still displayed as "by manual".
  if (!spec.producedBy && opts.model) spec.producedBy = opts.model;

  const report = scoreSpec(spec as unknown as ProductSpec);

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const slug = await slugFor(spec.name);
    const stored = await insertDesign({
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
    // slugFor() checks the table, but two publishes can race between check and
    // insert. Losing that race means retrying with a new slug, not returning it.
    if (stored) return { slug, scoreTotal: report.score.total, gatesPassed: report.gates.passed };
  }

  throw new Error(
    `Could not allocate a unique slug for "${spec.name}" after ${SLUG_ATTEMPTS} attempts. Retry, or rename the design.`,
  );
}
