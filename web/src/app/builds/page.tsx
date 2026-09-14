import Link from "next/link";
import type { Metadata } from "next";
import { listRecentBuildOutcomes, getDesignsByIds, parseStoredJson } from "@/lib/db/queries";
import type { DesignRow, OutcomeRow } from "@/lib/db/queries";
import { receiptFrom, isVerifiedBuild, receiptSummary } from "@/lib/receipts";
import { ScoreBadge } from "@/components/design-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Receipts — designs someone actually built",
  description:
    "Every recorded build of a LUXO design: what the parts really cost, how long it really took, whether it powered on, and what went wrong.",
  alternates: { canonical: "/builds" },
};

/**
 * The receipts board.
 *
 * Every other hardware gallery ranks by likes or by a generated score. This one
 * ranks by measurements: designs that have a build outcome with an actual cost, an
 * actual build time, a power-on verdict and evidence. A design nobody has built is
 * absent, however well it scored.
 */
export default async function BuildsPage() {
  const outcomes = await listRecentBuildOutcomes(100);
  const designs = await getDesignsByIds([...new Set(outcomes.map((o) => o.designId))]);
  const byId = new Map(designs.map((d) => [d.id, d]));

  const entries = outcomes
    .map((o) => ({ outcome: o, design: byId.get(o.designId) }))
    .filter((e): e is { outcome: OutcomeRow; design: DesignRow } => Boolean(e.design));

  const verified = entries.filter((e) => isVerifiedBuild(receiptFrom(parseStoredJson(e.outcome.dataJson))));
  const rest = entries.filter((e) => !verified.includes(e));

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">Receipts</h1>
        <p className="max-w-3xl text-muted">
          Every other hardware gallery ranks by likes. This one ranks by measurements: a design appears
          here when someone reports what the parts actually cost, how long the build actually took, and
          whether it switched on. <strong className="text-foreground">Verified</strong> means all four —
          cost, minutes, a working device, and an evidence link.
        </p>
        <p className="max-w-3xl text-sm text-muted">
          This is the part of the project that cannot be generated. Anyone can prompt a design; the
          number on the invoice is the only thing that cannot be invented.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center">
          <p className="text-muted">
            No build has been recorded yet — nobody has published a receipt.
          </p>
          <p className="mt-2 text-sm text-muted">
            Open any design and use{" "}
            <span className="font-mono text-accent">Record what actually happened</span> to post the
            first one.
          </p>
          <Link href="/explore" className="mt-4 inline-block text-sm text-accent hover:underline">
            Find a design to build →
          </Link>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              Verified builds <span className="font-mono text-sm text-muted">({verified.length})</span>
            </h2>
            {verified.length === 0 ? (
              <p className="rounded-xl border border-line bg-card p-4 text-sm text-muted">
                None yet. A verified build needs the cost paid, the assembly minutes, a working device
                and an evidence link — opinions do not count.
              </p>
            ) : (
              <ul className="space-y-3">
                {verified.map((e) => (
                  <ReceiptRow key={e.outcome.id} design={e.design} outcome={e.outcome} verified />
                ))}
              </ul>
            )}
          </section>

          {rest.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">
                Reported builds <span className="font-mono text-sm text-muted">({rest.length})</span>
              </h2>
              <p className="text-sm text-muted">
                Builds that are missing at least one measurement. Still useful — a failed build is
                data — but not yet a receipt.
              </p>
              <ul className="space-y-3">
                {rest.map((e) => (
                  <ReceiptRow key={e.outcome.id} design={e.design} outcome={e.outcome} verified={false} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="rounded-xl border border-line bg-card p-5 text-sm text-muted">
        <h2 className="font-semibold text-foreground">Post a receipt from anywhere</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-4 font-mono text-xs leading-relaxed">
{`curl -s https://YOUR-DEPLOYMENT.workers.dev/api/designs/DESIGN-ID/outcomes \\
  -H 'content-type: application/json' \\
  -d '{
    "kind": "build",
    "summary": "Printed both halves, wired the LED module, powered on first try",
    "author": "your-handle",
    "data": {
      "costPaidUsd": 43.10,
      "assemblyMinutes": 38,
      "poweredOn": true,
      "failed": "USB-C cutout needed 0.2mm filing",
      "proofUrl": "https://example.com/photo.jpg"
    }
  }'`}
        </pre>
      </section>
    </div>
  );
}

function ReceiptRow({
  design,
  outcome,
  verified,
}: {
  design: DesignRow;
  outcome: OutcomeRow;
  verified: boolean;
}) {
  const receipt = receiptFrom(parseStoredJson(outcome.dataJson));
  const numbers = receiptSummary(receipt);

  return (
    <li className="rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/d/${design.id}`} className="font-semibold hover:text-accent">
          {design.title}
        </Link>
        <ScoreBadge total={design.scoreTotal} gates={design.gatesPassed} />
        {verified && (
          <span className="rounded-md bg-pass/20 px-2 py-0.5 font-mono text-xs font-semibold text-pass">
            VERIFIED
          </span>
        )}
      </div>

      <p className="mt-2 text-sm">{outcome.summary}</p>

      {numbers && <p className="mt-1 font-mono text-xs text-accent">{numbers}</p>}

      {receipt.failed && (
        <p className="mt-1 text-xs text-fail">
          <span className="font-semibold">Went wrong:</span> {receipt.failed}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted">
        <span>
          {outcome.author} · {outcome.createdAt.slice(0, 10)}
        </span>
        {receipt.proofUrl && (
          <a
            href={receipt.proofUrl}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="text-accent hover:underline"
          >
            evidence ↗
          </a>
        )}
      </div>
    </li>
  );
}
