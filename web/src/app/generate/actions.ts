"use server";

import { headers } from "next/headers";
import { getEnv, aiModel, rateLimit } from "@/lib/cf";

export type GenerateState = { error: string | null };

/**
 * Blueprint-style clarifying questions: up to 3 short questions whose answers
 * most change the design. Best-effort — any failure returns [] and the
 * generator proceeds with the prompt as-is.
 */
export async function clarifyAction(prompt: string): Promise<{ questions: string[] }> {
  if (prompt.trim().length < 5) return { questions: [] };
  try {
    // Best-effort endpoint, but each call burns AI quota — cap it per visitor.
    const h = await headers();
    const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "local";
    if (!(await rateLimit(`clarify:${ip}`, 30))) return { questions: [] };

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
      max_tokens: 300,
      temperature: 0.3,
    })) as unknown;

    const resp = (out as { response?: unknown } | null)?.response ?? out;
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
