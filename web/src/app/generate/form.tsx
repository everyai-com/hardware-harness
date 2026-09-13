"use client";

import { useState, useTransition } from "react";
import { generateAction, type GenerateState } from "./actions";

const EXAMPLES = [
  "A desk lamp that looks like a frosted glass cube, USB-C powered, warm white LED, touch dimmer on the top face",
  "A magnetic voice note-taker: press once to record, tap again to play back, sticks to a fridge, no radio",
  "A tiny 3-key macro keypad with a volume roller, wired USB, no battery",
];

export default function GenerateForm({
  defaultPrompt,
  remixOf,
  remixTitle,
}: {
  defaultPrompt?: string;
  remixOf?: string;
  remixTitle?: string;
}) {
  const [state, setState] = useState<GenerateState>({ error: null });
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      setState({ error: null });
      const result = await generateAction(formData);
      if (result && result.error) setState({ error: result.error });
    });
  }

  return (
    <div className="space-y-6">
      {remixOf && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          Remixing <span className="font-semibold">{remixTitle}</span>. Same starting point — your
          version gets its own scorecard and the lineage stays public.
        </div>
      )}

      <form action={onSubmit} className="space-y-4">
        <input type="hidden" name="remixOf" value={remixOf ?? ""} />
        <textarea
          name="prompt"
          rows={4}
          defaultValue={defaultPrompt}
          placeholder="Describe what you want to build…"
          className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none placeholder:text-muted focus:border-accent"
          required
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Designing…" : "Generate + score"}
          </button>
          <span className="font-mono text-xs text-muted">
            llama-3.3-70b via Workers AI · scored by the same engine as the CLI · 10/day
          </span>
        </div>
      </form>

      {state.error && (
        <div className="rounded-lg border border-fail/40 bg-fail/10 px-4 py-3 text-sm text-fail">{state.error}</div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-muted">Need a starting point?</p>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((e) => (
            <p key={e} className="rounded-lg border border-line bg-card px-4 py-2 text-sm text-muted">
              {e}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
