import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Typed access to the Cloudflare bindings declared in wrangler.jsonc.
 * The ambient CloudflareEnv interface is augmented in src/types/cloudflare-env.d.ts.
 */
export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env;
}

const DEFAULT_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export function aiModel(): string {
  return getEnv().AI_MODEL ?? DEFAULT_AI_MODEL;
}

/**
 * Daily limit per key (callers pass "<bucket>:<clientIp>"). The D1 increment is
 * atomic, so parallel requests cannot all slip under the limit.
 */
export async function rateLimit(keyPrefix: string, limit: number): Promise<boolean> {
  const { incrementCounter } = await import("@/lib/db/queries");
  const now = new Date();
  const key = `${keyPrefix}:${now.toISOString().slice(0, 10)}`;
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  return (await incrementCounter(key, expiresAt)) <= limit;
}
