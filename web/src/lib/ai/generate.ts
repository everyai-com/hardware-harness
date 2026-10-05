import { getEnv, aiModel } from "@/lib/cf";
import { specSchema, type SpecInput } from "@/lib/spec-schema";
import { checkDFM } from "@/lib/harness/score";
import type { ProductSpec } from "@/lib/harness/score";
import { applyMuseDefaults } from "@/lib/muse-defaults";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SYSTEM_PROMPT = `You are the Blinky hardware design generator — the open-source alternative to Blueprint.io.
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
- "nets": array of electrical connections (for anything with electronics). Each: { "id", "name": e.g. "3V3_RAIL"/"I2C_SDA"/"USB_DP", "signal": "power"|"gnd"|"i2c"|"spi"|"uart"|"usb"|"gpio"|"analog"|"rf"|"other", "endpoints": [{ "part": partId, "pin": e.g. "GPIO4", "VCC", "D+" }], "voltage": number for power nets }. Every interconnect must appear as a net, including the power and ground rails.
- "operations": array of { "id", "label", "minutes": number, "improvised": false, "requiresSoldering"?: boolean, "wireCount"?: number }
- "cad": { "opensClean": true, "watertight": true, "requiresManualRepair": false, "ercClean": true, "drcClean": true } (only claim true if the design really satisfies it)
- "firmware": { "provided": boolean, "language", "toolchain", "builds": boolean, "testedOnHardware": boolean, "pinMapMatchesFootprints": boolean, "dependenciesPinned": boolean } (for electronic products)
- "target": OPTIONAL - include ONLY when the user asks for a device that runs the Muse Gadgets SDK (e.g. "a Muse gadget", "a device that pairs with Muse"). Shape: { "platform": "muse-gadgets", "sdk": "esp32" | "linux", "board": one id from the lists below, "capabilities": the board capabilities the design actually relies on }.
- "costDisclosed": true
- "provenance": short string

Muse Gadgets target rules:
- ESP32 boards (sdk "esp32"): esp32-c5-devkitc-1, ideaspark-esp32-1.9, sensecap-indicator, reterminal-e1001, reterminal-e1002, home-assistant-voice-pe, waveshare-esp32-s3-touch-amoled-1.75c, waveshare-esp32-s3-touch-amoled-1.75, esp32-s3-box-3, aipi-lite, waveshare-esp32-c6-touch-amoled-1.8, sensecap-watcher, m5stack-cardputer-adv, m5stack-sticks3, m5stack-stopwatch, m5stack-cores3, m5stack-stickc-plus2. Linux boards (sdk "linux"): raspberry-pi, linux-ble.
- Allowed capabilities: ["display","images","ui","touch","audio","push_to_talk","tunnel","battery_status","sensors","camera","ota"] for esp32; ["system_run","file_access","device_health"] for linux. Only declare a capability the design actually uses, and only ones the chosen board really has (e.g. no "images" or "tunnel" without PSRAM, "camera" only on sensecap-watcher).
- For sdk "esp32": firmware.toolchain must be exactly "ESP-IDF v6.0.1" (the only supported version) and the bill of materials must include the target board itself as a catalog part (partType "mcu"). For linux: no toolchain claim needed.
- A Muse gadget pairs over Wi-Fi: set "power": { "wireless": "wifi" } and include "fcc_radio" in "certificationsBudgeted".
- Source the target board and any MCU, regulator or analog part from an authorised distributor (DigiKey, Mouser, Arrow); use lcsc only for passives, connectors and mechanical parts.
- Never invent board ids. Quote a picker-provided board verbatim when given one.

Parts rules:
- Custom made parts: "kind": "custom", "process" one of ["fdm","resin_sla","sls_mjf","cnc_3axis","sheet_metal","injection_molding"], "material" (PLA, PETG, resin, AL6061, steel...), realistic "bboxMm" in millimetres, "qty".
- Bought parts (electronics, motors, fasteners): "kind": "catalog", "process": "pcb_assembly", "purchasePriceUsd" (realistic unit USD), "source": { "distributor": "lcsc" or "authorized", "mpn": a real part number, "inStock": true, "stockVerified": true, "alternates": 1 or more, "partType": one of ["mcu","regulator","analog_ic","passive","connector","led","motor","sensor","battery","mechanical","enclosure"] }.
- EVERY part — custom AND catalog — must include "bboxMm": { "x", "y", "z" } with the part's physical package size in millimetres.
- If electronics interconnect, include ONE custom "pcb_assembly" board part (e.g. a JLCPCB-assembled PCB) rather than loose hand-wired modules.
- FDM parts: "wallMm" >= 1.2, "toleranceMm" >= 0.5. Never promise mains voltage inside the product. Prefer USB power; if a battery is required, use "alkaline".
- Total part count (sum of qty) <= 15.
- Every part must literally use these keys: "id", "label", "kind", "process", "material", "qty", "bboxMm" - flat objects, no nesting, no renamed fields.
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

/** A target the user picked in the form - enforced, not left to the model. */
export type TargetRequest = { sdk: "esp32" | "linux"; board: string; label: string };

function targetConstraint(target: TargetRequest): string {
  if (target.sdk === "linux") {
    return `\n\nRequired target platform: Muse Gadgets SDK - Linux. Set "target" to exactly { "platform": "muse-gadgets", "sdk": "linux", "board": "${target.board}" } (${target.label}).`;
  }
  return `\n\nRequired target platform: Muse Gadgets SDK - ESP32, board "${target.board}" (${target.label}). Set "target" to exactly that board id, and set firmware.toolchain to "ESP-IDF v6.0.1". The bill of materials must include the board itself as a catalog part (partType "mcu").`;
}

/** Login-shaped failures get the fix, not the stack. */
function friendlyAiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/auth|login|unauthori|forbidden|token|credential|api key|401|403/i.test(msg)) {
    return `Workers AI needs a Cloudflare login for local generation — run \`npx wrangler login\` and retry (it may incur usage charges). Scoring, browsing and the API work fully offline. Details: ${msg}`;
  }
  return `Workers AI call failed: ${msg}`;
}

