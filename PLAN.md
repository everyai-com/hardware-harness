# PLAN — What To Actually Build

*Decision doc. 13 Sep 2026. Reads with `RESEARCH.md`, `OPERATIONS.md`, `PROCESS.md`, `LUXOBENCH.md`,
and the working code in `harness/`.*

---

## The decision

**Be the third-party verifier for AI-designed hardware.** Publish the scorecard, the invoice, the
assembly time and the power-on — for designs other people generate. Free rules, paid receipts.

One sentence: *everyone else generates the design; you prove whether it is real and you own the
consequence if it isn't.*

## Why this one, and what it kills

| Candidate | Verdict |
|---|---|
| Another design generator | **Dead.** Blueprint ships it free, RapidDirect ships it free with a factory behind it, Zoo gives away text-to-CAD, and Atech raised money from Lovable itself. The generation layer is a commodity. |
| A marketplace connecting buyers to factories | **Dead.** Xometry: $807M TTM, 1,174 employees, –$61.7M net loss, 13 years in. You would be competing with a public company on working capital. |
| "Partner with a few Chinese factories" | **Dead.** No volume means no leverage, a few factories means single-point-of-failure, and de minimis repeal taxes every small parcel. |
| A design tool for engineers | **Crowded.** Leo AI ($9.7M), JuliaHub ($65M), Autodesk Fusion MCP, Neural Concept. Enterprise sales, long cycles, incumbents shipping. |
| **The verification layer** | **Open.** Nobody publishes cost. Nobody publishes a build. 23 people asked what the DJ controller cost and got nothing. Keil's own rubric lists cost and lead time and he hasn't published either. The crowd's words: *"Post the invoice for the parts or it never happened."* That is the vacancy, and it is a verifiable-claim business, not a claim business. |

## The product is three artifacts

1. **The scorecard** — what the harness already produces: gates, findings, score, lead time, assembly
   estimate. Machine-readable, comparable across models, publishable.
2. **The receipt** — the thing nobody has. Real invoice, real landed cost at qty 1/100/1000, real
   lead time, timed blind assembly, and a power-on verdict. **This is the paid product.**
3. **The dataset** — every design → score → actual cost / defects / build outcome, recorded. This is
   the compounding asset. It is what turns ±40% estimates into ±10%, and what makes the DFM rules
   learned rather than static.

## Business model

**Free (distribution):** the DFM rules, the spec format, the benchmark fixtures, the scorecard format.
Open them. The labs will absorb the rules anyway, and published rules are how the format becomes the
standard — the same way CursorBench became the standard by being published.

**Paid (the receipts):**
- **Verified build** — $150–500 per design, or bundled with the kit. You build it, you time it, you
  publish it, you say whether it works. This is the QIMA/SGS model ($250–400 per inspection man-day)
  applied to designs instead of factory batches.
- **Kit + verified build for a niche** — premium one-off kits where the buyer wants "it arrives and it
  works" (`RESEARCH.md` §10: $80–200 FDM, $250–600 SLS).
- **Outcome data / eval access** — once there are hundreds of scored builds, sell the eval to labs
  building hardware agents. EEBench is the precedent: a benchmark built by a company to pick models
  for its own product, published, and now cited in frontier model cards.

## Do this week — the whole of Phase 0

1. **Run the harness on the reference fixture** and publish the scorecard. You already have the engine;
   this costs an afternoon and $0.
2. **Take the Astra design defect public, neutrally.** "Face on the back, caught by a feature-placement
   check; here's the check." Not a dunk — a demonstration that intent is a testable property, and that
   BenchCAD's geometric-overlap score cannot see it.
3. **Build one lamp** from the reference render, to the harness's own gates, and record every number:
   invoice, landed cost, minutes to assemble, lux, temperature after four hours, drop result.
4. **Publish the receipt.** Cost sheet, invoice, timelapse, power-on, and what went wrong. Say what you
   would change. This is the artifact the entire thread asked for and nobody produced.
5. **Reply to Keil's open call** — he asked publicly for collaborators on 10 Sep (34 replies, 254
   likes) and his two builds land within the week. Offer the measurement sheet, not a partnership.

**Budget: ~$300–600 and a weekend.** That is the entire Phase 0 cost, and it produces the only artifact
this category currently lacks.

## 30 / 60 / 90

| Horizon | Goal | Success test |
|---|---|---|
| **30 days** | Receipts published for 3 designs; harness open-sourced with the spec format | At least one design you scored got built by someone else using your scorecard; at least one failure mode added by an outsider |
| **60 days** | Paid verified builds; outcome database started | 10 paid verifications, each with cost + build data recorded; cost estimates tighten toward ±15% on categories you have run |
| **90 days** | The scorecard is the reference implementation | A lab or a major tool cites your scorecard; inbound from at least two of: Blueprint, Artilora, RapidDirect, Atech, Keil |

## Why the dataset is the actual moat

The rules can be copied, and will be. The spec format can be reimplemented. What cannot be
reconstructed from the outside is: **for this design, at this quantity, from this supplier, the part
cost this much, arrived in this many days, and failed in this way.** That record is only available to
whoever does the builds. Every build makes the next estimate sharper and the next design cheaper to
verify — and it is the only thing here that gets harder to copy over time rather than easier.

## Kill criteria (set them now)

- **If the first three builds come in worse than ±25% against the harness estimate**, the cost engine
  is not good enough to sell. Either fix it with real quotes (LCSC/JLCPCB/DigiKey APIs) or drop the
  pricing claim and sell only the build.
- **If nobody will pay for a verified build after 10 conversations**, the market wants entertainment,
  not verification. Pivot the same engine to eval/benchmark-as-a-service for labs and stop buying parts.
- **If a generator publishes signed receipts first** (Blueprint, Artilora or RapidDirect), the window
  has closed and you are a feature, not a company. Move to the niche-kit model or to the eval business.

## The one honest risk

This is a services business wearing a software costume — the same shape as `OPERATIONS.md`, but with
one difference that matters: **you are selling verification, not fulfilment.** You do not need 1,174
employees or $807M of GMV. You need a reputation for being the one who actually builds it, and the
data that only building gives you. Verification is the only part of this stack where being small is an
advantage, because the whole offer is independence.

The clock is real: Keil's builds land within days, and the first person to publish a rigorous receipt
owns the position.
