"use client";

import { useState, useTransition } from "react";
import { generateAction, clarifyAction, type GenerateState } from "./actions";

const EXAMPLES = [
  "A desk lamp that looks like a frosted glass cube, USB-C powered, warm white LED, touch dimmer on the top face",
  "A magnetic voice note-taker: press once to record, tap again to play back, sticks to a fridge, no radio",
  "A tiny 3-key macro keypad with a volume roller, wired USB, no battery",
];

const TEMPLATES: Array<{ name: string; blurb: string; prompt: string }> = [
  {
    name: "Desk lamp",
    blurb: "USB-C · LED · touch",
    prompt:
      "A minimalist desk lamp: 3D-printed base with rounded corners, frosted diffuser dome on top, USB-C powered 5V warm-white LED module, capacitive touch dimmer through the base wall with 3 brightness levels, no battery, no radio, sold in the US to adults",
  },
  {
    name: "Macro keypad",
    blurb: "USB · no battery",
    prompt:
      "A 6-key macro keypad with one rotary encoder for volume, wired USB-C, RP2040 brain, 3D-printed case with brass heat-set inserts, no battery, no radio, sold in the US to adults",
  },
  {
    name: "Plant monitor",
    blurb: "ESP32 · sensor",
    prompt:
      "A soil-moisture plant monitor: ESP32-S3 module with pre-certified radio, capacitive soil probe, 0.96in OLED status display, USB-C powered with no battery, 3D-printed stake enclosure, sold in the US to adults",
  },
  {
    name: "Voice note-taker",
    blurb: "I2S mic + amp",
    prompt:
      "A magnetic voice note-taker: press once to record via I2S MEMS microphone, tap again to play back through a 3W I2S amplifier and small speaker, ESP32-S3 brain, USB-C powered, no battery, no radio, sticks to a fridge, sold in the US to adults",
  },
  {
    name: "Phone stand",
    blurb: "passive · no electronics",
    prompt:
      "A passive adjustable phone stand: CNC aluminium base with silicone pads, holds phones 65-85mm wide at 3 viewing angles, no electronics, no fasteners visible from the front, sold in the US to adults",
  },
  {
    name: "Desk organizer",
    blurb: "passive · printed",
    prompt:
      "A modular desk organizer: interlocking FDM-printed trays for pens, SD cards and a phone slot, stackable, no electronics, wall thickness at least 1.5mm everywhere, sold in the US to adults",
  },
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
  const [clarifying, setClarifying] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  function submit(finalPrompt: string) {
    startTransition(async () => {
      setState({ error: null });
      const fd = new FormData();
      fd.set("prompt", finalPrompt);
      if (remixOf) fd.set("remixOf", remixOf);
      const result = await generateAction(fd);
      if (result && result.error) setState({ error: result.error });
    });
  }

  function onSubmit(formData: FormData) {
    const base = String(formData.get("prompt") ?? "").trim();
    const qa = questions
      .map((q, i) => {
        const a = (answers[i] ?? "").trim();
        return a ? `${q} → ${a}` : null;
      })
      .filter(Boolean)
      .join("; ");
    submit(qa ? `${base}\n\nRequirements from clarifying questions: ${qa}` : base);
  }

  function fillPrompt(text: string) {
    const el = document.querySelector('textarea[name="prompt"]') as HTMLTextAreaElement | null;
    if (el) {
      el.value = text;
      el.focus();
    }
    setState({ error: null });
  }

  async function askQuestions() {
    const prompt = (document.querySelector('textarea[name="prompt"]') as HTMLTextAreaElement | null)?.value ?? "";
    if (prompt.trim().length < 5) {
      setState({ error: "Describe the idea first, then ask for clarifying questions." });
      return;
    }
    setClarifying(true);
    setState({ error: null });
    const result = await clarifyAction(prompt);
    setQuestions(result.questions);
    setClarifying(false);
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

        {questions.length > 0 && (
          <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
            <p className="text-sm font-semibold">A few answers make the design better:</p>
            {questions.map((q, i) => (
              <div key={i}>
                <label className="block text-sm text-muted">{q}</label>
                <input
                  type="text"
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                  placeholder="Your answer (optional)"
                  className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || clarifying}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Designing…" : questions.length > 0 ? "Generate with answers" : "Generate + score"}
          </button>
          <button
            type="button"
            onClick={askQuestions}
            disabled={pending || clarifying}
            className="rounded-lg border border-line px-4 py-2.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {clarifying ? "Thinking…" : questions.length > 0 ? "Ask again" : "Ask clarifying questions"}
          </button>
          <span className="font-mono text-xs text-muted">
            llama-3.3-70b via Workers AI · scored by the same engine as the CLI · 10/day
          </span>
        </div>
      </form>

      {state.error && (
        <div className="rounded-lg border border-fail/40 bg-fail/10 px-4 py-3 text-sm text-fail">{state.error}</div>
      )}

      <div className="space-y-3">
        <p className="text-sm text-muted">Start from a template — fully specified prompts that score well:</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => fillPrompt(t.prompt)}
              className="rounded-xl border border-line bg-card p-4 text-left transition-colors hover:border-accent"
            >
              <span className="font-semibold">{t.name}</span>
              <span className="block font-mono text-[11px] text-accent">{t.blurb}</span>
              <span className="mt-1 line-clamp-2 block text-xs text-muted">{t.prompt}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">Or tap an idea to fill the box:</p>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => fillPrompt(e)}
              className="rounded-lg border border-line bg-card px-4 py-2 text-left text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
