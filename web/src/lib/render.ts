import { getEnv } from "@/lib/cf";
import { generateRender, renderPromptFor } from "@/lib/ai/image";

const RENDER_PREFIX = "renders";

export function renderKeyFor(slug: string): string {
  return `${RENDER_PREFIX}/${slug}.jpg`;
}

export type EnsuredRender = { key: string } | { error: string };

/**
 * The reference render for a design, generated once and kept in R2. Idempotent:
 * the first caller pays for inference, every later one reads the stored object.
 */
export async function ensureRender(
  slug: string,
  spec: { name: string; intent: string },
): Promise<EnsuredRender> {
  const { R2 } = getEnv();
  const key = renderKeyFor(slug);
  if (await R2.head(key)) return { key };

  const generated = await generateRender(renderPromptFor(spec));
  if ("error" in generated) return generated;

  await R2.put(key, generated.bytes, {
    httpMetadata: {
      contentType: generated.contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return { key };
}

export async function readRender(key: string) {
  return getEnv().R2.get(key);
}
