"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getEnv, aiModel, rateLimit } from "@/lib/cf";
import { generateSpec, unwrapAiResponse } from "@/lib/ai/generate";
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

/**
 * Blueprint-style clarifying questions: up to 3 short questions whose answers
 * most change the design. Best-effort — any failure returns [] and the
 * generator proceeds with the prompt as-is.
 */
export async function clarifyAction(prompt: string): Promise<{ questions: string[] }> {
  if (prompt.trim().length < 5) return { questions: [] };
  try {
    const env = getEnv();
    const out = (await env.AI.run(aiModel(), {
      messages: [
        {
          role: "system",
          content:
            'You are a hardware design assistant. Given a product idea, ask up to 3 short clarifying questions whose answers most change the design (power source, size, key components, budget, connectivity). Output ONLY a JSON array of strings, e.g. ["How is it powered?","What size?"]. If the idea is already fully specified, output [].',
        },
        { role: "user", content: prompt.slice(0, 500) },
      ],
      max_tokens: 800,
      temperature: 0.3,
      reasoning_effort: "low",
    } as never)) as unknown;

    const resp = unwrapAiResponse(out);
    const text = typeof resp === "string" ? resp : JSON.stringify(resp);
    const m = text.match(/\[[\s\S]*?\]/);
    if (!m) return { questions: [] };
    const parsed: unknown = JSON.parse(m[0]);
    if (!Array.isArray(parsed)) return { questions: [] };
    return { questions: parsed.filter((q): q is string => typeof q === "string" && q.length > 3).slice(0, 3) };
  } catch {
    return { questions: [] };
  }
}
