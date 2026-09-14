import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getEnv } from "@/lib/cf";
import { designs, kits, votes, outcomes } from "./schema";

function db() {
  return drizzle(getEnv().DB, { schema: { designs, kits, votes, outcomes } });
}

export type DesignRow = typeof designs.$inferSelect;
export type KitRow = typeof kits.$inferSelect;
export type OutcomeRow = typeof outcomes.$inferSelect;

/** How many outcome reports one visitor may add to one design per day. */
export const MAX_OUTCOMES_PER_DESIGN_PER_DAY = 20;

/**
 * Insert a design. Returns false when the id was already taken, so the caller can
 * retry the slug instead of reporting a publish that never happened.
 */
export async function insertDesign(row: typeof designs.$inferInsert): Promise<boolean> {
  const inserted = await db().insert(designs).values(row).onConflictDoNothing().returning({ id: designs.id });
  return inserted.length > 0;
}

export async function slugTaken(id: string): Promise<boolean> {
  const rows = await db().select({ id: designs.id }).from(designs).where(eq(designs.id, id)).limit(1);
  return rows.length > 0;
}

/** Safe parse of a stored JSON blob: a bad row degrades to null, it does not 500 the route. */
export function parseStoredJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function getDesign(id: string): Promise<DesignRow | undefined> {
  const rows = await db().select().from(designs).where(eq(designs.id, id)).limit(1);
  return rows[0];
}

export type Sort = "new" | "score" | "likes";

export const SORTS: Sort[] = ["new", "score", "likes"];

export function parseSort(value: string | null): Sort {
  return SORTS.includes(value as Sort) ? (value as Sort) : "new";
}

export const PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

export interface DesignPage {
  designs: DesignRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export async function listDesigns(sort: Sort = "new", limit = PAGE_SIZE, offset = 0): Promise<DesignRow[]> {
  const order =
    sort === "score" ? desc(designs.scoreTotal) : sort === "likes" ? desc(designs.likes) : desc(designs.createdAt);
  return db()
    .select()
    .from(designs)
    .where(eq(designs.isPublic, true))
    .orderBy(order)
    .limit(Math.min(Math.max(limit, 1), MAX_PAGE_SIZE))
    .offset(Math.max(offset, 0));
}

/** One page of the gallery, with the total so the UI can paginate instead of truncating silently. */
export async function pageDesigns(sort: Sort = "new", page = 1, pageSize = PAGE_SIZE): Promise<DesignPage> {
  const size = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(Math.floor(page) || 1, 1);
  const [rows, total] = await Promise.all([
    listDesigns(sort, size, (safePage - 1) * size),
    countDesigns(),
  ]);
  return { designs: rows, total, page: safePage, pageSize: size, hasMore: safePage * size < total };
}

export async function listRemixes(ofId: string): Promise<DesignRow[]> {
  return db().select().from(designs).where(eq(designs.remixOf, ofId)).orderBy(desc(designs.createdAt)).limit(20);
}

export async function listKits(): Promise<KitRow[]> {
  return db().select().from(kits).orderBy(kits.sortOrder);
}

export async function getKit(id: string): Promise<KitRow | undefined> {
  const rows = await db().select().from(kits).where(eq(kits.id, id)).limit(1);
  return rows[0];
}

export async function recordView(id: string): Promise<void> {
  await db()
    .update(designs)
    .set({ views: sql`${designs.views} + 1` })
    .where(eq(designs.id, id));
}

/**
 * One vote per (design, voter). Returns the new like count, or null if the visitor
 * already voted — or if the design does not exist, so a junk id cannot create an
 * orphan vote row that inflates nothing.
 */
export async function addVote(designId: string, voterHash: string): Promise<number | null> {
  const design = await getDesign(designId);
  if (!design) return null;
  const inserted = await db()
    .insert(votes)
    .values({ designId, voterHash, createdAt: new Date().toISOString() })
    .onConflictDoNothing()
    .returning({ designId: votes.designId });
  if (!inserted.length) return null;
  await db()
    .update(designs)
    .set({ likes: sql`${designs.likes} + 1` })
    .where(eq(designs.id, designId));
  const rows = await db().select({ likes: designs.likes }).from(designs).where(eq(designs.id, designId)).limit(1);
  return rows[0]?.likes ?? null;
}

export async function hasVoted(designId: string, voterHash: string): Promise<boolean> {
  const rows = await db()
    .select({ voterHash: votes.voterHash })
    .from(votes)
    .where(and(eq(votes.designId, designId), eq(votes.voterHash, voterHash)))
    .limit(1);
  return rows.length > 0;
}

/** Public designs only — the home page should not advertise drafts. */
export async function countDesigns(): Promise<number> {
  const rows = await db()
    .select({ n: sql<number>`count(*)` })
    .from(designs)
    .where(eq(designs.isPublic, true));
  return Number(rows[0]?.n ?? 0);
}

export async function listOutcomes(designId: string): Promise<OutcomeRow[]> {
  return db().select().from(outcomes).where(eq(outcomes.designId, designId)).orderBy(desc(outcomes.createdAt)).limit(50);
}

export async function countOutcomesSince(designId: string, sinceIso: string): Promise<number> {
  const rows = await db()
    .select({ n: sql<number>`count(*)` })
    .from(outcomes)
    .where(and(eq(outcomes.designId, designId), sql`${outcomes.createdAt} >= ${sinceIso}`));
  return Number(rows[0]?.n ?? 0);
}

/** Most recent build outcomes across the whole gallery, newest first. */
export async function listRecentBuildOutcomes(limit = 100): Promise<OutcomeRow[]> {
  return db()
    .select()
    .from(outcomes)
    .where(eq(outcomes.kind, "build"))
    .orderBy(desc(outcomes.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function getDesignsByIds(ids: string[]): Promise<DesignRow[]> {
  if (!ids.length) return [];
  return db().select().from(designs).where(inArray(designs.id, ids));
}

/** How many build outcomes each of these designs has. Powers the "built" marker. */
export async function buildCountsFor(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await db()
    .select({ designId: outcomes.designId, n: sql<number>`count(*)` })
    .from(outcomes)
    .where(and(eq(outcomes.kind, "build"), inArray(outcomes.designId, ids)))
    .groupBy(outcomes.designId);
  return new Map(rows.map((r) => [r.designId, Number(r.n ?? 0)]));
}

/** Record a build outcome against a published design. Throws if the design is unknown. */
export async function addOutcome(row: typeof outcomes.$inferInsert): Promise<OutcomeRow> {
  const design = await getDesign(row.designId);
  if (!design) throw new Error(`unknown design '${row.designId}'`);
  const inserted = await db().insert(outcomes).values(row).returning();
  const created = inserted[0];
  if (!created) throw new Error("outcome insert returned no row");
  return created;
}
