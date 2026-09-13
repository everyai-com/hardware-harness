# BUSINESS — What Is Viable

*Decision doc. 13 Sep 2026. Numbers produced by `harness/` (`node src/index.ts --business`), traceable
to the fixtures. Reads with `PLAN.md`.*

---

## The yardstick

Hardware has one metric software does not: **gross profit per hour of your own labour.**

Software scales labour to zero. Hardware does not — every physical unit needs hands, and hands do not
get cheaper with volume. So any hardware model that hides labour inside "COGS" is telling you a story.
This doc prices the labour explicitly, and that single number separates the businesses from the hobbies.

## The four models, run against real specs

| Model | Price | Unit cost | Gross margin | Gross profit / month | Your labour | **Per labour hour** | Verdict |
|---|---|---|---|---|---|---|---|
| Sell low-volume consumer electronics | $79 | $218.01 | **−176%** | −$7,150 | 218 hrs | **−$31.83** | **UNVIABLE** |
| Sell premium objects, no electronics | $149 | $42.40 | **71.5%** | $4,114 | 23 hrs | **$182.77** | **VIABLE** |
| Verified builds for other people's designs | $300 | $60 | 80% | $1,770 | 32 hrs | **$60** | Viable, but it's a job |
| Harness seats — early (20 studios) | $99 | $4 | 96% | $1,400 | 42 hrs | $45 | Viable, barely |
| Harness seats — at scale (100 studios) | $99 | $4 | 96% | $8,600 | 50 hrs | **$190** | **VIABLE** |

Sources: unit costs come from `landedCost()` on the Astra lamp, the Blueprint voice note-taker, and the
board-based rebuild. Labour minutes come from `estimateAssemblyMinutes()`. Nothing here is a guess
dressed as a number.

## The dead zone, named

**Low-volume consumer electronics are arithmetically dead, and no amount of good design fixes it.**

The generated voice note-taker is the proof: parts cost **$38**, assembly takes **262 minutes** and
costs **$153**, certification costs **$10,500**, and the target retail is **$79**. Even rebuilt
correctly — one assembled PCB instead of 18 hand-soldered wires — it lands at $67 with a **5% margin**.
It only becomes a business at **$129–149 retail, or with no radio at all.**

Three costs stack against you simultaneously at low volume, and each one is structural:

1. **Per-unit labour.** 4.4 hours of hand-wiring cannot be amortised. It is the same at unit 1 and
   unit 10,000.
2. **Certification amortisation.** $10,500 of FCC and UN38.3 spread over 100 units is $105 per unit.
   Spread over 1,000 it is $10.50.
3. **Duty after de minimis.** 20–30% on every parcel, with no duty-free lane left.

Any two of these can be survived. All three at once, at a $79 price point, cannot.

## Why the winners win

**Premium objects with no electronics ($183/hr, 71% margin).** No radio means no FCC. No cell means no
UN38.3. No mains means no UL. The regulatory wall — the single biggest fixed cost in consumer hardware
— simply does not apply. And the labour that kills everyone else is *the thing you are selling*: a
hand-finished object at $149 has 71% margin precisely because a human made it and a human values it.
This is the Casetify and Etsy one-off model (3–5× commodity pricing for uniqueness), and it works at
**40 units a month**.

**Harness seats at scale ($190/hr, 96% margin).** Software scales labour away, so the ceiling is the
highest of anything here. But at 20 studios it is **$45/hr — worse than making lamps** — because the
build-and-maintain labour is fixed and the volume is not there yet. **This is a second act, not a first
one.** Starting here means twelve months of unpaid product work.

**Verified builds ($60/hr).** 80% margin, ~$1,770/month at eight builds. It is a real business and a
poor one — it converts your hours into money at a fixed rate with no leverage. Its actual value is
different: it produces the receipts, the failure taxonomy and the outcome data that make the other two
models work. **Run it as marketing with revenue attached, not as the plan.**

## The sequence, and why the order matters

| Stage | Do this | Because |
|---|---|---|
| **Now (months 0–6)** | Premium objects, no electronics, sold directly. Publish every receipt. | 71% margin, no certification, no factory, no capital. It pays for the next stage and produces the evidence. |
| **Next (months 3–12, concurrent)** | Verified builds for other people's designs, priced at $300+. | Turns the harness into credibility and starts the outcome dataset. It is the marketing engine that makes stage 3 possible. |
| **Then (months 12–24)** | Harness seats to studios, once distribution exists. | 96% margin and the only model that scales labour away. It needs credibility it does not have yet. |

Note the loop: **the objects generate the receipts → the receipts generate the audience → the audience
becomes the software customers.** Software-first inverts that and starves.

