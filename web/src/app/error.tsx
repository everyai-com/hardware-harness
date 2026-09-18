"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-fail">error</p>
      <h1 className="text-3xl font-bold">That one failed</h1>
      <p className="text-muted">
        Something broke while rendering this page. Scoring and browsing are unaffected — try again,
        or head back to the gallery.
      </p>
      {error.digest && <p className="font-mono text-xs text-muted">digest {error.digest}</p>}
      <div className="flex flex-wrap justify-center gap-3 pt-2 text-sm">
        <button
          onClick={reset}
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-background transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/explore"
          className="rounded-lg border border-line px-4 py-2 text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Explore designs
        </Link>
      </div>
    </div>
  );
}
