import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Typed access to the Cloudflare bindings declared in wrangler.jsonc.
 * The ambient CloudflareEnv interface is augmented in src/types/cloudflare-env.d.ts.
 */
export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env;
}

const DEFAULT_AI_MODEL = "@cf/zai-org/glm-5.3-flash";
const DEFAULT_IMAGE_MODEL = "@cf/black-forest-labs/flux-2-klein-9b";

export function aiModel(): string {
  return getEnv().AI_MODEL ?? DEFAULT_AI_MODEL;
}

export function imageModel(): string {
  return getEnv().AI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
}

export async function rateLimit(keyPrefix: string, limit: number): Promise<boolean> {
  const { KV } = getEnv();
  const day = new Date().toISOString().slice(0, 10);
  const key = `${keyPrefix}:${day}`;
  const current = Number((await KV.get(key)) ?? 0);
  if (current >= limit) return false;
  await KV.put(key, String(current + 1), { expirationTtl: 60 * 60 * 48 });
  return true;
}
