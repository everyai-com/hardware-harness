"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BuildReceipt } from "@/lib/receipts";

/**
 * Record what actually happened.
 *
 * The project's own thesis is that "it works!" is not evidence — so this form asks
 * for the numbers first: what was paid, how long it took, and whether it powered on.
 * A build with no measurements is still stored (a failed build is data), but it does
 * not earn the verified marker.
 */
export function BuildReceiptForm({ designId }: { designId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);

    const data: BuildReceipt = {};
    const cost = Number(fd.get("costPaidUsd"));
    if (fd.get("costPaidUsd") && Number.isFinite(cost) && cost > 0) data.costPaidUsd = cost;
    const minutes = Number(fd.get("assemblyMinutes"));
    if (fd.get("assemblyMinutes") && Number.isFinite(minutes) && minutes > 0) data.assemblyMinutes = minutes;
    const powered = fd.get("poweredOn");
    if (powered === "yes") data.poweredOn = true;
    if (powered === "no") data.poweredOn = false;
    const failed = String(fd.get("failed") ?? "").trim();
    if (failed) data.failed = failed;
    const proofUrl = String(fd.get("proofUrl") ?? "").trim();
    if (proofUrl) data.proofUrl = proofUrl;

    const res = await fetch(`/api/designs/${encodeURIComponent(designId)}/outcomes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "build",
        summary: String(fd.get("summary") ?? "").trim(),
        author: String(fd.get("author") ?? "").trim() || undefined,
        data,
      }),
    });

    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `Could not record the build (HTTP ${res.status}).`);
      return;
    }
    setDone(true);
    setOpen(false);
    router.refresh();
  }

  if (done) {
    return (
      <p className="mt-3 rounded-lg border border-pass/40 bg-pass/10 px-4 py-3 text-sm text-pass">
        Receipt recorded. Thank you — that is one more real data point, and the first thing anyone
        checking this design will read.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 rounded-lg border border-accent/50 px-3 py-1.5 text-sm text-accent transition-colors hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Record what actually happened →
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-line p-4">
      <p className="text-sm font-semibold">Build receipt</p>
      <p className="text-xs text-muted">
        Numbers first. A build that only says “it works” is a comment; this is the log that makes the
        next estimate sharper.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted">Parts actually paid (USD)</span>
          <input
            type="number"
            name="costPaidUsd"
            min="0"
            step="0.01"
            placeholder="e.g. 43.10"
            className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Assembly time (minutes)</span>
          <input
            type="number"
            name="assemblyMinutes"
            min="0"
            step="1"
            placeholder="e.g. 38"
            className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
      </div>

      <fieldset className="text-sm">
        <legend className="text-muted">Did it work?</legend>
        <div className="mt-1 flex gap-4">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="poweredOn" value="yes" /> Powered on and did the thing
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="poweredOn" value="no" /> It did not work
          </label>
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="text-muted">What arrived wrong, or had to be improvised</span>
        <textarea
          name="failed"
          rows={2}
          placeholder="Substituted part, wrong footprint, filed to fit…"
          className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>

      <label className="block text-sm">
        <span className="text-muted">Evidence link (photo, video or invoice)</span>
        <input
          type="url"
          name="proofUrl"
          placeholder="https://…"
          className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>

      <label className="block text-sm">
        <span className="text-muted">One-line summary</span>
        <input
          name="summary"
          required
          maxLength={300}
          placeholder="Printed both halves in PETG, wired the LED module, powered on first try."
          className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>

      <label className="block text-sm">
        <span className="text-muted">Your name or handle</span>
        <input
          name="author"
          maxLength={80}
          className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>

      {error && <p className="rounded-lg border border-fail/40 bg-fail/10 px-3 py-2 text-sm text-fail">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Publish receipt"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line px-4 py-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
