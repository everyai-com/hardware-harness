"use client";

const STEPS = [
  { id: "drafting", label: "Draft" },
  { id: "scoring", label: "Score" },
  { id: "publishing", label: "Publish" },
];

/** Three-step pipeline progress. Stage strings come straight from the job stream. */
export function JobProgress({ stage }: { stage: string }) {
  const base = stage.split(" ")[0];
  const current = base === "drafting" ? 0 : base === "scoring" ? 1 : base === "publishing" ? 2 : 3;
  const note = stage.includes("(") ? stage.slice(stage.indexOf("(") + 1, stage.indexOf(")")) : null;
  return (
    <div className="rounded-xl border border-line bg-card p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                i < current
                  ? "bg-pass/20 text-pass"
                  : i === current
                    ? "bg-accent/20 text-accent"
                    : "bg-line text-muted"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </span>
            <span className={`text-sm ${i <= current ? "text-foreground" : "text-muted"}`}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-line" />}
          </div>
        ))}
      </div>
      <p className="mt-2 font-mono text-xs text-muted">
        {base === "drafting" && (note ? `Asking the model (${note})…` : "Asking the model for a spec…")}
        {base === "scoring" && "Running the harness — gates, findings, cost…"}
        {base === "publishing" && "Publishing to the gallery…"}
      </p>
    </div>
  );
}
