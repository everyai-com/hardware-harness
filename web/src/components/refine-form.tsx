"use client";

import { useState } from "react";
import { TurnstileBox } from "@/components/turnstile-box";
import { JobProgress } from "@/components/job-progress";
import { runJobStream } from "@/lib/job-client";

const SUGGESTIONS = [
  "Make it cheaper to build at qty 100",
  "Remove the battery — USB power only",
  "Cut the part count",
  "Fix the blocking findings",
];

/** Iterate in plain words. The revision publishes as a remix of this design. */
export function RefineForm({
  designId,
  turnstileSiteKey,
}: {
  designId: string;
  turnstileSiteKey: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState("");
  const [jobStage, setJobStage] = useState<string | null>(null);
  const busy = jobStage !== null;
  const [cfToken, setCfToken] = useState<string | null>(null);
  const [cfReset, setCfReset] = useState(0);

  async function submit(formData: FormData) {
    if (turnstileSiteKey && !cfToken) {
      setError("Complete the bot check first — it takes a second.");
      return;
    }
    setError(null);
    setJobStage("drafting");
    const result = await runJobStream(
      {
        type: "refine",
        designId,
        request: String(formData.get("request") ?? ""),
        turnstileToken: cfToken ?? undefined,
      },
      setJobStage,
    );
    if ("slug" in result) {
      window.location.href = result.url;
      return;
    }
    if (/verification/i.test(result.error)) setCfReset((k) => k + 1);
    setJobStage(null);
    setError(result.error);
  }

  return (
    <section id="refine" className="scroll-mt-20 rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Refine this design</h2>
      <p className="mt-1 text-sm text-muted">
        Say what should change. The revision is scored and published as a new version — the
        original stays untouched.
      </p>
      <form action={submit} className="mt-4 space-y-3">
        <textarea
          name="request"
          rows={3}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="e.g. swap the lithium cell for USB power…"
          className="w-full rounded-xl border border-line bg-background px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-accent"
          required
        />
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRequest(s)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
        {turnstileSiteKey && (
          <TurnstileBox siteKey={turnstileSiteKey} resetKey={cfReset} onToken={setCfToken} />
        )}
        {jobStage && <JobProgress stage={jobStage} />}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Working…" : "Refine + score new version"}
        </button>
      </form>
      {error && (
        <div className="mt-3 rounded-lg border border-fail/40 bg-fail/10 px-4 py-3 text-sm text-fail">
          {error}
        </div>
      )}
    </section>
  );
}
