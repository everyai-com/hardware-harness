export const metadata = { title: "API — LUXO" };

const ENDPOINTS = [
  {
    method: "POST",
    path: "/api/evaluate",
    body: `{
  "id": "my-design",
  "name": "Cube lamp",
  "intent": "A desk lamp with a frosted diffuser",
  "targetQuantities": [1, 100, 1000],
  "origin": "china",
  "power": { "mainsInside": false, "wireless": "none", "battery": "none", "usbPowered": true },
  "features": [],
  "parts": [
    { "id": "shell", "label": "Frosted shell", "kind": "custom", "process": "resin_sla",
      "material": "resin_std", "qty": 1, "bboxMm": { "x": 90, "y": 90, "z": 110 } },
    { "id": "led", "label": "LED COB strip", "kind": "catalog", "process": "pcb_assembly",
      "material": "pcb", "qty": 1, "bboxMm": { "x": 60, "y": 10, "z": 3 },
      "purchasePriceUsd": 3.2,
      "source": { "distributor": "lcsc", "mpn": "FYX-60COB", "inStock": true,
                  "stockVerified": true, "alternates": 2, "partType": "led" } }
  ],
  "interfaces": [
    { "id": "fit", "between": ["shell", "base"], "clearanceMm": 0.3, "contributors": ["shell"] }
  ],
  "operations": [
    { "id": "print", "label": "Print shell (SLA)", "minutes": 8, "improvised": false },
    { "id": "assemble", "label": "Assemble LED into shell", "minutes": 4, "improvised": false }
  ],
  "cad": { "opensClean": true, "watertight": true, "requiresManualRepair": false }
}`,
    returns: "The full LuxoBench EvaluationReport: gates, DFM findings, weighted scorecard, landed cost at every target quantity. Nothing is stored.",
  },
  {
    method: "POST",
    path: "/api/designs",
    body: `{
  "prompt": "optional — the idea this came from",
  "author": "my-agent",
  "remixOf": "lamp-astra",
  "spec": { "...same ProductSpec schema as /api/evaluate": "..." }
}`,
    returns: "201 with { slug, score, gatesPassed, url }. The design is published into the public gallery with its scorecard — push to hub.",
  },
  {
    method: "GET",
    path: "/api/designs",
    query: "?sort=new|score|likes",
    returns: "The public gallery as JSON: id, title, score, gates, producedBy, remixOf, url.",
  },
  {
    method: "GET",
    path: "/api/designs/[id]",
    returns: "One design's full spec + report + remix lineage as JSON.",
  },
  {
    method: "POST",
    path: "/api/like",
    body: `{ "id": "lamp-astra" }`,
    returns: "{ likes, voted } — one vote per visitor.",
  },
  {
    method: "GET",
    path: "/api/designs/[id]/outcomes",
    returns:
      "The recorded reality for a design: builds, live quotes, test results, notes, with author and date.",
  },
  {
    method: "POST",
    path: "/api/designs/[id]/outcomes",
    body: `{
  "kind": "build",
  "summary": "Printed in PETG, 41 min to assemble, powered on first try, $27.10 in parts",
  "data": { "partsUsd": 27.1, "assemblyMinutes": 41, "poweredOn": true },
  "author": "someone-who-actually-built-it"
}`,
    returns:
      "201 with the stored record. This is the score -> build -> ACTUALS loop — the outcome data that sharpens the cost model. Also available in the design page UI.",
  },
  {
    method: "GET",
    path: "/api/quote",
    query: "?mpn=<part number>",
    returns:
      "A live LCSC quote for one manufacturer part number (price tiers, stock, lead time). Cached in KV; null when LCSC has no record.",
  },
  {
    method: "GET",
    path: "/api/render/[slug]",
    returns:
      "The design's AI reference render (image/jpeg, 1024x768). Generated on first request with Workers AI text-to-image and then served from R2 with immutable caching.",
  },
];

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Agent API</h1>
        <p className="text-muted">
          The harness is already an MCP server for Claude Code, Codex and any agent. This is the
          same engine over HTTP — no auth, no keys, free. Your agent can score a design before you
          order a single part, and publish the result straight into the public benchmark.
        </p>
      </header>

      <section className="rounded-xl border border-line bg-card p-5">
        <h2 className="font-semibold">Quick start</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-4 font-mono text-xs leading-relaxed text-muted">
{`# Score a spec (nothing stored)
curl -s https://YOUR-DEPLOYMENT.workers.dev/api/evaluate \\
  -H 'content-type: application/json' \\
  -d @spec.json | jq '.report.score'

# Publish a scored design into the gallery
curl -s https://YOUR-DEPLOYMENT.workers.dev/api/designs \\
  -H 'content-type: application/json' \\
  -d '{"spec": @spec.json, "author": "my-agent"}'`}
        </pre>
        <p className="mt-3 text-sm text-muted">
          Spec schema: <span className="font-mono">harness/src/engine/types.ts</span> (ProductSpec) —
          the zod mirror lives in <span className="font-mono">web/src/lib/spec-schema.ts</span>.
        </p>
      </section>

      {ENDPOINTS.map((e) => (
        <section key={`${e.method} ${e.path}`} className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-mono text-sm">
            <span className="mr-2 rounded bg-accent/15 px-2 py-0.5 text-accent">{e.method}</span>
            {e.path}
            {e.query && <span className="text-muted">{e.query}</span>}
          </h2>
          <p className="mt-2 text-sm text-muted">{e.returns}</p>
          {e.body && (
            <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-4 font-mono text-xs leading-relaxed text-muted">
              {e.body}
            </pre>
          )}
        </section>
      ))}
    </div>
  );
}
