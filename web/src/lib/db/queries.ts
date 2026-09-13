import { drizzle } from "drizzle-orm/d1";
import { desc, eq, sql } from "drizzle-orm";
import { getEnv } from "@/lib/cf";
import { designs, kits, votes } from "./schema";

function db() {
  return drizzle(getEnv().DB, { schema: { designs, kits, votes } });
}

export type DesignRow = typeof designs.$inferSelect;
export type KitRow = typeof kits.$inferSelect;

export async function insertDesign(row: typeof designs.$inferInsert): Promise<void> {
  await db().insert(designs).values(row).onConflictDoNothing();
}

export async function slugTaken(id: string): Promise<boolean> {
  const rows = await db().select({ id: designs.id }).from(designs).where(eq(designs.id, id)).limit(1);
  return rows.length > 0;
}

export async function getDesign(id: string): Promise<DesignRow | undefined> {
  const rows = await db().select().from(designs).where(eq(designs.id, id)).limit(1);
  return rows[0];
}

export type Sort = "new" | "score" | "likes";

export async function listDesigns(sort: Sort = "new", limit = 60): Promise<DesignRow[]> {
  const order =
    sort === "score" ? desc(designs.scoreTotal) : sort === "likes" ? desc(designs.likes) : desc(designs.createdAt);
  return db().select().from(designs).where(eq(designs.isPublic, true)).orderBy(order).limit(limit);
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
