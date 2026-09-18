"use client";

import { useState, useTransition } from "react";
import { addOutcomeAction, type OutcomeState } from "@/app/d/[slug]/actions";

const KINDS = [
  { id: "build", label: "Built it" },
  { id: "quote", label: "Real quote" },
  { id: "test", label: "Test result" },
  { id: "note", label: "Note" },
];

/**
 * The front door to the actuals log. Estimates are claims; this is where
 * someone who actually built the thing writes down what happened.
 */
export function OutcomeForm({ designId }: { designId: string }) {
  const [state, setState] = useState<OutcomeState>({ error: null, ok: false });
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      setState({ error: null, ok: false });
      const result = await addOutcomeAction({
        designId,
        kind: String(formData.get("kind") ?? "note"),
        summary: String(formData.get("summary") ?? ""),
        author: String(formData.get("author") ?? ""),
      });
      setState(result);
    });
  }

  return (
    <form action={submit} className="mt-4 space-y-3 rounded-lg border border-line bg-background p-4">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k, i) => (
          <label key={k.id} className="cursor-pointer">
            <input
              type="radio"
              name="kind"
              value={k.id}
              defaultChecked={i === 0}
              className="peer sr-only"
            />
            <span className="inline-block rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors peer-checked:border-accent peer-checked:text-accent">
              {k.label}
            </span>
          </label>
        ))}
      </div>

      <textarea
        name="summary"
        rows={2}
        required
        placeholder="What actually happened — parts cost, minutes to assemble, did it power on, what failed…"
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          name="author"
          placeholder="Your name (optional)"
          className="w-48 rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Recording…" : "Record outcome"}
        </button>
      </div>

      {state.error && (
        <p className="rounded-lg border border-fail/40 bg-fail/10 px-3 py-2 text-sm text-fail">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-lg border border-pass/40 bg-pass/10 px-3 py-2 text-sm text-pass">
          Recorded. That is one more real data point in the set.
        </p>
      )}
    </form>
  );
}
