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
node src/index.ts --taxonomy      # the accumulated failure library

node --test "tests/*.test.ts"     # 14 tests, including the MCP transport
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
| `hardware_gates` | The nine hard pass/fail gates only |
| `hardware_dfm_check` | Wall thickness, draft, supports on cosmetic faces, feature minimums, tolerance stacks, part count, improvised operations |
| `hardware_landed_cost` | Cost per unit at qty 1 / 100 / 1000 including tooling amortisation, duty, inspection, certification, signed drivers, defect reserve |
| `hardware_process_select` | Best process for one part *at a given quantity*, with the crossover quantity where a tooled process wins |
| `hardware_certification` | Which certifications the design triggers, published cost ranges, and the avoidance strategies |
| `hardware_sourcing_rules` | Where to buy each part class, which types get counterfeited, the authorised premium, reel/cut-tape rules |
| `hardware_failure_taxonomy` | Every failure already observed in public AI hardware runs, with evidence |
| `hardware_process_data` | Raw process capability, cost and lead-time data |
| `hardware_rules` | The rule catalogue with rationale and evidence, plus 2026 tariff and QC economics |
| `hardware_fixture` | The cube-lamp reference criteria, or a reconstructed design from the first public run |
| `hardware_spec_schema` | The `ProductSpec` shape the harness expects |

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

G9 exists because a model that scores 95.9% on a geometric-overlap CAD benchmark put the "face" of a
lamp on the back of its base. Shape-matching cannot catch that. A human catches it in half a second.

---

## What it produces

From the reconstructed first public run (`node src/index.ts`):

| Design | Score | Gates | Parts | What it caught |
| --- | --- | --- | --- | --- |
| Cube lamp — Astra | 3.18/5 | FAIL | 8 | Face is on the **back** — the reported defect |
| Cube lamp — Fable 5.1 | 1.55/5 | FAIL | 17 | Dome wall 0.9mm (below FDM minimum), tolerances tighter than the process holds, one "file to fit" step |
| Mini DJ controller | 1.91/5 | FAIL | 25 | Two tolerance stacks, counterfeit exposure on the MCU class |

And the cost table for the Astra lamp at a $69 target retail:

| Qty | Build one | Sell one (incl. compliance) | Margin |
| --- | --- | --- | --- |
| 1 | $32.45 | $3,032.45 | — |
| 100 | $30.13 | $60.13 | 12.9% |
| 1000 | $23.43 | $26.43 | 61.7% |

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

- **Costs are estimates**, calibrated to published ranges, not live quotes. Wire in real distributor
  and fab APIs (LCSC, JLCPCB, DigiKey) to replace the proxies with quotes.
- **The fixtures are reconstructions.** Neither author published their BOM. Replace
  `src/fixtures/keil-runs.ts` with real data when it lands — the checks and scoring do not change.
- **Geometry is declared, not parsed.** The harness reasons over a structured `ProductSpec`
  (walls, draft, tolerances, faces), not over a STEP file. Parsing real geometry is the obvious next
  step, and the reason the spec layer has to come first.
- **No outcome data yet.** The compounding asset is recording what actually got built and what failed.
  That loop is not closed here — it is the next real build.

## Next steps, in order

1. Replace cost proxies with live quotes from LCSC / JLCPCB / DigiKey APIs.
2. Add STEP/STL ingestion so walls, draft and faces are measured instead of declared.
3. Record real build outcomes (`hardware_record_outcome`) so the rules stop being static and start
   being learned.
4. Publish the scorecard against a real fixture build — the invoice, the cost sheet, the assembly
   time, and the power-on.