export type SpecProgress = { onAttempt?: (attempt: number) => void };

export async function generateSpec(
  prompt: string,
  target?: TargetRequest,
  progress?: SpecProgress,
): Promise<AiResult> {
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      error: `Cloudflare bindings are not available in this environment (${msg}). In local dev, restart \`npm run dev\`; scoring, browsing and the API work fully offline.`,
    };
  }
  const model = aiModel() ?? DEFAULT_MODEL;
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: target ? `${prompt}${targetConstraint(target)}` : prompt },
  ];
  return runSpecLoop(env, model, messages, target, "the idea", progress?.onAttempt);
}

/**
 * Revise an existing spec from a plain-words change request. Same format
 * rules as generation (the model sees the full format prompt), same
 * validation and repair loop — the output is a complete replacement spec,
 * published as a remix of the original.
 */
export async function refineSpec(
  original: SpecInput,
  request: string,
  target?: TargetRequest,
  progress?: SpecProgress,
): Promise<AiResult> {
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      error: `Cloudflare bindings are not available in this environment (${msg}). In local dev, restart \`npm run dev\`.`,
    };
  }
  const model = aiModel() ?? DEFAULT_MODEL;
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\nREVISION MODE: the user message contains a complete design spec plus a change request. Keep everything the request does not touch — same parts, same processes, same power — and revise only what the request asks for. Output the COMPLETE revised spec as one JSON object (never a diff, never a fragment). If the request contradicts the format rules above (e.g. asks for mains voltage inside), follow the format rules and note the refusal in "provenance".`,
    },
    {
      role: "user",
      content: `Current spec:\n${JSON.stringify(original).slice(0, 12000)}\n\nChange request: ${request.slice(0, 1000)}${target ? targetConstraint(target) : ""}\n\nReturn ONLY the revised JSON object.`,
    },
  ];
  return runSpecLoop(env, model, messages, target, "the change request", progress?.onAttempt);
}

/** Three attempts: model output → validate → repair hints → retry. Shared by generate and refine. */
async function runSpecLoop(
  env: ReturnType<typeof getEnv>,
  model: string,
  messages: ChatMessage[],
  target: TargetRequest | undefined,
  retryNoun: string,
  onAttempt?: (attempt: number) => void,
): Promise<AiResult> {
  let lastIssues = "(none recorded)";

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      onAttempt?.(attempt + 1);
    } catch {
      /* progress reporting never fails a run */
    }
    let out: unknown;
    try {
      out = await env.AI.run(model, {
        messages,
        max_tokens: 4096,
        temperature: 0.4,
      });
    } catch (e) {
      return { error: friendlyAiError(e) };
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
    if (parsed.success) {
      // Honest claims: a generated design has never been flashed or built, so
      // "tested on hardware" is false by construction - not whatever the model
      // decided would look good.
      if (parsed.data.firmware) parsed.data.firmware.testedOnHardware = false;
      // Platform facts for Muse gadgets (Wi-Fi pairing, radio filing).
      applyMuseDefaults(parsed.data);

      // A targeted design gets one repair round against the harness: the model
      // can produce valid JSON and still miss the board part, the pinned
      // toolchain, or claim a capability the board does not have. Fix it before
      // it is ever published; after the final attempt, accept with findings
      // rather than failing the generation.
      if (target) {
        const issues = targetIssues(parsed.data);
        if (issues.length && attempt < 2) {
          lastIssues = issues.join(" ");
          messages.push({ role: "assistant", content: JSON.stringify(parsed.data).slice(0, 6000) });
          messages.push({
            role: "user",
            content: `The harness rejected the target claim: ${issues.join(" ")} Return ONLY the corrected JSON object.`,
          });
          continue;
        }
      }
      return { spec: parsed.data, model };
    }

    const issues = parsed.error.issues
      .slice(0, 8)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    lastIssues = issues;
    const text = extractText(resp) ?? JSON.stringify(candidate).slice(0, 4000);
    messages.push({ role: "assistant", content: text });
    messages.push({ role: "user", content: `JSON validation failed: ${issues}. Return ONLY the corrected JSON object.` });
  }

  return { error: `The model could not produce a valid design spec after three attempts (last issues: ${lastIssues}). Try rephrasing ${retryNoun} — or submit a spec JSON directly via the API.` };
}

/** Platform findings worth one repair round: blocking, and the fix is a rewrite the model can do. */
function targetIssues(spec: SpecInput): string[] {
  return checkDFM(spec as unknown as ProductSpec)
    .filter((f) => f.ruleId.startsWith("TARGET_") || f.ruleId === "FIRMWARE_MISSING" || f.ruleId === "CERT_GAP")
    .slice(0, 4)
    .map((f) => `${f.message} ${f.fix}`);
}
