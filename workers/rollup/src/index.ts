/**
 * blinky-rollup — daily stats for the leaderboard's models table.
 *
 * A separate worker (not part of the Next.js app) so cron triggers stay
 * simple: every day at 05:00 UTC it aggregates public designs per producer
 * and stores one JSON blob in KV. The leaderboard reads it; a missing or
 * expired blob hides the section instead of erroring.
 *
 * Manual run: GET https://<worker-url>/?token=<ADMIN_TOKEN> (same secret as
 * the web app's admin routes). Deploy: `npx wrangler deploy` from this dir.
 */

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ADMIN_TOKEN?: string;
}

type ProducerRow = {
  producer: string;
  designs: number;
  avg_score: number;
  passes: number;
};

async function tokenValid(provided: string | null, expected?: string): Promise<boolean> {
  if (!expected || !provided) return false;
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

async function rollup(env: Env): Promise<Record<string, unknown>> {
  const producers = await env.DB.prepare(
    `SELECT COALESCE(NULLIF(produced_by, ''), NULLIF(author, ''), 'unknown') AS producer,
            COUNT(*) AS designs,
            AVG(score_total) AS avg_score,
            SUM(CASE WHEN gates_passed = 1 THEN 1 ELSE 0 END) AS passes
     FROM designs WHERE is_public = 1 GROUP BY producer ORDER BY avg_score DESC`,
  ).all<ProducerRow>();

  const totals = await env.DB.prepare(
    `SELECT COUNT(*) AS designs,
            AVG(score_total) AS avg_score,
            SUM(CASE WHEN gates_passed = 1 THEN 1 ELSE 0 END) AS passes
     FROM designs WHERE is_public = 1`,
  ).first<{ designs: number; avg_score: number; passes: number }>();

  const builds = await env.DB.prepare(
    `SELECT COUNT(*) AS builds FROM outcomes WHERE kind = 'build'`,
  ).first<{ builds: number }>();

  const stats = {
    updatedAt: new Date().toISOString(),
    totals: {
      designs: totals?.designs ?? 0,
      avgScore: Math.round(((totals?.avg_score ?? 0) as number) * 100) / 100,
      passes: totals?.passes ?? 0,
      builds: builds?.builds ?? 0,
    },
    models: (producers.results ?? []).map((r) => ({
      producer: r.producer,
      designs: r.designs,
      avgScore: Math.round(r.avg_score * 100) / 100,
      passRate: r.designs > 0 ? Math.round((r.passes / r.designs) * 100) : 0,
    })),
  };

  // 48h TTL: if cron breaks, the leaderboard hides stale stats within 2 days.
  await env.KV.put("stats:models", JSON.stringify(stats), { expirationTtl: 60 * 60 * 48 });
  // AI job rows are progress records, not history — keep 7 days.
  await env.DB.prepare("DELETE FROM jobs WHERE created_at < datetime('now', '-7 days')").run();
  return stats;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await rollup(env);
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!(await tokenValid(url.searchParams.get("token"), env.ADMIN_TOKEN))) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    return Response.json(await rollup(env));
  },
} satisfies ExportedHandler<Env>;
