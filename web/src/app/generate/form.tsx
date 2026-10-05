"use client";

import { useState } from "react";
import { clarifyAction, type GenerateState } from "./actions";
import { TurnstileBox } from "@/components/turnstile-box";
import { JobProgress } from "@/components/job-progress";
import { runJobStream } from "@/lib/job-client";

const EXAMPLES = [
  "A desk lamp that looks like a frosted glass cube, USB-C powered, warm white LED, touch dimmer on the top face",
  "A Muse gadget: a round desktop companion that shows the weather, takes voice notes and pairs with the Muse app",
  "A magnetic voice note-taker: press once to record, tap again to play back, sticks to a fridge, no radio",
  "A tiny 3-key macro keypad with a volume roller, wired USB, no battery",
];

type BoardOption = { id: string; label: string; chip?: string };
type BoardCatalog = { esp32: BoardOption[]; linux: BoardOption[] };
type StarterOption = {
  id: string;
  title: string;
  blurb: string;
  prompt: string;
  target: { sdk: "esp32" | "linux"; board: string };
};

export default function GenerateForm({
  defaultPrompt,
  remixOf,
  remixTitle,
  boards,
  starters,
  defaultTarget,
  turnstileSiteKey,
}: {
  defaultPrompt?: string;
  remixOf?: string;
  remixTitle?: string;
  boards: BoardCatalog;
  starters: StarterOption[];
  defaultTarget?: { sdk: "esp32" | "linux"; board: string };
  turnstileSiteKey: string | null;
}) {
  const [state, setState] = useState<GenerateState>({ error: null });
  const [jobStage, setJobStage] = useState<string | null>(null);
  const busy = jobStage !== null;
  const [clarifying, setClarifying] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [prompt, setPrompt] = useState(defaultPrompt ?? "");
  const [targetSdk, setTargetSdk] = useState<"" | "esp32" | "linux">(defaultTarget?.sdk ?? "");
  const [targetBoard, setTargetBoard] = useState(defaultTarget?.board ?? "");
  const [mode, setMode] = useState<"ai" | "paste">("ai");
  const [specText, setSpecText] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteIssues, setPasteIssues] = useState<string[]>([]);
  const [cfToken, setCfToken] = useState<string | null>(null);
  const [cfReset, setCfReset] = useState(0);

  const boardOptions = targetSdk === "linux" ? boards.linux : boards.esp32;
  const effectiveBoard = targetBoard || boardOptions[0]?.id || "";

  function applyStarter(s: StarterOption) {
    setPrompt(s.prompt);
    setTargetSdk(s.target.sdk);
    setTargetBoard(s.target.board);
    setState({ error: null });
  }

  async function submit(finalPrompt: string) {
    if (turnstileSiteKey && !cfToken) {
      setState({ error: "Complete the bot check first — it takes a second." });
      return;
    }
    setState({ error: null });
    setJobStage("drafting");
    const result = await runJobStream(
      {
        type: "generate",
        prompt: finalPrompt,
        targetSdk: targetSdk || undefined,
        targetBoard: targetSdk ? effectiveBoard : undefined,
        remixOf: remixOf || undefined,
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
    setState({ error: result.error });
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

  async function askQuestions() {
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

  /** Paste path: same endpoint agents use, so the validation is identical. */
  async function publishPaste() {
    if (turnstileSiteKey && !cfToken) {
      setPasteError("Complete the bot check first — it takes a second.");
      return;
    }
    setPublishing(true);
    setPasteError(null);
    setPasteIssues([]);
    try {
      let spec: unknown;
      try {
        spec = JSON.parse(specText);
      } catch {
        setPasteError("That isn't valid JSON — check for trailing commas or missing quotes.");
        return;
      }
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec, remixOf: remixOf || undefined, turnstileToken: cfToken ?? undefined }),
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        issues?: Array<{ path: Array<string | number>; message: string }>;
      };
      if (res.status === 201 && data.url) {
        window.location.href = data.url;
        return;
      }
      if (res.status === 403) {
        setCfReset((k) => k + 1);
        setPasteError("Bot verification failed or expired — complete the check and try again.");
        return;
      }
      if (res.status === 422 && Array.isArray(data.issues)) {
        setPasteError("The spec needs fixes before it can be published:");
        setPasteIssues(
          data.issues
            .slice(0, 8)
            .map((i) => `${(i.path ?? []).join(".") || "(root)"}: ${i.message}`),
        );
        return;
      }
      setPasteError(typeof data.error === "string" ? data.error : `Publish failed (HTTP ${res.status}).`);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      {remixOf && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          Remixing <span className="font-semibold">{remixTitle}</span>. Same starting point — your
          version gets its own scorecard and the lineage stays public.
        </div>
      )}

      <div className="flex gap-2" role="tablist" aria-label="How to create the design">
        {(
          [
            { id: "ai", label: "Generate with AI" },
            { id: "paste", label: "Paste spec JSON" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
              mode === t.id
                ? "border-accent bg-accent/10 text-accent"
                : "border-line text-muted hover:border-accent hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {turnstileSiteKey && (
        <TurnstileBox siteKey={turnstileSiteKey} resetKey={cfReset} onToken={setCfToken} />
      )}

      {mode === "ai" && (
      <form action={onSubmit} className="space-y-4">
        <input type="hidden" name="remixOf" value={remixOf ?? ""} />

        {starters.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              Start from a template — a prompt plus a board the Muse Gadgets SDK actually runs on:
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {starters.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applyStarter(s)}
                  className="rounded-lg border border-line bg-card px-3 py-2 text-left text-sm transition-colors hover:border-accent"
                >
                  <span className="font-semibold">{s.title}</span>
                  <span className="block text-xs text-muted">{s.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          name="prompt"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to build…"
          className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none placeholder:text-muted focus:border-accent"
          required
        />

        <div className="rounded-xl border border-line bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold" htmlFor="targetSdk">
              Target platform
            </label>
            <select
              id="targetSdk"
              value={targetSdk}
              onChange={(e) => {
                const sdk = e.target.value as "" | "esp32" | "linux";
                setTargetSdk(sdk);
                setTargetBoard(sdk === "linux" ? boards.linux[0]?.id ?? "" : sdk === "esp32" ? boards.esp32[0]?.id ?? "" : "");
              }}
              className="rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">None — design it freely</option>
              <option value="esp32">Muse Gadgets SDK — ESP32</option>
              <option value="linux">Muse Gadgets SDK — Linux / Pi</option>
            </select>
            {targetSdk && (
              <select
                aria-label="Target board"
                value={effectiveBoard}
                onChange={(e) => setTargetBoard(e.target.value)}
                className="max-w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {boardOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                    {b.chip ? ` · ${b.chip}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          {targetSdk && (
            <p className="mt-2 text-xs text-muted">
              The harness checks the board is on the SDK&apos;s supported list, the toolchain is ESP-IDF v6.0.1, and every
              capability you ask for is real — then the design page exports a flash-ready build kit.
            </p>
          )}
        </div>

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

        {jobStage && <JobProgress stage={jobStage} />}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || clarifying}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Working…" : questions.length > 0 ? "Generate with answers" : "Generate + score"}
          </button>
          <button
            type="button"
            onClick={askQuestions}
            disabled={busy || clarifying}
            className="rounded-lg border border-line px-4 py-2.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {clarifying ? "Thinking…" : questions.length > 0 ? "Ask again" : "Ask clarifying questions"}
          </button>
          <span className="font-mono text-xs text-muted">
            llama-3.3-70b via Workers AI · scored by the same engine as the CLI · 10/day
          </span>
        </div>
      </form>
      )}

      {mode === "ai" && state.error && (
        <div className="rounded-lg border border-fail/40 bg-fail/10 px-4 py-3 text-sm text-fail">{state.error}</div>
      )}

      {mode === "ai" && (
      <div className="space-y-2">
        <p className="text-sm text-muted">Need a starting point? Pick one — then edit it.</p>
        <div className="flex flex-col gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setPrompt(e)}
              className="rounded-lg border border-line bg-card px-4 py-2 text-left text-sm text-muted transition-colors hover:border-accent hover:text-foreground"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      )}

      {mode === "paste" && (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Already have a spec? Paste it — it gets validated, scored by the same engine as the CLI,
          and published to the gallery. Only <code className="font-mono">name</code>,{" "}
          <code className="font-mono">intent</code>, <code className="font-mono">parts</code> and{" "}
          <code className="font-mono">operations</code> are required. The CLI starter spec
          (<code className="font-mono">harness/examples/minimal-spec.json</code>) is a good starting point.
        </p>
        <textarea
          rows={12}
          value={specText}
          onChange={(e) => setSpecText(e.target.value)}
          placeholder='{"name": "My widget", "intent": "...", "parts": [...], "operations": [...]}'
          spellCheck={false}
          className="w-full rounded-xl border border-line bg-card px-4 py-3 font-mono text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={publishPaste}
            disabled={publishing || specText.trim().length === 0}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {publishing ? "Publishing…" : "Validate + publish"}
          </button>
          <span className="font-mono text-xs text-muted">
            scored by the same engine as the CLI · 20/day
          </span>
        </div>
        {pasteError && (
          <div className="rounded-lg border border-fail/40 bg-fail/10 px-4 py-3 text-sm text-fail">
            {pasteError}
            {pasteIssues.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs">
                {pasteIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
