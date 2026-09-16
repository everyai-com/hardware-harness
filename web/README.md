# LUXO — the web platform

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/everyai-com/hardware-harness)

An open-source Blueprint.io alternative and a Hugging Face-style hub for hardware:
generate designs with AI, score them with the [LuxoBench](../harness/) harness, publish
them to a public gallery, record what a build actually cost, and browse open-source kits.
Deployed entirely on Cloudflare.

## The loop

1. **Generate** (`/generate`) — prompt → design spec (BOM, wiring, assembly guide) via
   Workers AI → scored server-side by the harness → published to the gallery. Starter
   templates and clarifying questions included; every example is one tap from the box.
2. **Explore** (`/explore`) — every design is public and remixable, Midjourney-style,
   paginated, searchable, filterable by gate verdict.
3. **Compare** (`/compare`) — the what-changed behind every remix: score delta, gates
   fixed or broken, parts added/removed/changed, cost deltas. Structural, from the engine.
4. **Parts** (`/parts`) — the curated catalogue: real MPNs with typical prices,
   legitimate channels, alternates and counterfeit risk. What grounds a BOM in reality.
5. **Receipts** (`/builds`) — **the part that cannot be generated.** Anyone who builds a
   design reports what the parts really cost, how long it took, whether it powered on, and
   what went wrong. A build earns **VERIFIED** when it carries all four: cost, minutes, a
   working device and an evidence link. Designs nobody has built do not appear. Measured
   builds feed the calibration note on each design: costs run X% over estimate, from N builds.
6. **Kits** (`/kits`) — curated open-source projects with prebuilt-kit paths (Petoi's
   OpenCat is the flagship: open everything, sell the verified kit).
7. **Leaderboard** (`/leaderboard`) — designs ranked by the harness, with the number of
   recorded builds shown next to the score. As agents adopt the API, it ranks the models
   that produced them.
8. **Reference** (`/reference`) — the knowledge layer, free: DFM rules, process data,
   certifications, tariff economics, failure taxonomy.

Every design page carries the full Lovable-class surface: an exploded model preview, the
gates, the scorecard, the cost curve, the landed-cost table, DFM findings, the BOM with
live quotes, wiring, the assembly guide (printable for the bench), and one-tap exports —
spec JSON, BOM CSV, printable guide, plus compare-with-anything.

A generated score is a prediction. The receipts board is the measurement. Keeping those two
visibly separate is the point of the product.

## Stack ("everything in CF")

| Concern | Service |
|---|---|
| App | Next.js (App Router) on **Workers** via `@opennextjs/cloudflare` |
| DB | **D1** + drizzle-orm |
| Generation LLM | **Workers AI** (`AI_MODEL` var, default `@cf/meta/llama-3.3-70b-instruct-fp8-fast`) |
| Cache / rate limits | **KV** (fixed-window counters; see the note below) |
| Canonical origin | **`SITE_URL` var** — sitemap, canonical URLs, Open Graph |

Object storage (R2) is deliberately **not** bound: nothing in the app stores an artifact yet.
Add the bucket back when designs start shipping files (STEP/STL, photos, gerbers).

The scoring engine is the same TypeScript that powers the CLI and the MCP server
(`../harness/`), bundled for workerd by `scripts/build-harness.mjs` (esbuild) and
verified score-identical by `npm run harness:verify`.

## Develop

```bash
npm install --include=dev        # your npm may default to omit=dev
npm run harness:build            # bundle ../harness → src/lib/harness/engine.mjs
npm run harness:verify           # bundle scores == CLI scores on all fixtures
npm test                         # BOM CSV, receipts, slugs, bundled-engine surface
npm run lint                     # eslint (next core-web-vitals + typescript)
npm run db:generate              # drizzle migrations from src/lib/db/schema.ts
npm run db:migrate:local         # apply to local D1
npm run harness:build && node scripts/seed.mjs && npm run db:seed:local
npm run dev                      # next dev with local bindings (D1/KV/AI)
```

Local AI generation uses Workers AI through the remote binding — it needs a
Cloudflare login (`npx wrangler login`) and may incur usage charges. Scoring,
browsing and the API work fully offline against local D1.

## Deploy

```bash
npx wrangler login
npx wrangler d1 create luxo-db            # put the id in wrangler.jsonc
npx wrangler kv namespace create KV       # put the id in wrangler.jsonc
npm run deploy                            # opennextjs-cloudflare build + deploy
npm run db:migrate:remote                 # apply migrations to prod D1
npm run db:seed:remote                    # seed fixtures + kits
npx wrangler secret put AI_MODEL          # optional model override
```

**Set `SITE_URL`** to the deployment's real origin (e.g. `https://luxo.example.com`) in
`wrangler.jsonc` vars or the dashboard. The sitemap, canonical URLs and social cards are built
from it. The default is the local dev origin, and it deliberately does **not** fall back to the
request's `Host` header — that is attacker-controlled.

Note: the bundled worker can exceed the 3 MiB free-plan cap — the $5 Workers Paid
plan (10 MiB) is the safe default.

## Agent API

- `POST /api/evaluate` — spec JSON → full LuxoBench report. Nothing stored.
- `POST /api/designs` — spec JSON → scored + published to the gallery ("push to hub").
- `GET /api/designs?sort=new|score|likes&page=&pageSize=&q=&gates=` — one page of the gallery,
  with totals. Free-text search plus pass/fail gate filter.
- `GET /api/designs/[id]` — one design's spec + report + lineage.
- `GET /api/designs/[id]/bom?qty=` — the BOM as CSV, quantities scaled, live prices where cached.
- `POST /api/designs/[id]/outcomes` — **record a build receipt**: cost paid, minutes, power-on
  verdict, what failed, evidence link.
- `GET /api/designs/[id]/outcomes` — the recorded reality for a design.
- `GET /api/quote?mpn=` — best-effort live LCSC lookup, cached.
- `POST /api/like` — one vote per visitor.

Docs with curl examples: `/api-docs`. The same engine is also an MCP server
(`../harness/src/mcp/server.ts`) for Claude Code, Codex and any MCP client.

### Rate limits and their honesty

Every endpoint that runs the engine, writes a row or calls an upstream API is rate limited —
published in `/api-docs` rather than discovered, with `retry-after` on every rejection, and a
burst limit *plus* a daily quota so one burst cannot spend a day's budget.

The counters live in KV, which is eventually consistent and whose read-modify-write is not
atomic, so a determined burst can exceed a limit by a few calls. That is a deliberate trade for
this workload; exact accounting needs a Durable Object.

## What v1 is not

- **Geometry is declared, not generated from CAD.** The harness reasons over a structured
  `ProductSpec` — a spec author can claim clean walls. The cure is parsing real geometry, and
  then physical receipts.
- **Scores are rubric estimates** (±40% on cost). The receipts board is where they get corrected —
  and measured builds now feed a per-design calibration note plus the `hardware_calibration` MCP tool.
- **The part catalogue is a seed, not a distributor.** 30+ real parts with price bands,
  channels, alternates and counterfeit risk (`/parts`, `hardware_part_lookup`) — enough to
  ground a BOM, not yet live stock and pricing. That is the next integration.
