# BUSINESS — What Is Viable

*Decision doc. 13 Sep 2026. Numbers produced by `harness/` (`node src/index.ts --business` and
`--fulfilment`), traceable to the fixtures. Reads with `PLAN.md`.*

---

## The yardstick

Hardware has one metric software does not: **gross profit per hour of your own labour.**

Software scales labour to zero. Hardware does not — every physical unit needs hands, and hands do not
get cheaper with volume. So any hardware model that hides labour inside "COGS" is telling you a story.
This doc prices the labour explicitly, and that single number separates the businesses from the hobbies.

The figure is quoted after fixed monthly costs, on the same base as the monthly profit beside it: a
model that makes $1,900 of gross profit and spends $500 staying alive earns $1,400, and it earns that
per hour of the labour it consumed.

## The models, run against real specs

| Model | Price | Unit cost | Gross margin | Gross profit / month | Your labour | **Per labour hour** | Verdict |
|---|---|---|---|---|---|---|---|
| Sell low-volume consumer electronics | $79 | $187.05 | **−137%** | −$5,603 | 218 hrs | **−$25.66** | **UNVIABLE** |
| The same product rebuilt around one assembled board | $79 | $50.01 | **36.7%** | $1,250 | 33 hrs | **$38.45** | Marginal |
| Sell premium objects, no electronics | $149 | $43.04 | **71.1%** | $4,088 | 23 hrs | **$175.47** | **VIABLE** |
| Verified builds for other people's designs | $300 | $60 | 80% | $1,770 | 32 hrs | **$55.31** | Viable, but it's a job |
| Harness seats — early (20 studios) | $99 | $4 | 96% | $1,400 | 42 hrs | $33.33 | Marginal, at this volume |
| Harness seats — at scale (100 studios) | $99 | $4 | 96% | $8,600 | 50 hrs | **$172** | **VIABLE** |

Sources: unit costs come from `landedCost()` on the Astra lamp, the Blueprint voice note-taker, and the
board-based rebuild. Labour minutes come from `estimateAssemblyMinutes()`. Nothing here is a guess
dressed as a number.

Two rows are worth reading together, because they are the same product. The generated voice note-taker
costs **$187.05** a unit at qty 100 and **loses $25.66 per labour hour**. Rebuilt around one assembled
board — identical function, one PCBA instead of 18 hand-soldered wires — it costs **$50.01** and earns
**$38.45**. The parts did not change much. The labour did. That is the whole argument of this document
in two rows.

## The dead zone, named

**Low-volume consumer electronics are arithmetically dead, and no amount of good design fixes it.**

The generated voice note-taker is the proof: parts cost **$38**, assembly takes **262 minutes** and
costs **$153**, certification for a Bluetooth product with a lithium cell is published at
**$10,500–$16,000**, and the target retail is **$79**. Even rebuilt correctly it lands at **$50** at
qty 1,000 — a 36.7% margin, which clears 40% only at about **$85 retail**, and that is with the
certification budgeted rather than ignored.

Three costs stack against you simultaneously at low volume, and each one is structural:

1. **Per-unit labour.** 4.4 hours of hand-wiring cannot be amortised. It is the same at unit 1 and
   unit 10,000.
2. **Certification amortisation.** $10,500 of FCC and UN38.3 is $105/unit at 100 units and $10.50 at
   1,000 (the published band is $10,500–$16,000, and the harness books the midpoint).
3. **Duty after de minimis.** 20–30% on every parcel, with no duty-free lane left.

Any two of these can be survived. All three at once, at a $79 price point, cannot.

## Why the winners win

**Premium objects with no electronics ($175/hr, 71% margin).** No radio means no FCC. No cell means no
UN38.3. No mains means no UL. The regulatory wall — the single biggest fixed cost in consumer hardware
— simply does not apply. And the labour that kills everyone else is *the thing you are selling*: a
hand-finished object at $149 has 71% margin precisely because a human made it and a human values it.
This is the Casetify and Etsy one-off model (3–5× commodity pricing for uniqueness), and it works at
**40 units a month**.

