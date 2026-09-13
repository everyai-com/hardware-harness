# "We're Just the Middleware" — What It Actually Takes To Run

*Operations brief. Compiled 2026-09-12. Companion to `RESEARCH.md`. All figures sourced at the bottom.*

---

## 0. The short answer

Middleware is a **proven, working model** — and it is an **operations company wearing a software
costume**. The purest example, Xometry, owns no machines, no factories, no inventory. Here is what
"just middleware" looks like at scale:

| Xometry, FY2025 | |
|---|---|
| Revenue | $686.6M ($807.5M TTM as of Q2 2026) |
| Marketplace revenue (92% of total) | $630M, up 30% YoY |
| **Marketplace gross margin** | **34.7%** — this is the take |
| Gross profit kept | ~$219M |
| Net loss | **–$61.7M** |
| Employees | **1,174** (revenue/employee $687,847, **profit/employee –$26,244**) |
| Active buyers | 85,581 |
| Active suppliers | 4,375 |
| Founded | 2013 → IPO 2021 → **still not profitable in 2025** |

So the honest framing: **middleware keeps ~35% of GMV, and even at $807M/yr with automated pricing
it is not yet profitable.** Thirteen years in. That's not a reason not to do it — it's the actual bar.

Your specific vision adds two things Xometry deliberately avoids: **AI-generated designs** (you own
the consequences of geometry you produced) and **buyer-selected factories** (which destroys
accountability and margin — see §4).

---

## 1. Restating your model precisely, because the details decide everything

> "We're not the manufacturers. The AI designs the entire hardware. They have multiple factory
> options to choose from. They click one thing and they get it."

Translated into who takes on what:

| Question | Your answer if you ship this | Why it matters |
|---|---|---|
| Who is the **merchant of record**? | You (you set buyer price + supplier payout) | You own refunds, chargebacks, disputes |
| Who is the **importer of record**? | Likely you, on DDP shipments | You legally owe duty, classification, compliance |
| Who is liable if the part injures someone? | Likely you, increasingly by law in the EU | Product liability insurance is mandatory |
| Who eats a bad part? | You — the buyer paid you, and the factory has your money | Needs ~35% margin to absorb |
| Who owns the design IP? | Ambiguous by default — must be written down | Factories can and do reuse unclaimed work |
| Who is the "responsible person" for compliance? | You, in the EU | GPSR requires an EU-based responsible party |

**None of these are optional paperwork.** They're the reason middleware is a margin business and not
a toll booth. Budget: product liability insurance is only **$400–$1,500/yr** for standard goods and
**$3,000+/yr** for electronics/toys — cheap, but it exists because you are now the seller.

---

## 2. The click-to-doorstep pipeline — every step, who does it, what breaks

"One click" is really 11 steps, and 6 of them involve a human who is not the customer.

| # | Step | Who | Realistic time | Failure mode |
|---|---|---|---|---|
| 1 | Intent → spec | AI + user | minutes | Vague intent, unstated constraints |
| 2 | Spec → geometry | AI | minutes | Mesh, not parametric; unmanufacturable details |
| 3 | **DFM review** | Human engineer (Fictiv) or geometry engine (Xometry) | hours–2 days | Geometry passes AI but fails a real machinist |
| 4 | Quoting | Pricing model + supplier confirm | seconds (auto) – 3 days (manual RFQ) | Wrong price → you eat the delta |
| 5 | Supplier selection | **Auto-routed in the winners' model** | instant | Buyer picking = no accountability |
| 6 | Payment | You collect upfront | instant | Chargebacks, disputes |
| 7 | Purchase order to factory | You | hours | 50% deposit expected in China |
| 8 | Production | Factory | 2–7 days (3DP/CNC) / **3–10 weeks (molding)** | Schedule slip, capacity bump |
| 9 | **Pre-shipment inspection** | 3rd-party QC | 1–2 days + $**250–400/man-day** | AQL 2.5% is the standard bar |
| 10 | Logistics + customs | Freight forwarder | 2 days (air) – 6 weeks (sea) | Duty, classification, delays |
| 11 | Delivery + support | You | ongoing | Returns, "it doesn't fit my thing" |

**The unavoidable asymmetry:** steps 3, 9 and 11 are human, and they're per-order in the qty-1 model.
This is where the "effort" you're asking about actually lives — not in the AI.

---

## 3. What the software actually is (and what you can buy instead of build)

Xometry's public description of its own stack is the best spec you'll get: computational geometry
algorithms parse uploaded CAD for **DFM feedback and complexity scoring**, "inspired by the way an
expert machinist would understand a part," built via "continuous collaboration between expert
machinists and a computational geometry team." Their newer architecture spans **five dimensions:
geometry, manufacturability, pricing, supplier capability, and production outcomes**, and its
adaptive sourcing models "leverage a proprietary supplier data layer to price each job dynamically."
Their 2026 upgrades reported a **15% improvement in CNC cost-prediction accuracy**.

