import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const designs = sqliteTable(
  "designs",
  {
    id: text("id").primaryKey(), // slug
    title: text("title").notNull(),
    prompt: text("prompt"),
    specJson: text("spec_json").notNull(),
    scoreJson: text("score_json").notNull(),
    scoreTotal: real("score_total").notNull(), // denormalised for the leaderboard
    gatesPassed: integer("gates_passed", { mode: "boolean" }).notNull().default(false),
    modelUsed: text("model_used"),
    producedBy: text("produced_by"),
    remixOf: text("remix_of"),
    category: text("category"),
    author: text("author"),
    likes: integer("likes").notNull().default(0),
    views: integer("views").notNull().default(0),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("designs_score_idx").on(t.scoreTotal),
    index("designs_created_idx").on(t.createdAt),
    index("designs_remix_idx").on(t.remixOf),
  ],
);

export const kits = sqliteTable("kits", {
  id: text("id").primaryKey(), // slug
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  sourceUrl: text("source_url").notNull(), // the open-source repo
  kitUrl: text("kit_url"), // where to buy the prebuilt kit
  license: text("license"),
  costNote: text("cost_note"),
  harnessScore: real("harness_score"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const votes = sqliteTable(
  "votes",
  {
    designId: text("design_id").notNull(),
    voterHash: text("voter_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("votes_design_voter_idx").on(t.designId, t.voterHash)],
);

/**
 * The moat: score -> build -> ACTUALS. Anyone can record an outcome against a
 * published design - what it really cost, whether it powered on, what failed.
 * This is the table that turns ±40% estimates into ±10%.
 */
export const outcomes = sqliteTable(
  "outcomes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    designId: text("design_id").notNull(),
    // "build" | "quote" | "test" | "note"
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    dataJson: text("data_json"),
    author: text("author").notNull().default("anonymous"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("outcomes_design_idx").on(t.designId)],
);

export type Design = typeof designs.$inferSelect;
export type Kit = typeof kits.$inferSelect;
export type Outcome = typeof outcomes.$inferSelect;
