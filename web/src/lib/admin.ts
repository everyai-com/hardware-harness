import { getEnv } from "./cf";

/**
 * Shared secret gating the admin routes (vector backfill, stats rollup).
 * Unset ADMIN_TOKEN means the route stays disabled (404) — never open.
 * Compares SHA-256 digests without early exit (no timing oracle on length).
 */
export async function adminTokenValid(provided: unknown): Promise<boolean> {
  const expected = getEnv().ADMIN_TOKEN;
  if (!expected || typeof provided !== "string" || provided.length === 0) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(provided)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
  ]);
  const xa = new Uint8Array(a);
  const xb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ xb[i];
  return diff === 0;
}
