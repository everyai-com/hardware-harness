import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getEnv } from "@/lib/cf";
import { designs, kits, votes, outcomes, jobs, rateLimits } from "./schema";

function db() {
  return drizzle(getEnv().DB, { schema: { designs, kits, votes, outcomes, jobs, rateLimits } });
}

/** Atomically add one to a counter and return the new value. */
export async function incrementCounter(key: string, expiresAt: string): Promise<number> {
  const rows = await db()
    .insert(rateLimits)
    .values({ key, count: 1, expiresAt })
    .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  return rows[0]?.count ?? Number.POSITIVE_INFINITY;
}

export type DesignRow = typeof designs.$inferSelect;
export type KitRow = typeof kits.$inferSelect;
export type OutcomeRow = typeof outcomes.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;

/** Insert a design. False when the slug was taken in the meantime (nothing written). */
export async function insertDesign(row: typeof designs.$inferInsert): Promise<boolean> {
  const inserted = await db().insert(designs).values(row).onConflictDoNothing().returning({ id: designs.id });
  return inserted.length > 0;
}

export async function slugTaken(id: string): Promise<boolean> {
  const rows = await db().select({ id: designs.id }).from(designs).where(eq(designs.id, id)).limit(1);
  return rows.length > 0;
}

export async function getDesign(id: string): Promise<DesignRow | undefined> {
  const rows = await db().select().from(designs).where(eq(designs.id, id)).limit(1);
  return rows[0];
}

/** Batch fetch in one query, returned in the input id order. Skips missing ids. */
export async function getDesigns(ids: string[]): Promise<DesignRow[]> {
  if (ids.length === 0) return [];
  const rows = await db().select().from(designs).where(inArray(designs.id, ids)).limit(ids.length);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

export type Sort = "new" | "score" | "likes";

export async function listDesigns(
  sort: Sort = "new",
  limit = 60,
  opts: { museOnly?: boolean } = {},
): Promise<DesignRow[]> {
  const order =
    sort === "score" ? desc(designs.scoreTotal) : sort === "likes" ? desc(designs.likes) : desc(designs.createdAt);
  const where = opts.museOnly
    ? and(eq(designs.isPublic, true), eq(designs.targetPlatform, "muse-gadgets"))
    : eq(designs.isPublic, true);
  return db().select().from(designs).where(where).orderBy(order).limit(limit);
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

/** One vote per (design, voter). Returns the new like count, or null if already voted. */
export async function addVote(designId: string, voterHash: string): Promise<number | null> {
  const inserted = await db()
    .insert(votes)
    .values({ designId, voterHash, createdAt: new Date().toISOString() })
    .onConflictDoNothing()
    .returning();
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
    .where(sql`${votes.designId} = ${designId} AND ${votes.voterHash} = ${voterHash}`)
    .limit(1);
  return rows.length > 0;
}

export async function countDesigns(): Promise<number> {
  const rows = await db().select({ n: sql<number>`count(*)` }).from(designs);
  return Number(rows[0]?.n ?? 0);
}

export async function listOutcomes(designId: string): Promise<OutcomeRow[]> {
  return db().select().from(outcomes).where(eq(outcomes.designId, designId)).orderBy(desc(outcomes.createdAt)).limit(50);
}

export async function addOutcome(row: typeof outcomes.$inferInsert): Promise<OutcomeRow> {
  const inserted = await db().insert(outcomes).values(row).returning();
  return inserted[0]!;
}

export async function createJob(row: typeof jobs.$inferInsert): Promise<void> {
  await db().insert(jobs).values(row);
}

export async function getJob(id: string): Promise<JobRow | undefined> {
  const rows = await db().select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return rows[0];
}

export async function updateJob(
  id: string,
  patch: Partial<Pick<JobRow, "status" | "stage" | "resultSlug" | "error">>,
): Promise<void> {
  await db()
    .update(jobs)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(jobs.id, id));
}
