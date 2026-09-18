import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">404</p>
      <h1 className="text-3xl font-bold">Nothing at this address</h1>
      <p className="text-muted">
        Designs and kits live at their own slug, assigned when they are published. The gallery is a
        better place to start.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2 text-sm">
        <Link
          href="/explore"
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-background transition-opacity hover:opacity-90"
        >
          Explore designs
        </Link>
        <Link
          href="/generate"
          className="rounded-lg border border-line px-4 py-2 text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Generate one
        </Link>
      </div>
    </div>
  );
}
