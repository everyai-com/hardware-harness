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
    query: "?sort=new|score|likes&page=1&pageSize=24&q=&gates=pass|fail",
    returns:
      "One page of the public gallery as JSON, with { page, pageSize, total, hasMore } so nothing is silently truncated. Filter by free text (title/prompt) or by gate verdict.",
  },
  {
    method: "GET",
    path: "/api/designs/[id]",
    returns: "One design's full spec + report + remix lineage as JSON.",
  },
  {
    method: "GET",
    path: "/api/designs/[id]/bom",
    query: "?qty=1",
    returns:
      "The bill of materials as CSV: one row per part with channel, scaled quantities, and live LCSC prices where cached. The supply-chain artifact — paste it into a cart or hand it to an assembler.",
  },
  {
    method: "POST",
    path: "/api/designs/[id]/outcomes",
    body: `{
  "kind": "build" | "quote" | "test" | "note",
  "summary": "Printed both halves, wired the LED module, powered on first try",
  "author": "your-handle",
  "data": {
    "costPaidUsd": 43.10,
    "assemblyMinutes": 38,
    "poweredOn": true,
    "failed": "USB-C cutout needed 0.2mm filing",
    "proofUrl": "https://example.com/photo.jpg"
  }
}`,
    returns:
      "201 with the stored outcome. This is the loop the project exists for: estimates are claims, receipts are measurements. A build earns the VERIFIED marker when it carries a cost, assembly minutes, a working device and an evidence link — anything less is still stored, and still useful, but is not a receipt.",
  },
  {
    method: "GET",
    path: "/api/designs/[id]/outcomes",
    returns: "The recorded reality for one design: builds, live quotes, test results, notes.",
  },
  {
    method: "GET",
    path: "/api/quote",
    query: "?mpn=ESP32-S3",
    returns:
      "A best-effort live distributor lookup (LCSC), cached. Returns { quote: null } on any failure — the harness estimate is the floor, never the live lookup.",
  },
  {
    method: "POST",
    path: "/api/like",
    body: `{ "id": "lamp-astra" }`,
    returns: "{ likes, voted } — one vote per visitor, and only for a design that exists.",
  },
];

/**
 * Rate limits, stated plainly. They exist because the endpoints run the engine or
 * call an upstream API — they are free to use, not free to run.
 */
const LIMITS = [
  { endpoint: "POST /api/evaluate", limit: "30/min, 2,000/day per visitor" },
  { endpoint: "POST /api/designs", limit: "5/min, 20/day per visitor" },
  { endpoint: "POST /api/designs/[id]/outcomes", limit: "5/min, 40/day per visitor; 20/day per design" },
  { endpoint: "GET /api/quote", limit: "20/min, 500/day per visitor" },
  { endpoint: "POST /api/like", limit: "60/hour per visitor" },
  { endpoint: "All JSON endpoints", limit: "256 KiB request body" },
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

      <section className="rounded-xl border border-line bg-card p-5">
        <h2 className="font-semibold">Rate limits</h2>
        <p className="mt-1 text-sm text-muted">
          Published rather than discovered. Every rejection says which limit was hit and when it resets
          (<span className="font-mono">retry-after</span>). Self-host for no limits at all.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="py-2">Endpoint</th>
              <th scope="col" className="py-2">Limit</th>
            </tr>
          </thead>
          <tbody>
            {LIMITS.map((l) => (
              <tr key={l.endpoint} className="border-b border-line/50 last:border-0">
                <td className="py-2 font-mono text-xs">{l.endpoint}</td>
                <td className="py-2 text-muted">{l.limit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
