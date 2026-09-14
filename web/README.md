# LUXO — the web platform

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/everyai-com/hardware-harness)

An open-source Blueprint.io alternative and a Hugging Face-style hub for hardware:
generate designs with AI, score them with the [LuxoBench](../harness/) harness, publish
them to a public gallery, record what a build actually cost, and browse open-source kits.
Deployed entirely on Cloudflare.

## The loop

1. **Generate** (`/generate`) — prompt → design spec (BOM, wiring, assembly guide) via
   Workers AI → scored server-side by the harness → published to the gallery.
2. **Explore** (`/explore`) — every design is public and remixable, Midjourney-style, paginated.
3. **Receipts** (`/builds`) — **the part that cannot be generated.** Anyone who builds a
   design reports what the parts really cost, how long it took, whether it powered on, and
   what went wrong. A build earns **VERIFIED** when it carries all four: cost, minutes, a
   working device and an evidence link. Designs nobody has built do not appear.
4. **Kits** (`/kits`) — curated open-source projects with prebuilt-kit paths (Petoi's
   OpenCat is the flagship: open everything, sell the verified kit).
5. **Leaderboard** (`/leaderboard`) — designs ranked by the harness, with the number of
   recorded builds shown next to the score. As agents adopt the API, it ranks the models
   that produced them.
6. **Reference** (`/reference`) — the knowledge layer, free: DFM rules, process data,
   certifications, tariff economics, failure taxonomy.

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
- `GET /api/designs?sort=new|score|likes&page=&pageSize=` — one page of the gallery, with totals.
- `GET /api/designs/[id]` — one design's spec + report + lineage.
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
- **Scores are rubric estimates** (±40% on cost). The receipts board is where they get corrected.
- **No part catalogue.** The harness validates the parts a design declares (`G1`) and can price a
  supplied quote, but it does not hold its own verified library of parts, availability and
  prices. That is the largest missing capability relative to the funded tools in this category
  — see `PROCESS.md` §3.
