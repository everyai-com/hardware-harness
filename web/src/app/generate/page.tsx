import { getDesign } from "@/lib/db/queries";
import { MUSE_BOARDS, MUSE_LINUX } from "@/lib/harness/score";
import { MUSE_STARTERS } from "@/lib/starters";
import { getEnv } from "@/lib/cf";
import GenerateForm from "./form";

export const dynamic = "force-dynamic";

/**
 * Remix starts from the original's prompt — or its one-line intent when the
 * design was published via the API/CLI and never had a prompt (every seeded
 * design). The target board carries over too, so remixing a Muse gadget stays
 * a Muse gadget.
 */
function remixDefaults(specJson: string): {
  intent?: string;
  target?: { sdk: "esp32" | "linux"; board: string };
} {
  try {
    const spec = JSON.parse(specJson) as { intent?: unknown; target?: unknown };
    const out: { intent?: string; target?: { sdk: "esp32" | "linux"; board: string } } = {};
    if (typeof spec.intent === "string" && spec.intent.trim()) out.intent = spec.intent;
    const t = spec.target as { platform?: unknown; sdk?: unknown; board?: unknown } | undefined;
    if (
      t &&
      t.platform === "muse-gadgets" &&
      (t.sdk === "esp32" || t.sdk === "linux") &&
      typeof t.board === "string" &&
      t.board
    ) {
      out.target = { sdk: t.sdk, board: t.board };
    }
    return out;
  } catch {
    return {};
  }
}

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ remix?: string; template?: string }>;
}) {
  const { remix, template } = await searchParams;
  let remixTitle: string | undefined;
  let defaultPrompt: string | undefined;
  let defaultTarget: { sdk: "esp32" | "linux"; board: string } | undefined;
  if (remix) {
    const original = await getDesign(remix);
    if (original) {
      remixTitle = original.title;
      const fallback = remixDefaults(original.specJson);
      defaultPrompt = original.prompt ?? fallback.intent;
      // Only carry a board the SDK still lists — a stale id would dead-end the form.
      if (fallback.target) {
        const known =
          fallback.target.sdk === "esp32"
            ? MUSE_BOARDS[fallback.target.board]
            : MUSE_LINUX.boards.some((b) => b.id === fallback.target!.board);
        if (known) defaultTarget = fallback.target;
      }
    }
  } else if (template) {
    const starter = MUSE_STARTERS.find((s) => s.id === template);
    if (starter) {
      defaultPrompt = starter.prompt;
      defaultTarget = starter.target;
    }
  }

  // Board lists come from the harness knowledge, server-side, so the client
  // bundle never carries the engine.
  const boards = {
    esp32: Object.values(MUSE_BOARDS).map((b) => ({ id: b.id, label: b.label, chip: b.chip })),
    linux: MUSE_LINUX.boards.map((b) => ({ id: b.id, label: b.label })),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">Generate a design</h1>
        <p className="text-muted">
          Describe the object. You get a full design spec — parts, sourcing, assembly steps — plus
          the honest part: a BlinkyBench scorecard with gates, DFM findings and landed cost at
          qty&nbsp;1/100/1000. Everything you generate is public, like a Midjourney gallery for
          hardware.
        </p>
        <p className="text-sm text-muted">
          Targeting a <span className="font-semibold text-foreground">Muse gadget</span>? Pick a board the Muse Gadgets
          SDK actually runs on and the harness verifies the match — and exports a flash-ready build kit.
        </p>
      </header>
      <GenerateForm
        defaultPrompt={defaultPrompt}
        defaultTarget={defaultTarget}
        remixOf={remix}
        remixTitle={remixTitle}
        boards={boards}
        starters={MUSE_STARTERS}
        turnstileSiteKey={getEnv().TURNSTILE_SITE_KEY ?? null}
      />
    </div>
  );
}
