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

**10 hard gates · 34 DFM rules · 16 failure modes · 16 MCP tools.**

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

## The documents

| File | What it answers |
| --- | --- |
| **`RESEARCH.md`** | The market. Who already builds this, what tooling amortisation, certification and the de minimis repeal do to the economics, and where the wedge is |
| **`OPERATIONS.md`** | What "we're just the middleware" actually costs. Xometry's real P&L, per-order labour, liability, supplier onboarding, cash |
| **`PROCESS.md`** | Every stage of the pipeline and the tool that exists for it today. Also: Lovable funded a direct competitor |
| **`LUXOBENCH.md`** | The benchmark, designed to be ungameable — and the two live runs analysed, with predictions registered before results |
| **`PLAN.md`** | What to build |
| **`BUSINESS.md`** | The four business models with arithmetic, including why low-volume consumer electronics are dead |

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
