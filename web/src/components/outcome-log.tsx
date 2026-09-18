import type { ReactNode } from "react";
import type { OutcomeRow } from "@/lib/db/queries";

const KIND_BADGE: Record<string, string> = {
  build: "bg-pass/15 text-pass",
  quote: "bg-accent/15 text-accent",
  test: "bg-fail/10 text-fail",
  note: "bg-line text-muted",
};

/**
 * The score -> build -> ACTUALS log. Estimates are claims; these are receipts.
 */
export function OutcomeLog({ outcomes, children }: { outcomes: OutcomeRow[]; children?: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Outcome log</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        Reality recorded against this design — builds, live quotes, test results. Add yours below,
        or post it programmatically to{" "}
        <code className="font-mono text-xs text-accent">POST /api/designs/[id]/outcomes</code>.
      </p>
      {children}
      {outcomes.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted">
          No outcomes recorded yet. The first person to build this design and post the actuals owns
          the data point — every entry makes the harness estimates sharper for everyone.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {outcomes.map((o) => (
            <li key={o.id} className="flex flex-wrap items-start gap-2 rounded-lg border border-line px-3 py-2">
              <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${KIND_BADGE[o.kind] ?? KIND_BADGE.note}`}>
                {o.kind}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{o.summary}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted">
                  {o.author} · {o.createdAt.slice(0, 10)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
