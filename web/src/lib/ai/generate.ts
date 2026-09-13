import { getEnv, aiModel } from "@/lib/cf";
import { specSchema, type SpecInput } from "@/lib/spec-schema";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SYSTEM_PROMPT = `You are the LUXO hardware design generator — the open-source alternative to Blueprint.io.
Given a product idea, output a single JSON object (no prose, no markdown fences) describing a buildable low-volume design.

Top-level fields:
- "name": short product name
- "intent": one sentence — what it is for
- "targetRetailUsd": number (optional)
- "targetQuantities": exactly [1, 100, 1000]
- "origin": "china" | "domestic" | "other"
- "power": { "mainsInside": boolean, "wireless": "none"|"bluetooth"|"wifi"|"lte"|"custom", "battery": "none"|"lithium"|"alkaline", "usbPowered": boolean }
- "features": array of { "id", "label", "expectedFace": "front"|"back"|"left"|"right"|"top"|"bottom"|"internal", "actualFace": same enum, "present": boolean, "cosmetic": boolean } — declare where each user-visible feature belongs (expectedFace) and where your design actually puts it (actualFace)
- "parts": array (rules below)
- "interfaces": array of { "id", "between": [partIdA, partIdB], "clearanceMm": number, "contributors": [partIds] }
- "operations": array of { "id", "label", "minutes": number, "improvised": false, "requiresSoldering"?: boolean, "wireCount"?: number }
- "cad": { "opensClean": true, "watertight": true, "requiresManualRepair": false, "ercClean": true, "drcClean": true } (only claim true if the design really satisfies it)
- "firmware": { "provided": boolean, "language", "toolchain", "builds": boolean, "testedOnHardware": boolean, "pinMapMatchesFootprints": boolean, "dependenciesPinned": boolean } (for electronic products)
- "costDisclosed": true
- "provenance": short string

Parts rules:
- Custom made parts: "kind": "custom", "process" one of ["fdm","resin_sla","sls_mjf","cnc_3axis","sheet_metal","injection_molding"], "material" (PLA, PETG, resin, AL6061, steel...), realistic "bboxMm" in millimetres, "qty".
- Bought parts (electronics, motors, fasteners): "kind": "catalog", "process": "pcb_assembly", "purchasePriceUsd" (realistic unit USD), "source": { "distributor": "lcsc" or "authorized", "mpn": a real part number, "inStock": true, "stockVerified": true, "alternates": 1 or more, "partType": one of ["mcu","regulator","analog_ic","passive","connector","led","motor","sensor","battery","mechanical","enclosure"] }.
- EVERY part — custom AND catalog — must include "bboxMm": { "x", "y", "z" } with the part's physical package size in millimetres.
- If electronics interconnect, include ONE custom "pcb_assembly" board part (e.g. a JLCPCB-assembled PCB) rather than loose hand-wired modules.
- FDM parts: "wallMm" >= 1.2, "toleranceMm" >= 0.5. Never promise mains voltage inside the product. Prefer USB power; if a battery is required, use "alkaline".
- Total part count (sum of qty) <= 15.
- Operations: realistic assembly steps with honest "minutes". Never set "improvised": true, never filing/deburring/epoxy-as-structure steps.

Output ONLY the JSON object.`;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function extractJson(text: string | undefined | null): unknown {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Workers AI chat models return `{ response: string }`, but some models and
 * streaming-ish variants hand back arrays of parts or nested objects. Normalise
 * them all to one string.
 */
function extractText(response: unknown): string | null {
  if (typeof response === "string") return response;
  if (Array.isArray(response)) {
    return response
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object") {
          const part = p as Record<string, unknown>;
          if (typeof part.text === "string") return part.text;
          if (typeof part.response === "string") return part.response;
        }
        return "";
      })
      .join("");
  }
  if (response && typeof response === "object") {
    const r = response as Record<string, unknown>;
    if (typeof r.response === "string") return r.response;
    if (typeof r.text === "string") return r.text;
    if (typeof r.content === "string") return r.content;
  }
  return null;
}

type AiResult = { spec: SpecInput; model: string } | { error: string };

export async function generateSpec(prompt: string): Promise<AiResult> {
  const env = getEnv();
  const model = aiModel() ?? DEFAULT_MODEL;
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];
  let lastIssues = "(none recorded)";

  for (let attempt = 0; attempt < 3; attempt++) {
    let out: unknown;
    try {
      out = await env.AI.run(model, {
        messages,
        max_tokens: 4096,
        temperature: 0.4,
      });
    } catch (e) {
      return { error: `Workers AI call failed: ${e instanceof Error ? e.message : String(e)}` };
    }

    // The chat wrapper returns { response }, where response may be the raw text
    // OR — when the model emits clean JSON — the parsed spec object itself.
    const resp = (out as { response?: unknown } | null)?.response ?? out;
    const candidate =
      typeof resp === "string"
        ? extractJson(resp)
        : Array.isArray(resp) || typeof resp === "object"
          ? resp
          : null;

    if (candidate === null) {
      const text = extractText(resp) ?? "";
      messages.push({ role: "assistant", content: text });
      messages.push({ role: "user", content: "That was not valid JSON. Return ONLY the JSON object." });
      continue;
    }

    const parsed = specSchema.safeParse(candidate);
    if (parsed.success) return { spec: parsed.data, model };

    const issues = parsed.error.issues
      .slice(0, 8)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    lastIssues = issues;
    const text = extractText(resp) ?? JSON.stringify(candidate).slice(0, 4000);
    messages.push({ role: "assistant", content: text });
    messages.push({ role: "user", content: `JSON validation failed: ${issues}. Return ONLY the corrected JSON object.` });
  }

  return { error: `The model could not produce a valid design spec after three attempts (last issues: ${lastIssues}). Try rephrasing the idea — or submit a spec JSON directly via the API.` };
}
