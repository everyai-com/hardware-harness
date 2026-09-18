import Link from "next/link";
import type { DesignRow } from "@/lib/db/queries";

export function ScoreBadge({ total, gates, className = "" }: { total: number; gates: boolean; className?: string }) {
  return (
    <span
      className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
        gates ? "bg-pass/15 text-pass" : "bg-fail/15 text-fail"
      } ${className}`}
    >
      {total.toFixed(2)}/5 {gates ? "PASS" : "FAIL"}
    </span>
  );
}

export function DesignCard({ design }: { design: DesignRow }) {
  return (
    <Link
      href={`/d/${design.id}`}
      className="flex flex-col rounded-xl border border-line bg-card p-5 transition-colors hover:border-accent"
    >
      <img
        src={`/api/render/${design.id}`}
        alt={`${design.title} — AI reference render`}
        width={1024}
        height={768}
        loading="lazy"
        className="mb-4 aspect-[4/3] w-full rounded-lg border border-line bg-background object-cover"
      />
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">{design.title}</h3>
        <ScoreBadge total={design.scoreTotal} gates={design.gatesPassed} />
      </div>
      <p className="mt-2 text-sm text-muted">{design.producedBy ?? "unknown generator"}</p>
      <div className="mt-auto flex items-center gap-3 pt-4 font-mono text-xs text-muted">
        <span>{design.remixOf ? `remix of ${design.remixOf}` : "original"}</span>
        <span>♥ {design.likes}</span>
      </div>
    </Link>
  );
}
