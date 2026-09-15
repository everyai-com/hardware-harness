# Hardware Harness

Research and working code for **verified hardware**: proving whether an AI-generated physical design
is real, what it costs, and whether it can be built — before anyone spends money.

Everything here came out of a single question: an AI designed a working-looking DJ controller, 459
people replied, 23 asked what it cost, and **nobody answered**. Nobody built it either. This repo is the
answer to that.

---

## The one-line thesis

Everyone else generates the design. **The scarce thing is verifying it against reality** — that it
can be manufactured, what it truly costs at 1 / 100 / 1,000 units, and whether it works when it
arrives. Generation is free and commoditised. Verification is not.

---

## What we are building

**A verification layer for physical products — and the businesses that only become possible once it
exists.** Concretely, three things in sequence:

1. **The harness** (built). A model-agnostic engine that takes any hardware design and answers: are the
   parts real and orderable, does the CAD hold up, does the firmware match the board, what does it
   truly cost at 1 / 100 / 1,000 units, and can a human assemble it. Free rules, published scorecards.
2. **Verified builds** (next). Take a design — anyone's — build it, time it, photograph the power-on,
   and publish the invoice, the landed cost and the failure list. The receipt is the product nobody
   currently sells. It also produces the outcome data that makes the cost model accurate.
3. **Verified subassembly kits** (then). Sell the *parts of a thing* rather than the thing: a verified
   board, a module set, printed parts, a build guide. **FCC 15.101** exempts subassemblies sold for
   further fabrication — the buyer assembles it and owns the finished device. That removes certification,
   removes assembly labour, and gives this audience exactly what it wants: to build their own.

**Why verification and not generation:** generation is free and commoditised — Blueprint, RapidDirect
and Zoo give it away, and Lovable funded a direct competitor. What has never been published is *what it
cost and whether it worked*.

Full reasoning: **`PLAN.md`** (what to build) and **`BUSINESS.md`** (which models clear, with arithmetic).

---

## How to read this repo

**New here? Read in this order — 30 minutes end to end:**

| # | Read | You'll learn |
|---|---|---|
| 1 | This file | The project and the thesis |
| 2 | **`EVIDENCE.md`** | Every primary source, so you can check anything |
| 3 | **`BUSINESS.md`** | The four business models with arithmetic, and the dead zone |
| 4 | **`PLAN.md`** | What we're building, in what order, with kill criteria |
| 5 | **`LUXOBENCH.md`** §1–5 | The benchmark, and what the two live runs actually showed |
| 6 | `harness/README.md` | The engine, and how to wire it into your agent |

Then, if you want the depth: `RESEARCH.md` (the market), `OPERATIONS.md` (what running this costs),
`PROCESS.md` (every stage of the pipeline and the tool for it).

**Want to contribute?** The open work is in `PLAN.md` §30/60/90 and at the end of `harness/README.md`:
wire live LCSC/JLCPCB/DigiKey quotes into the cost engine, add STEP parsing so geometry is measured
instead of declared, and close the physical loop with a first verified build.

---

## The code — `harness/`

A model-agnostic engine plus an MCP server. No dependencies, no API keys, no inference. Bring your own
agent (Claude Code, Codex, anything that speaks MCP); the harness brings the manufacturing knowledge.

```bash
cd harness
node src/index.ts                 # score the designs from the first public benchmark run
node src/index.ts --business      # which business models actually clear
node src/index.ts --fulfilment    # one unit at a time vs batched production
node src/index.ts --taxonomy      # the accumulated failure library
node src/index.ts --full lamp-astra
node --test "tests/*.test.ts"     # 14 tests incl. the MCP transport
node src/mcp/server.ts            # MCP server (stdio)
```

**10 hard gates · 36 DFM rules · 16 failure modes · 14 MCP tools.**

What it catches today, on real published designs:

| Design | Score | Gates | Worst finding |
| --- | --- | --- | --- |
| Cube lamp — Astra | 4.13/5 | FAIL | The "face" is on the **back** of the base |
| Cube lamp — Fable 5.1 | 1.79/5 | FAIL | Firmware pin map contradicts the board footprints |
| Mini DJ controller | 1.85/5 | FAIL | 25 parts, no board in the BOM, firmware never compiled |
| Voice note-taker (generated) | 1.33/5 | FAIL | 5 electronic parts, **no firmware shipped at all** |
| Voice note-taker (board-based) | 3.38/5 | FAIL | Lithium cell — the one honest remaining trade |

