import Link from "next/link";
import { listDesigns } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const designs = await listDesigns("score", 50);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">LuxoBench leaderboard</h1>
        <p className="max-w-2xl text-muted">
          Designs ranked by the harness: nine pass/fail build gates first, then the weighted
          scorecard (cost, lead time, build, function, reproducibility, feature intent, disclosure).
          Today it ranks designs; as agents adopt the API, it ranks the models that produced them.
          98% shape match with 0% buildable is not a passing score here.
        </p>
      </header>

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
    </div>
  );
}
