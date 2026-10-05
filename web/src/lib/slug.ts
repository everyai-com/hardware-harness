export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "design";
}

/**
 * Slugs double as Vectorize vector ids, which are capped at 64 bytes, so a
 * suffixed slug trims its base to stay within that.
 */
export const MAX_SLUG_BYTES = 64;

export function withSuffix(base: string, suffix: string): string {
  const room = MAX_SLUG_BYTES - suffix.length - 1;
  return `${base.slice(0, room).replace(/-+$/, "")}-${suffix}`;
}

/** A free slug for `name`. Uniqueness is still enforced by the insert; see createDesign. */
export async function slugFor(name: string): Promise<string> {
  const { slugTaken } = await import("@/lib/db/queries");
  const base = slugify(name);
  if (!(await slugTaken(base))) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = withSuffix(base, Math.random().toString(36).slice(2, 6));
    if (!(await slugTaken(candidate))) return candidate;
  }
  return withSuffix(base, Date.now().toString(36));
}
