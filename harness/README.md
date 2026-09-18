# Hardware Harness

**Bring your own agent. The harness supplies the manufacturing knowledge, the cost model and the gates.**

Models change every six weeks. The rules for what can actually be manufactured, what it costs and
what fails do not. This is that durable layer, exposed as MCP tools so any agent — Claude Code, Codex,
Cursor, your own loop — can drive it.

It exists because a viral demo showed that AI can produce a complete hardware design, and then
**twenty-three people asked what it cost and got no answer**, and **nobody built it**. Designs are
cheap now. Verification is not.

---

## Quick start

No dependencies. Requires Node >= 22.6 (uses native TypeScript type stripping).

```bash
node src/index.ts                 # score the first public benchmark run
node src/index.ts --full lamp-astra
node src/index.ts --json           # the whole run as machine-readable JSON
node src/index.ts --quotes         # re-price catalog parts from live LCSC data (needs network)
node src/index.ts --stl part.stl   # measure a mesh: bbox, volume, surface area, watertightness
node src/index.ts --taxonomy      # the accumulated failure library

node --test "tests/*.test.ts"     # 27 tests, including the MCP transport
node src/mcp/server.ts            # the MCP server (stdio)
```

## Wire it into your agent

**Claude Code** — add to `.mcp.json` (or `~/.claude.json`):

```json
{
  "mcpServers": {
    "hardware-harness": {
      "command": "node",
      "args": ["/absolute/path/to/harness/src/mcp/server.ts"]
    }
  }
}
```

**Codex** — `~/.codex/config.toml`:

```toml
[mcp_servers.hardware-harness]
command = "node"
args = ["/absolute/path/to/harness/src/mcp/server.ts"]
```

Then ask your agent for a design and have it call `hardware_evaluate` before anything gets ordered.
The point is that the agent produces the design and the harness decides whether it is real.

---

## The tools

| Tool | What it answers |
| --- | --- |
| `hardware_evaluate` | Full evaluation: findings, gates, scorecard, cost, lead time. **The acceptance test.** |
| `hardware_gates` | The ten hard pass/fail gates only |
| `hardware_dfm_check` | Wall thickness, draft, supports on cosmetic faces, feature minimums, tolerance stacks, part count, improvised operations, drop screening |
| `hardware_landed_cost` | Cost per unit at qty 1 / 100 / 1000 including tooling amortisation, duty, inspection, certification, signed drivers, defect reserve |
| `hardware_process_select` | Best process for one part *at a given quantity*, with the crossover quantity where a tooled process wins |
| `hardware_certification` | Which certifications the design triggers, published cost ranges, and the avoidance strategies |
| `hardware_sourcing_rules` | Where to buy each part class, which types get counterfeited, the authorised premium, reel/cut-tape rules |
| `hardware_failure_taxonomy` | Every failure already observed in public AI hardware runs, with evidence |
| `hardware_process_data` | Raw process capability, cost and lead-time data |
| `hardware_rules` | The rule catalogue with rationale and evidence, plus 2026 tariff and QC economics |
| `hardware_fixture` | The cube-lamp reference criteria, or a reconstructed design from the first public run |
| `hardware_spec_schema` | The `ProductSpec` shape the harness expects |
| `hardware_business_model` | Which of the four business models clears at the design's volumes, with the arithmetic |
| `hardware_fulfilment` | One unit at a time vs batched production: where the labour and lead time actually go |
| `hardware_record_outcome` | Record what a design **actually** cost and whether it worked — appends a local JSONL receipt and returns the request to publish it to a LUXO deployment |

## The gates

Failing any one means the design cannot ship, regardless of everything else.

1. **G1** Every part real, in stock, orderable at the target quantity
2. **G2** CAD opens clean — no manual repair
3. **G3** ERC and DRC clean, footprints matched to parts
4. **G4** No mains voltage inside the product, no lithium cell
5. **G5** Part count within the 15-part budget
6. **G6** No improvised operations ("file to fit", structural epoxy, custom fixtures)
7. **G7** Programmable and analog parts from authorised channels
8. **G8** Certification identified and budgeted
9. **G9** Every reference feature present **and on the correct face**
10. **G10** Firmware ships, compiles, and matches the board pin map

