import { getEnv, imageModel } from "@/lib/cf";

/** Product-shot framing: what the gallery leads with, and what the specs are judged against. */
const RENDER_WIDTH = 1024;
const RENDER_HEIGHT = 768;

export type GeneratedImage = { bytes: Uint8Array; contentType: string } | { error: string };

/**
 * A prompt for the reference render. Kept deliberately plain: the point of the
 * image is to show what the design claims to be, not to flatter it.
 */
export function renderPromptFor(spec: { name: string; intent: string }): string {
  return [
    spec.name,
    spec.intent,
    "photorealistic product photograph, three-quarter view, studio lighting, plain white background, sharp focus, no text, no watermark, no people",
  ].join(" — ");
}

function dataUrlBytes(value: string): { bytes: Uint8Array; contentType: string } {
  const match = value.match(/^data:(image\/[a-z+]+);base64,([\s\S]*)$/);
  const base64 = match ? match[2]! : value;
  const contentType = match ? match[1]! : "image/jpeg";
  return { bytes: Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)), contentType };
}

/**
 * Text-to-image via Workers AI. FLUX.2 models take multipart form data rather
 * than JSON — even for a prompt-only call — and return `{ image: "<base64>" }`.
 */
export async function generateRender(prompt: string): Promise<GeneratedImage> {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("width", String(RENDER_WIDTH));
  form.append("height", String(RENDER_HEIGHT));

  // FormData never exposes its serialized body or boundary. Round-tripping it
  // through a Response produces the multipart Content-Type the model requires.
  const serialized = new Response(form);

  let out: unknown;
  try {
    out = await getEnv().AI.run(imageModel(), {
      multipart: {
        body: serialized.body,
        contentType: serialized.headers.get("content-type"),
      },
    } as never);
  } catch (e) {
    return { error: `Image model call failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const image = (out as { image?: unknown } | null)?.image;
  if (typeof image !== "string" || image.length === 0) {
    return { error: "Image model returned no image" };
  }
  return dataUrlBytes(image);
}
