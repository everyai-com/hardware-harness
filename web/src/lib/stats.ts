import { getEnv } from "./cf";

/**
 * Daily model stats, rolled up by the blinky-rollup cron worker into KV.
 * Null when the rollup has never run (or expired) — the leaderboard hides
 * the models table instead of showing stale numbers.
 */
export type ModelStats = {
  updatedAt: string;
  totals: { designs: number; avgScore: number; passes: number; builds: number };
  models: Array<{ producer: string; designs: number; avgScore: number; passRate: number }>;
};

export async function getModelStats(): Promise<ModelStats | null> {
  try {
    const raw = await getEnv().KV.get("stats:models");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModelStats;
    if (!parsed || !Array.isArray(parsed.models) || !parsed.totals) return null;
    return parsed;
  } catch {
    return null;
  }
}
