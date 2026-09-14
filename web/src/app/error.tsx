"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Without this, any thrown error — a corrupt stored
 * record, a D1 hiccup — rendered Next's default page and lost the visitor.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("route error:", error.message, error.digest ?? "");
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-fail">something broke</p>
      <h1 className="text-2xl font-bold">This page could not be loaded</h1>
      <p className="text-muted">
        The request failed on the server — usually a stored record that could not be read. Nothing was
        charged, ordered or published.
      </p>
      {error.digest && <p className="font-mono text-xs text-muted">reference: {error.digest}</p>}
      <div className="flex justify-center gap-3 pt-2">
        <button
          onClick={reset}
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-background hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Try again
        </button>
        <a
          href="/explore"
          className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Back to the gallery
        </a>
      </div>
    </div>
  );
}
