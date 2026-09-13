import { getDesign } from "@/lib/db/queries";
import GenerateForm from "./form";

export const dynamic = "force-dynamic";

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ remix?: string }>;
}) {
  const { remix } = await searchParams;
  let remixTitle: string | undefined;
  let defaultPrompt: string | undefined;
  if (remix) {
    const original = await getDesign(remix);
    if (original) {
      remixTitle = original.title;
      defaultPrompt = original.prompt ?? undefined;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">Generate a design</h1>
        <p className="text-muted">
          Describe the object. You get a full design spec — parts, sourcing, assembly steps — plus
          the honest part: a LuxoBench scorecard with gates, DFM findings and landed cost at
          qty&nbsp;1/100/1000. Everything you generate is public, like a Midjourney gallery for
          hardware.
        </p>
      </header>
      <GenerateForm defaultPrompt={defaultPrompt} remixOf={remix} remixTitle={remixTitle} />
    </div>
  );
}
