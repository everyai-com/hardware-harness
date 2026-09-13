export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "design";
}

export async function slugFor(name: string): Promise<string> {
  const { slugTaken } = await import("@/lib/db/queries");
  const base = slugify(name);
  if (!(await slugTaken(base))) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (!(await slugTaken(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
