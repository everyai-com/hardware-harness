"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/cf";
import { generateSpec } from "@/lib/ai/generate";
import { createDesign } from "@/lib/create-design";

export type GenerateState = { error: string | null };

export async function generateAction(formData: FormData): Promise<GenerateState> {
  const prompt = String(formData.get("prompt") ?? "").trim();
  const remixOf = String(formData.get("remixOf") ?? "").trim() || undefined;

  if (prompt.length < 10) {
    return { error: "Describe the thing you want to build — one sentence at least." };
  }

  try {
    const h = await headers();
    const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "local";
    if (!(await rateLimit(`gen:${ip}`, 10))) {
      return { error: "Daily limit of 10 generations reached. LUXO is open source — self-host it for unlimited, or come back tomorrow." };
    }

    const result = await generateSpec(prompt);
    if ("error" in result) return { error: result.error };

    const created = await createDesign({ prompt, spec: result.spec, model: result.model, remixOf });
    redirect(`/d/${created.slug}`);
  } catch (e) {
    // redirect() throws a control-flow error — rethrow so the client navigates.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("generateAction failed:", e instanceof Error ? e.stack : e);
    return { error: e instanceof Error ? e.message : "Generation failed — check the worker logs." };
  }
}
