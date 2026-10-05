# Blinky — the web platform

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/everyai-com/hardware-harness)

An open-source Blueprint.io alternative and a Hugging Face-style hub for hardware:
generate designs with AI, score them with the [BlinkyBench](../harness/) harness, publish
them to a public gallery, and browse open-source kits. Deployed entirely on Cloudflare.

## The loop

1. **Generate** (`/generate`) — prompt or a starter template (Muse gadget boards included) → design
   spec (BOM, wiring, assembly guide) via Workers AI → scored server-side by the harness →
   published to the gallery. Already have a spec? The **Paste spec JSON** tab validates, scores
   and publishes it through the same endpoint agents use. AI runs stream live stages
   (draft → score → publish) via `POST /api/jobs`.
2. **Refine** (any design page) — "swap the battery for USB power" → revised spec, scored and
   published as a new version. **Compare** (`/d/[id]/compare/[other]`) diffs versions: score,
   gates, cost, findings added/fixed.
3. **Explore** (`/explore`) — every design is public and remixable, Midjourney-style.
4. **Kits** (`/kits`) — curated open-source projects with prebuilt-kit paths (Petoi's
   OpenCat is the flagship: open everything, sell the verified kit).
5. **Leaderboard** (`/leaderboard`) — designs ranked by the harness. As agents adopt
   the API, it ranks the models that produced them.
6. **Reference** (`/reference`) — the knowledge layer, free: DFM rules, process data,
   certifications, tariff economics, failure taxonomy, Muse Gadgets board matrix.
7. **Muse targets** — pick a board the Muse Gadgets SDK actually runs on; the harness verifies
   the match (gate G11) and the design page exports a flash-ready build kit (sdkconfig overlay +
   exact commands + pairing guide).

## Stack ("everything in CF")

| Concern | Service |
|---|---|
| App | Next.js (App Router) on **Workers** via `@opennextjs/cloudflare` |
| DB | **D1** + drizzle-orm |
| Generation LLM | **Workers AI** (`AI_MODEL` var, default `@cf/meta/llama-3.3-70b-instruct-fp8-fast`) |
| Semantic search | **Vectorize** + Workers AI embeddings (similar designs, explore search) |
| Published artifacts | **R2** (the exact spec/report bytes that were scored) |
| Cache / rate limits / stats | **KV** |
| Daily model stats | **Cron Triggers** (`../workers/rollup`, separate worker) |
| Bot protection | **Turnstile** (optional, off unless both keys are set) |

The scoring engine is the same TypeScript that powers the CLI and the MCP server
(`../harness/`), bundled for workerd by `scripts/build-harness.mjs` (esbuild) and
verified score-identical by `npm run harness:verify`.

## Develop

```bash
npm install --include=dev        # your npm may default to omit=dev
npm run setup                    # bundle ../harness + create and seed the local D1
npm run dev                      # next dev with local bindings (D1/R2/KV)
```

`npm run setup` is `harness:build` + `db:migrate:local` + `seed.mjs` + `db:seed:local`.
`npm run dev` re-runs the harness bundle and local migrations itself, so a fresh clone
boots straight into a seeded gallery. The individual steps, if you want them:

```bash
npm run harness:build            # bundle ../harness → src/lib/harness/engine.mjs
npm run harness:verify           # bundle scores == CLI scores on all fixtures
npm test                         # request parsing, rate-limit keys, slugs, kit zip, spec schema
npm run db:generate              # drizzle migrations from src/lib/db/schema.ts
npm run db:migrate:local         # apply to local D1
node scripts/seed.mjs            # regenerate drizzle/seed.sql from the fixtures
npm run db:seed:local
```

Local AI generation uses Workers AI through the remote binding — it needs a
Cloudflare login (`npx wrangler login`) and may incur usage charges. Search uses
the remote Vectorize index the same way. Scoring, browsing and the API work
fully offline against local D1; every cloud feature degrades (search hides,
artifacts fall back to D1, stats hide) instead of erroring.

## Deploy