Four layers you must have:

1. **Spec layer** — structured, parametric, machine-checkable. (This is the moat. Chat history is not.)
2. **Geometry + DFM layer** — feature recognition, wall thickness, draft, tolerances, process fit.
   **Buy don't build:** DigiFabster (instant quoting + feature recognition + DFM for CNC/AM/sheet
   metal), PartPilot (2D drawing auto-quoting), Spatial SDKs (CAD import + geometry analysis for
   costing), and open-source starting points like `cad-quoting-engine` exist.
3. **Pricing + routing layer** — cost model per process/material/quantity, then supplier matching.
   This is where Xometry spends its ML budget, and where the margin improvement comes from.
4. **Order layer** — OMS, payments/escrow, status tracking, QC records, dispute handling, support.

**You do not have to build layer 3 on day one.** Instant-quote networks already expose this; the
fastest MVP is to orchestrate existing capacity rather than onboard factories. Owning the spec layer
is what makes you a company instead of a reseller.

---

## 4. Direct hit on one design decision: don't let buyers pick the factory

Your model says "multiple options of factories they can choose from." The two most successful
operators in this space **deliberately removed that**:

- **Fictiv:** "Orders are matched against vetted partners' demonstrated capabilities and confirmed
  by **on-site manufacturing engineers — never a bidding pool, and always one accountable partner per
  order.**" Supplier onboarding audits facilities, quality management systems, and IP practices.
- **Xometry:** adaptive sourcing models price each job and route it; buyers agree to a price, not a
  shop.
- **The counter-example:** Hubs (3D Hubs) let users browse and choose from a network of 250+
  partners. It was acquired by Protolabs in 2021 and rebranded to Protolabs Network as a B2B
  operation — the consumer-facing "pick your supplier" experience did not survive.
  Craftcloud (~180 partners) and Treatstock still run open comparison, and they compete on price.

Why choice loses: buyer-selected suppliers turn you into a **directory**, which means (a) suppliers
compete on price instead of quality, (b) you can't guarantee outcomes, so you can't charge a
premium, and (c) you lose the *capability data* that is the actual asset. Show the buyer **options
that trade off price vs speed vs finish** — but you pick the shop. If you insist on real supplier
choice, accept 3–10% take rates, which is the sourcing-agent market's range, not 35%.

---

## 5. The factory side: the cold start nobody warns you about

You have no volume, therefore no leverage. What onboarding actually takes, per supplier:

- **Vendor onboarding: 10–15 business days manually** — capability assessment, quality cert
  verification (ISO 9001), insurance docs, NDA execution, payment setup, multi-level approvals.
- **Factory audit: $350–500** (more thorough than a product inspection), and the serious players put
  engineers on site.
- **Production inspection: $250–400/man-day** — QIMA from ~$229, SGS/Bureau Veritas $300–400.
  Consumer goods are normally checked at **AQL 2.5**.
- **Payment terms:** Chinese factories typically want **50% deposit, 50% on approval** (T1/T2/T3
  sample cycles). You will be paying factories before your customer's order ships, so **you carry the
  working capital** unless you collect upfront.
- **Sourcing agents** who already do this work charge **3–10% commission**, and some quietly add
  15–30% to unit price.

Reality check on cold start: at 50 orders/day you might need 10–30 qualified suppliers to cover
capacity, quality and redundancy. **A few factories is not a network — it's a single point of
failure.** "Partners with a few factories in China" is the weakest sentence in the whole pitch,
because one factory having a bad month means every customer's order is late, and you have no
alternative to route to.

---

## 6. Per-order unit economics (the math that decides if this works)

