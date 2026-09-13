"use client";

import { useEffect, useId, useRef } from "react";
import type { ProductSpec } from "@/lib/harness/score";

declare global {
  interface Window {
    mermaid?: {
      initialize: (cfg: Record<string, unknown>) => void;
      render: (id: string, def: string) => Promise<{ svg: string }>;
    };
  }
}

/**
 * Mermaid definitions are strings that mermaid parses and then injects as SVG
 * into the DOM. Spec text (part labels, net names, pins) is USER-SUPPLIED via
 * published designs, so every string is stripped of characters that could
 * break the definition syntax or smuggle markup before it goes anywhere near
 * the parser. securityLevel "strict" additionally escapes any label content
 * mermaid itself renders.
 */
function safe(text: string, max = 48): string {
  return text
    .replace(/["'`<>{}|;\\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const SIGNAL_COLOR: Record<string, string> = {
  power: "#f5b84c",
  gnd: "#8b8b90",
  i2c: "#60a5fa",
  spi: "#a78bfa",
  uart: "#34d399",
  usb: "#f472b6",
  gpio: "#4ade80",
  analog: "#fbbf24",
  rf: "#fb7185",
  other: "#8b8b90",
};

type Edge = { from: string; to: string; label: string; color: string };

/**
 * The wiring view. With declared nets it renders the actual electrical
 * connections, colour-coded by signal type. Falls back to the mechanical
 * interface graph for designs that predate nets.
 */
export function WiringDiagram({ spec }: { spec: ProductSpec }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = useId();
  const nets = spec.nets ?? [];
  const useNets = nets.length > 0;

  const nodes: { id: string; label: string }[] = [];
  const edges: Edge[] = [];

  if (useNets) {
    const involved = new Set<string>();
    for (const net of nets) for (const ep of net.endpoints) involved.add(ep.part);
    const labelOf = new Map(spec.parts.map((p) => [p.id, p.label]));
    for (const id of involved) nodes.push({ id, label: labelOf.get(id) ?? id });
    for (const net of nets) {
      const color = SIGNAL_COLOR[net.signal] ?? SIGNAL_COLOR.other;
      const volt = net.voltage !== undefined ? ` ${net.voltage}V` : "";
      const label = `${safe(net.name, 24)}${volt} [${net.signal}]`;
      for (let i = 0; i < net.endpoints.length - 1; i++) {
        edges.push({
          from: net.endpoints[i].part,
          to: net.endpoints[i + 1].part,
          label,
          color,
        });
      }
    }
  } else {
    for (const p of spec.parts) nodes.push({ id: p.id, label: p.label });
    for (const i of spec.interfaces) {
      edges.push({
        from: i.between[0],
        to: i.between[1],
        label: `fit ${i.clearanceMm} mm`,
        color: "#8b8b90",
      });
    }
  }

  const hasContent = nodes.length > 0 && edges.length > 0;

  useEffect(() => {
    if (!hasContent) return;
    let cancelled = false;

    const render = async () => {
      const mermaid = window.mermaid;
      if (!mermaid || !ref.current) return;
      const def = [
        "graph LR",
        ...nodes.map((n) => `n_${safe(n.id, 30)}["${safe(n.label)}"]`),
        ...edges.map((e) => `n_${safe(e.from, 30)} -->|"${safe(e.label, 40)}"| n_${safe(e.to, 30)}`),
        ...edges.map((e, i) => `linkStyle ${i} stroke:${e.color},stroke-width:2px`),
      ].join("\n");
      mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
      const safeId = `wiring-${key.replace(/[^a-zA-Z0-9]/g, "")}`;
      const { svg } = await mermaid.render(safeId, def);
      if (!cancelled) ref.current.innerHTML = svg;
    };

    const existing = document.querySelector<HTMLScriptElement>("script[data-mermaid]");
    if (existing) {
      render().catch(() => {});
    } else {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
      s.async = true;
      s.dataset.mermaid = "true";
      s.onload = () => render().catch(() => {});
      document.head.appendChild(s);
    }

    return () => {
      cancelled = true;
    };
  }, [nodes, edges, key, hasContent]);

  if (!hasContent) return null;

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{useNets ? "Wiring — declared nets" : "Interfaces &amp; fits"}</h2>
        {useNets && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
            {["power", "gnd", "i2c", "spi", "uart", "usb", "gpio"].map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-4" style={{ background: SIGNAL_COLOR[s] }} />
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        {useNets
          ? "Every declared electrical connection, colour-coded by signal. This is checkable wiring, not a guess."
          : "Declared part-to-part fits with their designed clearances. This design declares no electrical nets."}
      </p>
      <div ref={ref} className="mt-4 overflow-x-auto" />
    </section>
  );
}
