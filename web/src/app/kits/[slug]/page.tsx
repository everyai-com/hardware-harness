import Link from "next/link";
import { notFound } from "next/navigation";
import { getKit } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function KitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kit = await getKit(slug);
  if (!kit) notFound();

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <Link href="/kits" className="text-sm text-muted hover:text-foreground">
          ← all kits
        </Link>
        <h1 className="text-3xl font-bold">{kit.name}</h1>
        <p className="text-lg text-muted">{kit.tagline}</p>
      </header>

      <section className="rounded-xl border border-line bg-card p-6">
        <p className="text-sm leading-relaxed">{kit.description}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <a
          href={kit.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-line bg-card p-5 transition-colors hover:border-accent"
        >
          <h2 className="font-semibold">Source (open)</h2>
          <p className="mt-1 break-all font-mono text-xs text-muted">{kit.sourceUrl}</p>
          <p className="mt-2 text-sm text-muted">{kit.license ?? "open source"} license</p>
        </a>
        {kit.kitUrl && (
          <a
            href={kit.kitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-accent/50 bg-accent/5 p-5 transition-colors hover:border-accent"
          >
            <h2 className="font-semibold text-accent">Get the prebuilt kit →</h2>
            <p className="mt-2 text-sm text-muted">{kit.costNote}</p>
          </a>
        )}
      </section>

      <section className="rounded-xl border border-line bg-card p-6 text-sm text-muted">
        <h2 className="font-semibold text-foreground">Why kits, and why subassemblies</h2>
        <p className="mt-2">
          The buyer supplies the labour — the one cost that kills every other low-volume hardware
          model. That&apos;s why kits beat assembled objects and verified builds on gross profit per
          hour. But a complete-product kit marketed as such makes you a manufacturer under FCC
          15.3; the legal path is selling subassemblies for further fabrication (15.101) — the
          SparkFun/Adafruit model. A verified, costed, gated parts set is what separates a kit from
          a bag of parts.
        </p>
      </section>

      <Link href="/generate" className="inline-block text-sm text-accent hover:underline">
        Or design your own and let the harness score it →
      </Link>
    </article>
  );
}
