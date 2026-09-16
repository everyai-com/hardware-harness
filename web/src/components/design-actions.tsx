"use client";

import { useState } from "react";

/**
 * Client-side design actions: copy the spec JSON, download it, print the
 * assembly guide. No server round-trip — the spec is already on the page.
 */
export function DesignActions({ designId, specJson }: { designId: string; specJson: string }) {
  const [copied, setCopied] = useState(false);

  async function copySpec() {
    try {
      await navigator.clipboard.writeText(specJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function downloadSpec() {
    const blob = new Blob([specJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${designId}-spec.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const btn =
    "rounded-lg border border-line px-3 py-1.5 font-mono text-sm text-muted transition-colors hover:border-accent hover:text-accent";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={copySpec} className={btn}>
        {copied ? "copied ✓" : "copy spec"}
      </button>
      <button type="button" onClick={downloadSpec} className={btn}>
        spec.json ↓
      </button>
      <a href={`/api/designs/${designId}/bom`} className={btn}>
        BOM.csv ↓
      </a>
      <button type="button" onClick={() => window.print()} className={btn}>
        print guide
      </button>
      <a href={`/compare?a=${designId}`} className={btn}>
        compare ⇄
      </a>
    </div>
  );
}