**Harness seats at scale ($172/hr, 96% margin).** Software scales labour away, so the ceiling is the
highest of anything here. But at 20 studios it is **$33/hr — worse than making lamps** — because the
build-and-maintain labour is fixed and the volume is not there yet. **This is a second act, not a first
one.** Starting here means twelve months of unpaid product work.

**Verified builds ($55/hr).** 80% margin, ~$1,770/month at eight builds. It is a real business and a
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

### 3. The arithmetic — corrected against the engine

An earlier version of this section priced a kit at "parts + packaging + 15 minutes of pick-and-pack",
about $26, and concluded kits **beat every other model** at $56–$252 per labour hour. Running the same
scenario through `compareFulfilment()` says otherwise, and the engine is right: a one-off kit order
does not pay for parts and hands. It pays for **three inbound parcels** (one per supplier, each with its
own minimum), the duty on them, 15 minutes of pack time *and* 25 minutes of coordination — the same
per-order labour that `OPERATIONS.md` identifies as the thing that kills small-batch hardware.

| Line | One at a time | Batched ×20 |
|---|---|---|
| Parts | $14.40 | $14.40 |
| Inbound freight (3 suppliers) | $36.00 | $1.80 |
| Duty at 25% | $12.60 | $4.05 |
| Assembly (15 min, with the learning curve) | $8.75 | $5.90 |
| Coordination (25 min/order) | $14.58 | $14.58 |
| Packaging + outbound shipping | $10.90 | $10.90 |
| **Total cost** | **$97.23** | **$51.64** |
| Gross at $89 | −$8.23 | **+$37.36** (42%) |
| Gross profit per labour hour | **−$12.35** | **+$63.83** |
| Price for a 50% margin | $194.47 | **$103.27** |

Three conclusions, and they are not the ones the earlier draft drew:

- **The commodity multiple is wrong for kits.** At 2.75× parts cost ($40) the kit loses money in every
  scenario. The 2.75× rule is about *parts*; it ignores inbound freight, duty and coordination, which
  together exceed the parts cost at qty 1.
- **Batching is not an optimisation, it is the business.** The same kit at the same price is
  −$12.35/hr one at a time and **+$63.83/hr** twenty at a time. Nothing about the product changed.
- **Kits do not beat everything.** Batched, they return **$63.83/hr** — above verified builds ($55/hr),
  below premium objects ($175/hr). They are a real third line, not the top of the table.

The route to the top of that range is still a curated, verified, well-guided kit rather than commodity
parts in a bag — and the target price is **~$103 for a 50% margin** when batched, not $40.

### The rules that make it work

- **Price at ≥50% gross margin or do not ship it.** *"If your gross margin is less than 50% your price
  is too low."* Quote from landed cost, not from parts cost.
- **Model a first product at a 15% defect rate.** *"A 2% defective rate would be amazing, but don't be
  surprised if it's 15% when you start."* The harness's defect reserve is configurable for this —
  pass `defectReservePct: 15` on a first run.
- **Batch the production session.** It is the single largest lever in the model: it amortises inbound
  freight across orders and captures the assembly learning curve.
- **Start with no radio, no mains, no battery.** That avoids every certification path above and is the
  cleanest legal ground there is.
- **The boundary is the upsell.** A customer building one device for themselves is inside the 15.23
  exemption. The moment they want to sell what they built, they are a manufacturer who needs
  certification — which is exactly the verified-build-and-certify service already in `PLAN.md`.

### What this changes

Add a fourth line to the sequence: **verified subassembly kits**, launched alongside the premium
objects, distributed where this audience already shops (Tindie has a Kits category; Crowd Supply funds
hardware this way). The harness is what makes the difference — anyone can bag up parts; only a gated,
costed, verified parts set reliably assembles into something that works. But launch it batched and
priced from landed cost, or the arithmetic will do to it what it does to every other low-volume
consumer product.

---

## The honest summary

There are exactly two shapes that work in hardware: **sell labour at a premium** (objects, verification)
or **eliminate labour** (software). Everything in between — cheap electronics at low volume, generic
middleware, marketplace take rates — is the dead zone, and the arithmetic above shows why.

Start with the labour, because it pays today. Keep the software as the compounding second act, because
it is the only thing that scales. And publish every receipt in between, because that is what makes the
second act possible.