G9 exists because a model that scores 95.9% on a geometric-overlap CAD benchmark put the "face" of a
lamp on the back of its base. Shape-matching cannot catch that. A human catches it in half a second.

---

## What it produces

From the reconstructed first public run (`node src/index.ts`):

| Design | Score | Gates | Parts | Assembly | Worst block |
| --- | --- | --- | --- | --- | --- |
| Cube lamp — Astra | 4.13/5 | FAIL | 8 | 10 min | `FEATURE_MISPLACED` — the "face" is on the **back** |
| Cube lamp — Fable 5.1 | 1.79/5 | FAIL | 17 | 32 min | `TOLERANCE_UNACHIEVABLE` — ±0.3mm on an FDM part |
| Mini DJ controller | 1.85/5 | FAIL | 25 | 61 min | `ELECTRONICS_WITHOUT_PCB` — 25 parts, no board in the BOM |
| Voice note-taker (generated) | 1.33/5 | FAIL | 25 | 262 min | `MISSING_POWER_SOURCE` — no firmware shipped |
| Voice note-taker (board-based) | 3.38/5 | FAIL | 8 | 39 min | `LITHIUM_CELL` — the one honest remaining trade |

And the cost table for the Astra lamp at a $69 target retail:

| Qty | Build one | Sell one (incl. compliance) | Margin |
| --- | --- | --- | --- |
| 1 | $30.40 | $3,030.40 | — |
| 100 | $28.86 | $58.86 | 14.7% |
| 1000 | $23.21 | $26.21 | 62.0% |

That table is the product. **A $69 lamp is not a business at 100 units** — the certification filing
eats the margin — and it is a good business at 1,000. Nobody else is publishing this number.

---

## Design principles

- **Rules carry their evidence.** Every rule and every failure mode cites the real failure that
  produced it. Nothing here is a vibe.
- **Gates are separate from scores.** Gates are pass/fail reality checks; scores are comparisons. A high
  score with a failed gate is still a failed design.
- **Model-agnostic by construction.** No inference, no API keys, no vendor. The client brings the model.
- **Buy beats build where it applies.** Sourcing rules point at authorised distributors rather than
  pretending the harness can verify authenticity itself.
- **Honest uncertainty.** Cost estimates are labelled ±40% and calibrated to published 2026 ranges.

## Limitations (read these)

- **Costs are estimates** unless you pass `--quotes`, which re-prices catalog parts from live LCSC
  data before evaluation (the engine itself stays offline and synchronous). Quotes are best-effort:
  anything blocked, out of stock or not a confident MPN match falls back to the published-range
  estimate, which is what every number here is calibrated to.
- **The fixtures are reconstructions.** Neither author published their BOM. Replace
  `src/fixtures/keil-runs.ts` with real data when it lands — the checks and scoring do not change.
- **Geometry is measured for STL, declared for everything else.** `src/geometry/stl.ts` parses a mesh
  (binary or ASCII), measures the bounding box, the enclosed volume and surface area, and checks
  watertightness by edge manifoldness. A part carrying `measured` is costed from the real volume and
  has its declaration audited against the mesh (`GEOMETRY_MISMATCH`, `GEOMETRY_NOT_WATERTIGHT`). Walls,
  draft and faces are still declared, and STEP (B-rep rather than mesh) is still unparsed.
- **No outcome data yet.** `hardware_record_outcome` records what actually got built, and a LUXO
  deployment stores it, but the dataset is empty until real builds land. The compounding asset is
  that record, not the tool.

## Next steps, in order

1. Extend live quoting beyond LCSC passives and ICs — the fab/tooling side (JLCPCB, DigiKey as a
   second source) still runs on the published-range proxies.
2. Extend geometry ingestion from STL to STEP, and derive walls, draft and faces from the mesh instead
   of reading them from the spec.
3. Fill the outcome dataset. `hardware_record_outcome` and the LUXO outcomes API both work; neither
   has real build data in it yet, and that data is what makes the rules learned rather than static.
4. Publish the scorecard against a real fixture build — the invoice, the cost sheet, the assembly
   time, and the power-on.
