"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const KINDS = [
  { id: "build", label: "Build — I built one" },
  { id: "quote", label: "Quote — a real distributor price" },
  { id: "test", label: "Test — measured results" },
  { id: "note", label: "Note — anything else" },
];

/** Record reality against a design, in-UI. Estimates are claims; these are receipts. */
export function OutcomeForm({ designId }: { designId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState("build");
  const [summary, setSummary] = useState("");
  const [cost, setCost] = useState("");
  const [minutes, setMinutes] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (summary.trim().length < 5) {
      setError("Say what happened — one sentence at least.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const data: Record<string, number> = {};
      const costNum = Number(cost);
      const minNum = Number(minutes);
      if (cost.trim() && Number.isFinite(costNum) && costNum >= 0) data.actualCostUsd = costNum;
      if (minutes.trim() && Number.isFinite(minNum) && minNum >= 0) data.assemblyMinutes = Math.round(minNum);
      const res = await fetch(`/api/designs/${designId}/outcomes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          summary: summary.trim(),
          data: Object.keys(data).length > 0 ? data : undefined,
          author: author.trim() || undefined,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(typeof payload.error === "string" ? payload.error : `Recording failed (HTTP ${res.status}).`);
        return;
      }
      setSummary("");
      setCost("");
      setMinutes("");
      setAuthor("");
      setDone(true);
      router.refresh();
    } catch {
      setError("Could not reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-line p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Your name (optional)</span>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="anonymous"
            maxLength={80}
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">What happened</span>
        <input
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Built one, works, 41 min assembly"
          maxLength={1000}
          required
          className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Actual cost, USD (optional)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="52.10"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Assembly minutes (optional)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="41"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Recording…" : "Record outcome"}
      </button>
      {error && (
        <p className="rounded-lg border border-fail/40 bg-fail/10 px-3 py-2 text-sm text-fail">{error}</p>
      )}
      {done && <p className="text-sm text-pass">Recorded — thank you. This is the data the estimates learn from.</p>}
    </form>
  );
}
