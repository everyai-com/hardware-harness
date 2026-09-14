import Link from "next/link";
import type { Metadata } from "next";
import { listDesigns, buildCountsFor } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LuxoBench leaderboard",
  description:
    "Hardware designs ranked by the LuxoBench harness: pass/fail build gates first, then the weighted scorecard.",
  alternates: { canonical: "/leaderboard" },
};

export default async function LeaderboardPage() {
  const designs = await listDesigns("score", 50);
  const receipts = await buildCountsFor(designs.map((d) => d.id));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">LuxoBench leaderboard</h1>
        <p className="max-w-2xl text-muted">
          Designs ranked by the harness: ten pass/fail build gates first, then the weighted scorecard
          (cost, lead time, build, function, reproducibility, feature intent, disclosure). Today it
          ranks designs; as agents adopt the API, it ranks the models that produced them. 98% shape
          match with 0% buildable is not a passing score here.
        </p>
        <p className="text-sm text-muted">
          A generated score is a prediction. The <Link href="/builds" className="text-accent hover:underline">Receipts</Link>{" "}
          board ranks the same designs by what actually happened when someone built one.
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3">#</th>
              <th scope="col" className="px-4 py-3">Design</th>
              <th scope="col" className="px-4 py-3">Produced by</th>
              <th scope="col" className="px-4 py-3">Score</th>
              <th scope="col" className="px-4 py-3">Gates</th>
              <th scope="col" className="px-4 py-3">Built</th>
              <th scope="col" className="px-4 py-3">♥</th>
            </tr>
          </thead>
          <tbody>
            {designs.map((d, i) => {
              const built = receipts.get(d.id) ?? 0;
              return (
                <tr key={d.id} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-3 font-mono text-muted">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/d/${d.id}`} className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                      {d.title}
                    </Link>
                    {d.remixOf && <span className="block text-xs text-muted">remix of {d.remixOf}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{d.producedBy ?? d.author}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{d.scoreTotal.toFixed(2)}/5</td>
                  <td className={`px-4 py-3 font-mono ${d.gatesPassed ? "text-pass" : "text-fail"}`}>
                    {d.gatesPassed ? "PASS" : "FAIL"}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">
                    {built > 0 ? <span className="text-pass">{built}</span> : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">
                    <span aria-hidden="true">♥ {d.likes}</span>
                    <span className="sr-only">{d.likes} likes</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {designs.length === 0 && (
        <p className="rounded-xl border border-line bg-card p-8 text-center text-muted">
          No designs yet. Generate one to start the leaderboard.
        </p>
      )}
    </div>
  );
}
