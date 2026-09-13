"use client";

import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    mermaid?: {
      initialize: (cfg: Record<string, unknown>) => void;
      render: (id: string, def: string) => Promise<{ svg: string }>;
    };
  }
}

type Node = { id: string; label: string };
type Edge = { a: string; b: string; clearance: number };

/**
 * Interface/fit diagram rendered client-side with mermaid loaded from a CDN
 * (kept out of the bundle to stay lean on the disk and the worker).
 */
export function WiringDiagram({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = useId();

  useEffect(() => {
    if (edges.length === 0) return;
    let cancelled = false;

    const render = async () => {
      const mermaid = window.mermaid;
      if (!mermaid || !ref.current) return;
      const def = [
        "graph TD",
        ...nodes.map((n) => `n_${n.id}["${n.label}"]`),
        ...edges.map((e) => `n_${e.a} <-.->|"fit ${e.clearance} mm"| n_${e.b}`),
      ].join("\n");
      mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });
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
  }, [nodes, edges, key]);

  if (edges.length === 0) return null;

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Interfaces &amp; fits</h2>
      <p className="mt-1 text-sm text-muted">
        Every declared part-to-part fit with its designed clearance. Tolerance stacks on these
        interfaces are what jam real builds.
      </p>
      <div ref={ref} className="mt-4 overflow-x-auto" />
    </section>
  );
}