## What has to be true

- **Premium objects:** you must actually sell 40/month at $149. That is a demand problem, not an
  arithmetic one — and it is the only thing standing between you and $4k/month of gross profit.
- **Verified builds:** someone must pay $300 to find out whether their design is real. Ten
  conversations tells you. If nobody pays, the market wants entertainment, and you drop to the objects
  plus the benchmark-as-marketing.
- **Harness seats:** 50+ studios have to care. Do not attempt this before there are published receipts
  with your name on them.

## Kill criteria

- **If premium objects cannot clear 20 units/month in 90 days**, the price is wrong or the objects are.
  Cut the catalogue to the single best seller and re-price upward.
- **If the first three builds miss the harness estimate by more than ±25%**, the pricing engine is not
  sellable. Wire in live distributor and fab APIs, or drop the pricing claim and sell only the build.
- **If nobody pays for a verified build after 10 conversations**, stop buying parts. The engine becomes
  an eval/benchmark service for labs instead.

## Addendum — "people want to vibe-build their own electronics"

This is the strongest version of the original instinct, and the demand is real: 459 comments from 395
authors, 1.1K likes on the benchmark post in 37 minutes, a second builder replicating the method the
same day, Etsy sellers doing it by hand today, and Atech raising money to serve it. The desire is not
in question. Three things decide whether it is a business.

### 1. The kit loophole does not exist

The usual hope is that selling a kit dodges certification. It does not, and the FCC is explicit:

- **15.3** defines a kit as parts which, assembled, result in a device subject to the rules.
- **KDB 927445:** an individual may construct a device for personal use without authorisation —
  *"but it may not be marketed as a kit."*
- **15.23:** authorisation is not required only for devices that are **not marketed, not constructed
  from a kit, and built in quantities of five or less for personal use.**

Marketing a complete-product kit makes you a manufacturer. **Do not build a business on that
assumption.**

### 2. The legal path is subassemblies — and it is what the whole maker economy runs on

**15.101:** no authorisation is required for a peripheral device or **subassembly sold for further
fabrication** — the buyer becomes the responsible manufacturer of the finished product. That is
precisely how SparkFun and Adafruit legally sell uncertified boards at scale.

So the product is: **sell the parts of the thing, not the thing.** A verified board, a module set, the
printed parts, and a guide. The buyer assembles it and owns the finished device — which is exactly what
this audience wants to do anyway.

### 3. The arithmetic is the best in this document

| Line | Value |
|---|---|
| Lamp parts cost | $14.40 |
| Kit price at the commodity 2.75× multiple | $40 |
| Kit price at ~60% of the assembled object | $89 |
| Fulfilment cost (parts, packaging, 15 min pick-and-pack) | ~$26 |
| **Gross profit per kit** | **~$14 to ~$63** |
| **Gross profit per labour hour** | **~$56 to ~$252** |

Compare against the other models: assembled objects $183/hr, verified builds $60/hr, harness seats
$45/hr early. **Kits beat everything, because the buyer supplies the labour** — the one cost that
destroys every other low-volume hardware model. The route to the top of that range is a curated,
verified, well-guided kit rather than commodity parts in a bag.

### The rules that make it work

- **Price at ≥50% gross margin or do not ship it.** *"If your gross margin is less than 50% your price
  is too low."* Budget about **2.75× parts cost** at retail.
- **Model a first product at a 15% defect rate.** *"A 2% defective rate would be amazing, but don't be
  surprised if it's 15% when you start."* The harness's defect reserve is now configurable for this —
  pass `defectReservePct: 15` on a first run.
- **Start with no radio, no mains, no battery.** That avoids every certification path above and is the
  cleanest legal ground there is.
- **The boundary is the upsell.** A customer building one device for themselves is inside the 15.23
  exemption. The moment they want to sell what they built, they are a manufacturer who needs
  certification — which is exactly the verified-build-and-certify service already in `PLAN.md`.

### What this changes

Add a fourth line to the sequence: **verified subassembly kits**, launched alongside the premium
objects, distributed where this audience already shops (Tindie has a Kits category; Crowd Supply funds
hardware this way). The harness is what makes the difference — anyone can bag up parts; only a gated,
costed, verified parts set reliably assembles into something that works.

---

## The honest summary

There are exactly two shapes that work in hardware: **sell labour at a premium** (objects, verification)
or **eliminate labour** (software). Everything in between — cheap electronics at low volume, generic
middleware, marketplace take rates — is the dead zone, and the arithmetic above shows why.

Start with the labour, because it pays today. Keep the software as the compounding second act, because
it is the only thing that scales. And publish every receipt in between, because that is what makes the
second act possible.
