import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">404</p>
      <h1 className="text-2xl font-bold">No design or page here</h1>
      <p className="text-muted">
        The design may have been renamed, or the link is wrong. Every published design is listed in the
        gallery.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <Link
          href="/explore"
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-background hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Explore designs
        </Link>
        <Link
          href="/generate"
          className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Generate one
        </Link>
      </div>
    </div>
  );
}
