"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getDesign, addOutcome } from "@/lib/db/queries";
import { rateLimit } from "@/lib/cf";

const KINDS = new Set(["build", "quote", "test", "note"]);

export type OutcomeState = { error: string | null; ok: boolean };

/**
 * Record reality against a design from the UI. Mirrors the validation in
 * POST /api/designs/[id]/outcomes so the human and agent paths agree.
 */
export async function addOutcomeAction(input: {
  designId: string;
  kind: string;
  summary: string;
  author: string;
}): Promise<OutcomeState> {
  const design = await getDesign(input.designId);
  if (!design) return { error: "Design not found.", ok: false };

  const kind = KINDS.has(input.kind) ? input.kind : null;
  const summary = input.summary.trim();
  if (!kind) return { error: "Pick what kind of record this is.", ok: false };
  if (summary.length < 3) return { error: "Say what you actually measured or built.", ok: false };

  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "local";
  if (!(await rateLimit(`outcome:${ip}`, 20))) {
    return {
      error:
        "Daily limit of 20 records reached. The API stays open — POST /api/designs/[id]/outcomes.",
      ok: false,
    };
  }

  await addOutcome({
    designId: input.designId,
    kind,
    summary: summary.slice(0, 1000),
    dataJson: null,
    author: input.author.trim().slice(0, 80) || "anonymous",
    createdAt: new Date().toISOString(),
  });

  revalidatePath(`/d/${input.designId}`);
  return { error: null, ok: true };
}
