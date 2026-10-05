import { getEnv } from "./cf";

/**
 * Semantic search over designs: Workers AI embeddings in a Vectorize index.
 *
 * The index holds one vector per design (name + intent + part labels). Every
 * function here is best-effort — a missing index, a failed embedding, or a
 * local dev environment without Vectorize degrades to "no similar designs",
 * never to an error page. Publishing never fails because search failed.
 */

/** Pinned: the index was created for this model's 384 dimensions. */
const EMBED_MODEL = "@cf/baai/bge-small-en-v1.5";

export type SimilarCard = {
  id: string;
  title: string;
  score: number;
  gatesPassed: boolean;
  url: string;
};

function vecIndex(): VectorizeIndex | null {
  try {
    return getEnv().VEC ?? null;
  } catch {
    return null;
  }
}

/** The text a design is known by: name, intent, and what's in it. */
export function searchTextFor(spec: {
  name: string;
  intent: string;
  parts: Array<{ label: string }>;
}): string {
  const parts = spec.parts.map((p) => p.label).join(", ");
  return `${spec.name}. ${spec.intent}. Parts: ${parts}`.slice(0, 2000);
}

type EmbedOut = { data?: number[][]; shape?: number[] } | number[][];

/** Embed one or more texts. Null when AI is unavailable — never throws. */
export async function embed(texts: string[]): Promise<number[][] | null> {
  if (texts.length === 0) return [];
  try {
    const out = (await getEnv().AI.run(EMBED_MODEL, { text: texts })) as EmbedOut;
    const data = Array.isArray(out) ? out : out.data;
    if (!Array.isArray(data) || data.length !== texts.length) return null;
    if (!data.every((row) => Array.isArray(row) && row.length === 384)) return null;
    return data;
  } catch (e) {
    console.warn("[similar] embedding failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Index (or re-index) one design. False when search is unavailable. */
export async function indexDesign(slug: string, text: string): Promise<boolean> {
  const vec = vecIndex();
  if (!vec) return false;
  const vectors = await embed([text]);
  if (!vectors) return false;
  try {
    await vec.upsert([{ id: slug, values: vectors[0] }]);
    return true;
  } catch (e) {
    console.warn("[similar] upsert failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Bulk backfill: one embedding call, one upsert call, any batch size. */
export async function indexMany(items: Array<{ id: string; text: string }>): Promise<number> {
  const vec = vecIndex();
  if (!vec || items.length === 0) return 0;
  const vectors = await embed(items.map((i) => i.text));
  if (!vectors) return 0;
  try {
    await vec.upsert(items.map((item, n) => ({ id: item.id, values: vectors[n] })));
    return items.length;
  } catch (e) {
    console.warn("[similar] bulk upsert failed:", e instanceof Error ? e.message : e);
    return 0;
  }
}

/**
 * Design ids most similar to the given text, self excluded. Empty when search
 * is unavailable — the UI hides the section instead of erroring.
 */
export async function findSimilarIds(text: string, excludeId: string, topK = 4): Promise<string[]> {
  const vec = vecIndex();
  if (!vec) return [];
  const vectors = await embed([text]);
  if (!vectors) return [];
  try {
    const matches = await vec.query(vectors[0], { topK: topK + 1 });
    return matches.matches
      .map((m) => String(m.id))
      .filter((id) => id !== excludeId)
      .slice(0, topK);
  } catch (e) {
    console.warn("[similar] query failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** False when this environment has no Vectorize binding — the UI hides search. */
export function searchAvailable(): boolean {
  return vecIndex() !== null;
}

/** Free-text search over the gallery. Empty when search is unavailable. */
export async function searchIds(query: string, topK = 20): Promise<string[]> {
  const vec = vecIndex();
  if (!vec || query.trim().length < 2) return [];
  const vectors = await embed([query.slice(0, 500)]);
  if (!vectors) return [];
  try {
    const matches = await vec.query(vectors[0], { topK });
    return matches.matches.map((m) => String(m.id));
  } catch (e) {
    console.warn("[similar] search query failed:", e instanceof Error ? e.message : e);
    return [];
  }
}
