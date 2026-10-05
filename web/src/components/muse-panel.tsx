import type { ProductSpec } from "@/lib/harness/score";
import { buildMuseScaffold, checkDFM, MUSE_SDK } from "@/lib/harness/score";

function CapabilityChip({ capability, ok }: { capability: string; ok: boolean }) {
  return (
    <span
      className={`rounded-md border px-2 py-0.5 font-mono text-xs ${
        ok ? "border-pass/40 bg-pass/10 text-pass" : "border-fail/40 bg-fail/10 text-fail"
      }`}
    >
      {capability} {ok ? "✓" : "✗"}
    </span>
  );
}

/**
 * The Muse Gadgets compatibility panel: what the design claims, what the SDK's
 * board matrix actually supports, and the exact commands to build, flash and
 * pair it. The build kit downloads are the same files the MCP tool returns.
 */
export function MuseGadgetPanel({ spec, designId }: { spec: ProductSpec; designId: string }) {
  if (spec.target?.platform !== "muse-gadgets") return null;

  const findings = checkDFM(spec).filter((f) => f.ruleId.startsWith("TARGET_"));
  const toolchainIssue = findings.find((f) => f.ruleId === "TARGET_TOOLCHAIN_MISMATCH");

  let scaffold: ReturnType<typeof buildMuseScaffold>;
  try {
    scaffold = buildMuseScaffold(spec);
  } catch {
    const blocked = findings.find((f) => f.ruleId === "TARGET_BOARD_UNSUPPORTED");
    return (
      <section className="rounded-xl border border-fail/40 bg-fail/10 p-5">
        <h2 className="font-semibold">Muse Gadget — not compatible</h2>
        <p className="mt-2 text-sm">
          {blocked?.message ?? `Target board "${spec.target.board}" is not on the Muse Gadget SDK's supported list.`}
        </p>
        {blocked && <p className="mt-1 text-xs text-muted">{blocked.fix}</p>}
      </section>
    );
  }

  const { board, capabilities, commands, notes } = scaffold;

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Muse Gadget</h2>
        <span className="rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
          {board.label}
        </span>
        <span className="font-mono text-xs text-muted">
          {scaffold.sdk === "esp32"
            ? `${board.chip} · ${board.flashMb} MB flash${board.psramMb ? ` / ${board.psramMb} MB PSRAM` : " · no PSRAM"}`
            : "Linux · BLE pairing"}
        </span>
        <a
          href={MUSE_SDK.repo}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-muted hover:text-foreground"
        >
          SDK repo ↗
        </a>
        <a
          href={MUSE_SDK.communityBuilds}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-muted hover:text-foreground"
        >
          community builds ↗
        </a>
      </div>
      {board.display && (
        <p className="mt-1 text-sm text-muted">
          {board.display}
          {board.buttons ? ` · buttons: ${board.buttons}` : ""}
        </p>
      )}

      {capabilities.asked.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {capabilities.asked.map((cap) => (
            <CapabilityChip key={cap} capability={cap} ok={capabilities.supported.includes(cap)} />
          ))}
        </div>
      )}
      {capabilities.gaps.length > 0 && (
        <p className="mt-2 text-xs text-fail">
          Gaps against the board matrix: {capabilities.gaps.join(", ")} — see the findings above.
        </p>
      )}

      {scaffold.sdk === "esp32" && (
        <p className="mt-3 text-sm">
          Toolchain: <span className="font-mono text-xs">{spec.firmware?.toolchain ?? "not declared"}</span>{" "}
          {toolchainIssue ? (
            <span className="text-fail">— the SDK builds with ESP-IDF {MUSE_SDK.espIdf} only</span>
          ) : (
            <span className="text-pass">✓ pinned to the SDK&apos;s ESP-IDF {MUSE_SDK.espIdf}</span>
          )}
        </p>
      )}

      <div className="mt-4 space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted">Build for this board</p>
        <pre className="overflow-x-auto rounded-lg border border-line bg-background p-3 font-mono text-xs">{commands.build}</pre>
        <p className="text-xs uppercase tracking-wide text-muted">
          {scaffold.sdk === "esp32" ? "Flash & monitor" : "Pair"}
        </p>
        <pre className="overflow-x-auto rounded-lg border border-line bg-background p-3 font-mono text-xs">{commands.flash}</pre>
      </div>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 text-sm">
        <p className="font-semibold">Pair with Muse</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted">
          <li>
            Get an SDK token at{" "}
            <a href={MUSE_SDK.tokenUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              gadgets.muse.ai
            </a>{" "}
            — every gadget needs one.
          </li>
          <li>Muse app: Settings &gt; Devices &gt; Developer mode, then Add Device.</li>
          <li>
            Find <span className="font-mono text-xs">MuseGadget-XXXXXX</span> and press the board&apos;s talk button when
            the light breathes blue.
          </li>
        </ol>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={`/api/designs/${designId}/muse?format=zip`}
          className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
        >
          Build kit (.zip) ↓
        </a>
        <a
          href={`/api/designs/${designId}/muse`}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
        >
          build sheet (.json)
        </a>
      </div>
    </section>
  );
}