Assume a $150 average order value and a 35% take (Xometry's marketplace margin):

| Line | Per order |
|---|---|
| Order value | $150.00 |
| **Your take @35%** | **$52.50** |
| DFM/spec review, 15–30 min @ $45/hr loaded | –$11 to –$22 |
| Support/status/dispute handling, ~10 min avg | –$7.50 |
| Payment processing + chargeback reserve (~3%) | –$4.50 |
| QC inspection, amortized over a 20-part batch | –$1 to –$2 |
| **Contribution before CAC, refunds and returns** | **~$17 to –$28** |
| Bad-part replacement (assume 3% of orders at full cost) | –$4.50 |
| CAC | ??? |

**That is the whole problem in one table.** At qty-1 with human review, gross profit per order sits
somewhere between thin and negative, and it only works when the review is automated (which is exactly
why Xometry invested in ML pricing and selection) or when AOV is much higher.

**Break-even volume.** To cover a $1M/yr burn for a 5-person team:

```
$1,000,000 / $52.50 gross profit per order = 19,048 orders/year
                                           = 1,587 orders/month
                                           = ~53 orders/day
```

Fifty-three orders a day, every day, just to pay five people — before CAC, refunds, or your own
salary. Now compare: Xometry reaches $807M with 1,174 people, i.e. **~$536K of marketplace volume
per employee.** A 10-person team can realistically operate **~$5M/yr GMV** — and not more — even with
good automation.

---

## 7. Timeline and effort, phased honestly

| Phase | Duration | Team | What exists at the end | What it can handle |
|---|---|---|---|---|
| **0. Concierge** | 2–4 weeks | You | Nothing but a form + Stripe + your DMs | 10–20 orders total |
| **1. Thin middleware** | 3–5 months | 2–3 (1 eng, 1 ops/eng, you) | Spec schema, manual quoting, order tracking, 2–5 suppliers, ToS + insurance | 50–200 orders/month |
| **2. Real platform** | 6–15 months | 5–10 | Geometry/DFM analysis (licensed or built), automated pricing, routing, QC workflow, payments, support desk, supplier scorecards | 1,000–3,000 orders/month |
| **3. Network effects** | 18–36 months | 20–50 + Shenzhen ops team | Supplier onboarding engine, ML pricing, quality/capability data flywheel, multi-process coverage | $10M–$50M GMV |
| **4. Xometry-scale** | 13+ years, IPO | 1,174 (their actual number) | $800M+ revenue, ~35% margin, still reinvesting | — |

**Phase 0 is not a warm-up, it's the research.** It gives you real lead times, real defect rates, real
"this is what it cost me," and — most importantly — it tells you whether anyone will pay before you
spend 12 months on a quoting engine. Everything downstream is decidable only with that data.

**What "effort" means concretely at Phase 2:** the work is roughly 30% software, 70% supplier ops,
quality, disputes and support. Hiring a supply chain person in Shenzhen (or an experienced China
sourcing lead) matters more than a second engineer. Engineers can't chase a factory.

---

## 8. The six things that kill middleware companies

1. **No supplier depth.** A few partners = single point of failure. (Xometry: 4,375 suppliers.)
2. **Buyer-selected factories.** Directory economics, 3–10% take, no accountability.
3. **Human-per-order in the loop.** Eats the margin; can't scale; only automation or high AOV saves
   it.
4. **Pricing risk.** You quote the buyer before the factory confirms. If you're wrong, you eat it —
   which is why the ML pricing model *is* the company.
5. **Quality escape.** One bad batch = refunds, chargebacks, and a support queue you can't clear, and
   you're the merchant of record so it's your money.
6. **Working capital.** You pay the factory on deposit, the customer pays you upfront, and refunds
   and replacements come out of your pocket before revenue settles.

Precedent: Shapeways ran "upload a file, we manufacture and ship it" for 17 years, listed via SPAC,
and filed **Chapter 7 in July 2024**. Middleware with commodity take rates and no proprietary spec
layer does not survive.

---

## 9. Verdict

**Is "we're just middleware" easier than being a manufacturer?** Yes — you avoid owning machines,
inventory and tooling, and you can start with almost no capital. Xometry proves the model at $807M.

**Is it light?** No. It's ~35% gross margin at scale, 1,174 employees, a $61.7M annual net loss 13
years in, and a per-order human cost that turns negative fast at low AOV. The software is the easy
half.

**So what should you do first?** Phase 0, starting next week:

1. Pick **one** product (the desk lamp).
2. Take **10 real orders at real prices** — you personally fulfill them through existing instant-quote
   networks (JLC3DP, SendCutSend, Protolabs Network, Xometry). No custom software.
3. Record every number: true cost, true lead time, defect rate, support minutes, what the buyer
   actually paid and whether they'd pay $50 more.
4. Only then decide whether you're building a spec engine (my belief), a marketplace, or nothing.

That's roughly **two weeks and a few hundred dollars** to replace every assumption in the pitch deck
with a fact. The alternative — building the middleware first — is 12 months and a 5-person team
before you learn whether anyone wants the thing.

---

## Sources

- [Xometry FY2025 results (Q4 + full year)](https://investors.xometry.com/news-releases/news-release-details/xometry-reports-record-fourth-quarter-and-strong-full-year-2025) · [Xometry 10-K FY2025 detail ($686.6M revenue, $61.7M net loss)](https://www.stocktitan.net/sec-filings/XMTR/10-k-xometry-inc-files-annual-report-9cf4dec9e6a8.html) · [Xometry employee count 1,174 / revenue per employee](https://stockanalysis.com/stocks/xmtr/employees/) · [Xometry revenue history / TTM $807.5M](https://stockanalysis.com/stocks/xmtr/revenue/) · [Marketplace gross margin 34.7% and merchant-of-record mechanics](https://kaeda.co/cases/xometry) · [Q3 2025 margin 35.7%, 4,375 suppliers, 78,282 buyers](https://mangrovecapitalresearch.substack.com/p/xometry-the-platform-model-for-on) · [Xometry is an aggregator, not a manufacturer](https://koalagains.com/stocks/NASDAQ/XMTR/business-and-moat)
- [Xometry Instant Quoting Engine & machine learning](https://www.xometry.com/machine-learning-for-manufacturing/) · [Xometry AI model upgrades — geometry, manufacturability, pricing, supplier capability, production outcomes](https://investors.xometry.com/news-releases/news-release-details/xometry-releases-comprehensive-upgrades-its-ai-model) · [Xometry AI upgrades: 15% CNC cost-prediction accuracy](https://marketchameleon.com/articles/b/2026/7/20/xometry-ai-upgrades-boost-cnc-prediction-and-buyer-acceptance)
- [Fictiv — how it works: capability matching, on-site engineers, never a bidding pool](https://www.fictiv.com/why-choose-fictiv/how-it-works) · [Fictiv network vetting: facility audit, QMS, IP management](https://www.fictiv.com/why-choose-fictiv/our-network) · [Fictiv quality services](https://www.designworldonline.com/quality-services-enhance-fictiv-digital-manufacturing-platform/) · [Fictiv ~250 manufacturing partners](https://www.fabbaloo.com/news/fictiv-introduces-quality-services)
- [Protolabs Network (formerly 3D Hubs)](https://en.wikipedia.org/wiki/Protolabs_Network) · [Protolabs rebrands Hubs → Protolabs Network, 250+ suppliers](https://www.tctmagazine.com/protolabs-rebrands-hubs-as-protolabs-network/) · [3D Hubs acquisition background](https://stories.eqtventures.com/articles/on-3d-hubs-exit-to-protolabs-the-largest-transaction-ever-in-digital-manufacturing)
- [Craftcloud — quotes from 180+ manufacturing partners](https://craftcloud3d.com/en/upload) · [Treatstock — no minimum order](https://www.treatstock.com/)
- [Third-party inspection $120–400/man-day (QIMA $229, SGS/BV $300–400, audits $350–500, AQL 2.5%)](https://topchinasourcing.com/third-party-inspection-companies-china-2026-qima-vs-sgs/) · [QC inspection cost guide 2026](https://metricrig.com/answers/quality-control-inspection-cost-china-2026/) · [Inspection services guide](https://china-electronics.com/guides/inspection-services/)
- [Supplier onboarding: 10–15 business days manually (capability, certs, insurance, NDA, payment setup)](https://ifactoryapp.com/vendor-management/vendor-onboarding-qualification-automation-manufacturing) · [Factory audit pricing](https://www.qcadvisor.com/blog/factory-audit-cost/) · [Factory/supplier audit services](https://proqc.com/services/factory-supplier-audits/)
- [China sourcing agent commissions 3–10%](https://repasourcing.com/sourcing-agent-china-cost-full-breakdown-2026-guide/) · [Sourcing agent fees 2026 + hidden markups of 15–30%](https://primescalefulfillment.com/blog/china-sourcing-agent-fees-2026) · [China tooling payment terms: 50% deposit, 50% after T1 approval](https://woosourcing.com/china-injection-mold-tooling-cost/)
- [Marketplace merchant-of-record liability](https://dddinvoices.com/learn/platform-invoice-liability-seller-buyer) · [Who pays customs duties — importer of record in marketplace sales](https://www.crossbordervat.com/marketplace-liability-in-2026-who-pays-customs-duties/) · [Product liability of online marketplace operators (Taylor Wessing)](https://www.taylorwessing.com/en/insights-and-events/insights/2024/03/product-liability-of-online-marketplace-operators) · [Merchant of record vs distributor vs marketplace agency (EU)](https://o1.eu/news-insights/merchant-of-record-vs-distributor-vs-marketplace-agency-eu-expansion-2026) · [Product liability insurance cost $400–1,500/yr, $3,000+ for electronics](https://businessinsureguide.com/product-liability-insurance-cost/)
- Buy-vs-build quoting: [DigiFabster instant quoting + feature recognition + DFM](https://digifabster.com/products/instant-quoting-solution/) · [Spatial SDKs for costing/quoting](https://www.spatial.com/industries/costing) · [PartPilot auto-quoting](https://www.part-pilot.com/) · [open-source cad-quoting-engine](https://github.com/OnkarPKher/cad-quoting-engine)
- [Shapeways Chapter 7 (July 2024)](https://3dprinting.com/news/shapeways-files-for-bankruptcy/)
