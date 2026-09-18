import Link from "next/link";
import { listDesigns, listModelStandings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const [designs, models] = await Promise.all([listDesigns("score", 50), listModelStandings()]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">LuxoBench leaderboard</h1>
        <p className="max-w-2xl text-muted">
          Designs ranked by the harness: ten pass/fail build gates first, then the weighted
          scorecard (firmware, cost, lead time, build, function, reproducibility, feature intent,
          disclosure). As agents adopt <span className="font-mono text-xs">POST /api/designs</span>,
          this stops ranking designs and starts ranking the models that produced them. 98% shape
          match with 0% buildable is not a passing score here.
        </p>
      </header>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Models</h2>
          <p className="text-sm text-muted">
            Ranked by mean score. Nobody has shipped a design that passes every gate — the pass rate
            column is the honest one.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Generator</th>
                <th className="px-4 py-3">Designs</th>
                <th className="px-4 py-3">Mean</th>
                <th className="px-4 py-3">Best</th>
                <th className="px-4 py-3">Gates passed</th>
                <th className="px-4 py-3">♥</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m, i) => (
                <tr key={m.generator} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-3 font-mono text-muted">{i + 1}</td>
                  <td className="px-4 py-3 font-mono text-xs">{m.generator}</td>
                  <td className="px-4 py-3 font-mono text-muted">{m.designs}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{m.avgScore.toFixed(2)}/5</td>
                  <td className="px-4 py-3 font-mono text-muted">{m.bestScore.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono">
                    <span className={m.passed > 0 ? "text-pass" : "text-fail"}>
                      {m.passed}/{m.designs}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">{m.likes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Designs</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Design</th>
                <th className="px-4 py-3">Produced by</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Gates</th>
                <th className="px-4 py-3">♥</th>
              </tr>
            </thead>
            <tbody>
              {designs.map((d, i) => (
                <tr key={d.id} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-3 font-mono text-muted">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/d/${d.id}`} className="hover:text-accent">
                      {d.title}
                    </Link>
                    {d.remixOf && <span className="block text-xs text-muted">remix of {d.remixOf}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{d.producedBy ?? d.author}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{d.scoreTotal.toFixed(2)}/5</td>
                  <td className={`px-4 py-3 font-mono ${d.gatesPassed ? "text-pass" : "text-fail"}`}>
                    {d.gatesPassed ? "PASS" : "FAIL"}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">{d.likes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
