# LUXO — the web platform

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/everyai-com/hardware-harness)

An open-source Blueprint.io alternative and a Hugging Face-style hub for hardware:
generate designs with AI, score them with the [LuxoBench](../harness/) harness, publish
them to a public gallery, and browse open-source kits. Deployed entirely on Cloudflare.

## The loop

1. **Generate** (`/generate`) — prompt → design spec (BOM, wiring, assembly guide) via
   Workers AI → scored server-side by the harness → published to the gallery.
2. **Explore** (`/explore`) — every design is public and remixable, Midjourney-style.
3. **Kits** (`/kits`) — curated open-source projects with prebuilt-kit paths (Petoi's
   OpenCat is the flagship: open everything, sell the verified kit).
4. **Leaderboard** (`/leaderboard`) — designs ranked by the harness. As agents adopt
   the API, it ranks the models that produced them.
5. **Reference** (`/reference`) — the knowledge layer, free: DFM rules, process data,
   certifications, tariff economics, failure taxonomy.

## Stack ("everything in CF")

| Concern | Service |
|---|---|
| App | Next.js (App Router) on **Workers** via `@opennextjs/cloudflare` |
| DB | **D1** + drizzle-orm |
| Generation LLM | **Workers AI** (`AI_MODEL` var, default `@cf/meta/llama-3.3-70b-instruct-fp8-fast`) |
| Files | **R2** |
| Cache / rate limits | **KV** |

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
npm run db:generate              # drizzle migrations from src/lib/db/schema.ts
npm run db:migrate:local         # apply to local D1
node scripts/seed.mjs            # regenerate drizzle/seed.sql from the fixtures
npm run db:seed:local
```

Local AI generation uses Workers AI through the remote binding — it needs a
Cloudflare login (`npx wrangler login`) and may incur usage charges. Scoring,
browsing and the API work fully offline against local D1.

## Deploy

```bash
npx wrangler login
npx wrangler d1 create luxo-db            # put the id in wrangler.jsonc
npx wrangler kv namespace create KV       # put the id in wrangler.jsonc
npx wrangler r2 bucket create luxo-assets
npm run deploy                            # opennextjs-cloudflare build + deploy
npm run db:migrate:remote                 # apply migrations to prod D1
npm run db:seed:remote                    # seed fixtures + kits
npx wrangler secret put AI_MODEL          # optional model override
```

Note: the bundled worker can exceed the 3 MiB free-plan cap — the $5 Workers Paid
plan (10 MiB) is the safe default.

## Agent API

- `POST /api/evaluate` — spec JSON → full LuxoBench report. Nothing stored.
- `POST /api/designs` — spec JSON → scored + published to the gallery ("push to hub").
- `GET /api/designs?sort=new|score|likes` — the gallery as JSON.
- `GET /api/designs/[id]` — one design's spec + report + lineage.
- `POST /api/like` — one vote per visitor.

Docs with curl examples: `/api-docs`. The same engine is also an MCP server
(`../harness/src/mcp/server.ts`) for Claude Code, Codex and any MCP client.

## What v1 is not

Geometry is declared by the design, not parsed from CAD — a spec author can claim
clean walls. Scores are rubric estimates (±40% on cost). The cure is physical
receipts, which is the rest of this repo's plan (`../PLAN.md`).