See `harness/README.md` for the tool list and MCP wiring.

---

## The platform — `web/`

**LUXO** — the open-source Blueprint.io alternative and the distribution layer for everything above.
A Hugging Face-style hub for hardware, deployed entirely on Cloudflare (Next.js on Workers, D1, R2,
KV, Workers AI). MIT licensed, one-click self-hostable.

- **Generate** — prompt → design spec (BOM, wiring, assembly guide) → scored by the same harness →
  public gallery. Workers AI free tier, no API keys.
- **Explore** — every design is public and remixable, Midjourney-style: show people what's possible.
- **Kits** — open-source projects with prebuilt-kit paths. Flagship: Petoi's OpenCat/Bittle — open
  everything, sell the verified kit. The model for the eventual robotics line.
- **Leaderboard + agent API** — `POST /api/designs` is push-to-hub for agents; as they adopt it, the
  leaderboard stops ranking designs and starts ranking the models that produced them.

```bash
cd web
npm install --include=dev
npm run setup            # bundle the harness, create and seed the local D1
npm run dev              # http://localhost:3000
```

`npm run harness:verify` proves the bundled engine scores identically to the CLI.

Deploy instructions: `web/README.md`.

---

## The documents

| File | What it answers |
| --- | --- |
| **`EVIDENCE.md`** | **Every primary source**, mapped to the claim it supports |
| **`RESEARCH.md`** | The market. Who already builds this, what tooling amortisation, certification and the de minimis repeal do to the economics, and where the wedge is |
| **`OPERATIONS.md`** | What "we're just the middleware" actually costs. Xometry's real P&L, per-order labour, liability, supplier onboarding, cash |
| **`PROCESS.md`** | Every stage of the pipeline and the tool that exists for it today. Also: Lovable funded a direct competitor |
| **`LUXOBENCH.md`** | The benchmark, designed to be ungameable — and the two live runs analysed, with predictions registered before results |
| **`PLAN.md`** | What to build |
| **`BUSINESS.md`** | The four business models with arithmetic, including why low-volume consumer electronics are dead |
| **`apify-output/`** | **The raw scraped thread** — 459 comments, 395 authors, Sep 2026. The primary evidence behind `LUXOBENCH.md` §9–11 |
| **`data_x_comments.csv`** | An earlier 50-reply sample of the same thread |

---

## The five findings that matter most

1. **Certification creates a hard volume wall.** $10,500 of FCC + UN38.3 is $105/unit at 100 units and
   $10.50 at 1,000. Below ~10k units, regulated electronics cannot compete on price. This is arithmetic,
   not opinion.
2. **Per-unit labour is the dominant cost at low volume.** The generated voice note-taker: $38 of parts,
   **$153 of assembly labour**, 262 minutes. The same product rebuilt around one assembled PCB: 39
   minutes.
3. **Nobody publishes cost.** 24 asks across three datasets, zero answers. It is the most-requested and
   least-supplied number in the category — which makes it the product.
4. **Geometric overlap is the wrong metric.** The highest-scoring CAD model on the market put a lamp's
   face on the back of its base. Shape matching cannot see intent.
5. **Kits do not dodge certification; subassemblies do.** FCC 15.101 exempts a subassembly sold for
   further fabrication — the buyer becomes the responsible manufacturer. That is how the entire maker
   economy legally operates, and it is the shape of a viable product.

---

## Layout

```
harness/          the engine, gates, fixtures and MCP server
  src/knowledge/  manufacturing, compliance, cost and failure data — every rule carries its evidence
  src/engine/     DFM checks, process selection, landed cost, gates, scorecard, business + fulfilment
  src/fixtures/   the lamp reference, the two live benchmark designs, and the corrected rebuild
  src/mcp/        the MCP stdio server
apify-output/     raw scraped thread data (gitignored)
*.md              the research and decision documents
```

## Not committed

`.env` (Apify token), `node_modules/`, and raw scraped thread exports — all gitignored.

## Status

Research complete, harness working, no physical build yet. The next real step is closing the loop:
take one design through a verified build and publish the invoice, the landed cost, the assembly time
and the power-on.