```bash
npx wrangler login
npx wrangler d1 create blinky-db            # put the id in wrangler.jsonc
npx wrangler kv namespace create KV       # put the id in wrangler.jsonc
npx wrangler r2 bucket create blinky-assets
npx wrangler vectorize create blinky-designs --dimensions=384 --metric=cosine
npm run db:migrate:remote                 # apply migrations to prod D1 (before deploying new code)
npm run deploy                            # opennextjs-cloudflare build + deploy
npm run db:seed:remote                    # seed fixtures + kits
npx wrangler secret put AI_MODEL          # optional model override
npx wrangler secret put ADMIN_TOKEN       # gates the admin routes (backfill, rollup trigger)

# Search index + daily stats (one-time; cron keeps stats fresh after):
curl -X POST https://YOUR-DEPLOYMENT.workers.dev/api/similar/backfill \
  -H 'content-type: application/json' -d '{"token":"<ADMIN_TOKEN>"}'
cd ../workers/rollup && npx wrangler deploy && npx wrangler secret put ADMIN_TOKEN
# then: curl 'https://blinky-rollup.<account>.workers.dev/?token=<ADMIN_TOKEN>'

# Turnstile bot protection — recommended for any public deployment (off until both are set):
# 1. create a widget at dash.cloudflare.com (?to=/:account/turnstile)
# 2. add TURNSTILE_SITE_KEY to wrangler.jsonc vars, and:
npx wrangler secret put TURNSTILE_SECRET_KEY
```

**Upgrading an existing deployment:** run `npm run db:migrate:remote` before `npm run deploy`.
Migration `0004_rate_limits` adds the table the rate limiter now uses; without it every
publish, generation and like fails. If `ADMIN_TOKEN` was ever passed in a URL, rotate it.

Note: the bundled worker can exceed the 3 MiB free-plan cap — the $5 Workers Paid
plan (10 MiB) is the safe default.

**Renamed from LUXO:** `wrangler.jsonc` now asks for a worker named `blinky`, a D1 database
`blinky-db` and an R2 bucket `blinky-assets`. Resources created under the old names still exist —
either create the new ones with the commands above (then re-migrate and re-seed), or set the
`name` / `database_name` / `bucket_name` fields back to the old ones. The `database_id` is
unchanged, so a local `npm run setup` is all existing development needs.

## Agent API

- `POST /api/evaluate` — spec JSON → full BlinkyBench report. Nothing stored.
- `POST /api/designs` — spec JSON → scored + published to the gallery ("push to hub").
- `GET /api/designs?sort=new|score|likes` — the gallery as JSON.
- `GET /api/designs/[id]` — one design's spec + report + lineage.
- `GET /api/designs/[id]/muse` — the Muse Gadgets build kit (board check + exact commands; `?format=zip` downloads it).
- `POST /api/like` — one vote per visitor.
- `GET /api/similar/[id]?limit=4` — nearest designs in embedding space.
- `GET /api/designs/[id]/artifact?file=spec|report` — the scored bytes from R2.
- `GET /api/quote?mpn=...` — best-effort live distributor lookup.
- `GET` + `POST /api/designs/[id]/outcomes` — recorded builds, quotes, tests, notes.
- `POST /api/jobs` — AI generate/refine runs with SSE stages; `GET /api/jobs/[id]` for pollers.

Limits (per client IP — an IPv6 /64 counts as one — per UTC day): 20 publishes, 10 AI
generations, 10 refinements, 100 likes, 30 outcome reports. A publish is only counted once
the spec has passed validation, so iterating on `422` issues is free. Request bodies are
capped at 256 KB, generate prompts at 4,000 characters. `spec.id` is ignored on publish: a
design's id is always its slug.

Docs with curl examples: `/api-docs`. The same engine is also an MCP server
(`../harness/src/mcp/server.ts`) for Claude Code, Codex and any MCP client.

## What v1 is not

Geometry is declared by the design, not parsed from CAD — a spec author can claim
clean walls. Scores are rubric estimates (±40% on cost). The cure is physical
receipts, which is the rest of this repo's plan (`../PLAN.md`).
