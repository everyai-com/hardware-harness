# "Lovable for Hardware" — Market Research Brief

*Compiled 2026-09-12. All figures sourced at the bottom.*

---

## 1. Verdict up front

The pitch as stated — **talk to it, it designs it properly, you order it, parts arrive in days** — is
three businesses fused together, and only two of them are winnable:

| Layer | Status | Verdict |
|---|---|---|
| Chat → photoreal render → spec sheet | **Commoditized** | RapidDirect ships this today, free, backed by a real factory |
| Sourcing + RFQ + supplier negotiation | **Owned by Alibaba** | Accio Work: 24/7 multi-round negotiation, 10M+ MAU |
| **Machine-checkable spec + true landed cost + DFM enforcement** | **Nobody owns this** | The only defensible wedge |

The chat is the demo. The spec engine is the company.

---

## 2. Direct competitors — already shipping, some free

**Schematik** (the one with a user base — added after the first pass; see `PROCESS.md` §3)
- "Cursor for Hardware": an AI hardware IDE for Arduino, ESP32 and Raspberry Pi Pico. Prompt → firmware
  source + colour-coded wiring diagram + BOM table + pin assignments + numbered assembly steps, plus a
  per-project net table. One-click flash via PlatformIO, or export everything.
- **$4.6M pre-seed led by Lightspeed** (Apr 2026), with Puzzle Ventures and angels from Hugging Face,
  Google DeepMind and Monumental. Founder Samuel Beek previously scaled VEED past $50M ARR.
- **100k+ users**, 10M+ Instagram reach, WIRED: *"They Built the 'Cursor for Hardware.' Now, Anthropic
  Wants In."*
- **6,021 parts in 68 groups** with availability, pinout, voltage, protocol, ecosystem fit and
  cross-part warnings. Public build guides, hearts, one-click remix, and **Build Season 2026** with
  M5Stack — publish a working build with photo/video and win hardware.
- **Why it matters:** it is the strongest possible confirmation that generation is a commodity — and
  the strongest possible evidence that the *receipt* is not being sold. Its BOM tables carry quantities
  and no prices. A part page lists one retailer offer (HC-SR04 → Kiwi Electronics €6.28) with no duty,
  no MOQ, no quantity breaks and no total. Its catalogue sells LiPo packs, mains supplies and 5G modems
  with no compliance analysis. Its contest asks for a photo of the device working — not for what it
  cost, how long it took, or what arrived wrong.
- **Its boundary is the boundary of this repo's wedge:** Arduino/ESP32/Pico modules only, no
  manufacturability, no certification, no landed cost, no measured build.

**RapidDirect AI Creator** (Shenzhen-based manufacturer, the most dangerous one)
- Text → 4 photoreal renders → AI-PRD generator → 3D model generator → **DFM analysis** (wall
  thickness, draft angles, interferences) → process/material match (CNC vs 3D print vs molding, with
  cost + lead time) → one click to an NPI engineer within 2h → prototype → pilot run → mass
  production → packaging.
- Free credits during beta (20–200 credits by tier).
- **Why it matters:** this is the exact pitch, built by an actual factory, given away as lead-gen.
  The app isn't their business — the factory is. You cannot out-funnel that.

**Others in the frame**
- **Genpire** — Tel Aviv, founded 2024, seed, 1–10 people. "AI-native OS for consumer goods":
  prompt/sketch → auto tech-pack → specs → **manufacturer coordination** → production workflow.
  Launched in the US Aug 2026 (fashion/accessories/home goods). Closest true competitor, and small.
- **Nirmana AI** — "AI-native infrastructure layer orchestrating the entire physical product creation
  lifecycle."
- **MORPHIC** — markets itself as "the world's first text-to-hardware platform."
- **Leo AI** — $9.7M seed (a16z-backed), DFMA-optimized full-assembly CAD. Customers: Scania,
  Siemens, HP, Mobileye. B2B engineering, not consumer.
- **Zoo (ex-KittyCAD)** — Text-to-CAD API + MCP. Pricing page advertises *unlimited* text-to-CAD
  usage — a signal that generation itself is not where the money is.
- **Backflip AI** — 3D scans → CAD + SolidWorks plugin.
- **Cadly.ai** — 3D-printing hustle turned product-launch platform.

**Reality check on generation quality:** independent 2026 tool reviews report text-to-CAD "mostly
produces mesh geometry, not production-ready parametric CAD," and that SolidWorks AURA shipped as a
documentation chatbot, not the generative design engine the demos implied. Renders are easy.
Manufacturable geometry is hard.

---

## 3. What *is* validated (the good news)

- **Xometry**: $0.74B TTM revenue. Q1'26 $205M (+36% YoY), Q2'26 $229.3M (+41%). Marketplace active
  buyers 85,581 (+20% YoY). Adjusted EBITDA positive. **Siemens put in $50M.** Someone pays real money
  for "upload file, get parts in days."
- **Protolabs**: record quarterly revenue, guidance raised.
- **Fictiv**: $192M raised, ~$68M revenue, 12M+ parts made (and reportedly acquired).
- **Parts in days is real — for additive and CNC**: JLC3DP from $0.30/part, production from 2 days.
  Low-volume CNC does 10–1,000 parts with **no tooling**, ~14 days.
- **China tooling is genuinely 40–70% cheaper**: $1,500–$6,000 (small/simple) vs $18,000–$45,000 for
  a medium Western tool, at 3–5 weeks vs 8–12 weeks build.
- **Sourcing agents are a $12.8B market in 2026**, growing 9.2% CAGR.
- **Custom/personalized physical goods**: POD market $15.2B in 2026 → $46.4B by 2031 (Mordor);
  AI-generated custom physical goods TAM conservatively $15–25B by 2030. **Casetify** went from
  Instagram-photo phone cases to **$300M+/yr, 15M+ cases**, made to order in Shenzhen. That's the
  proof that consumers pay a premium for one-off customization when the base product is pre-tooled.

---

## 4. The four constraints that kill the naive version

### 4.1 Tooling math makes one-off orders impossible (except via 3DP/CNC)

| Part profile | Cavities | Tool cost (China) | Build time |
|---|---|---|---|
| Soft/prototype tool (aluminum/P20) | 1 | $800–$3,000 | 10–18 days |
| Small simple part (<100mm) | 1 | $1,500–$4,000 | 18–25 days |
| Small part w/ sliders or lifters | 1–2 | $3,500–$8,000 | 25–35 days |
| Medium part (100–300mm) | 1 | $6,000–$18,000 | 30–40 days |
| Medium, multi-cavity production | 4–8 | $15,000–$40,000 | 35–50 days |
| Large part / housing set | 1 | $18,000–$60,000 | 45–70 days |

Steel choice sets shot life: aluminum 5k–30k shots, P20 100k–300k, H13/S136 500k–1M+.
Multi-cavity tooling costs 2.5–3× a single cavity and pays back in <12 months only above
**30,000–50,000 units/year**.

**Consequence:** a $5,200 Dongguan tool amortized over a 250-unit run adds **$20.80/unit**. Over
1,000 units it's $5.20. Injection molding is a volume game. Anything "ordered in days" is 3D printed
or machined, at 5–50× the unit cost of the injection-molded version sitting on Amazon.

### 4.2 Certification is a hard gate per category — and your example list is mis-ordered

| Your example | Regulatory burden (US) | Verdict |
|---|---|---|
| Custom decor, brackets, organizers, mounts | **None** | Build here first |
| Phone mounts (passive) | None | Easy |
| Desk lamp (mains) | UL/ETL required | Medium |
| Desk lamp (USB/battery) | UL + FCC + UN38.3 + EU Battery Reg 2023/1542 | Hard |
| Bluetooth gadget | FCC $9k–$12k alone | Hardest |

FCC costs (2025/26 lab pricing): unintentional radiators **$3,000–$5,000**; devices using
pre-certified modules **$6,500–$10,000**; Bluetooth/WiFi/LTE **$9,000–$12,000**; licensed/non-precert
**$12,000–$15,000**. Add CE (LVD+EMC+RED+RoHS), UL, and UN38.3 for anything with a lithium cell. The
EU's Battery Regulation adds carbon-footprint declarations and **digital battery passports by 2027**.

You cannot put a $9–12k FCC bill into a $40 custom gadget that ships one unit at a time.

### 4.3 The de minimis exemption is dead — "ships in days from China" is now taxed

- $800 duty-free exemption **ended May 2, 2025** for China/Hong Kong (EO 14256); **globally suspended
  Aug 29, 2025**; ends by law in 2027.
- Per-parcel duty costs jumped **35–50%** for postal shipments; formal entry / EIN / HTS
  classification / broker fees now apply.
- Section 301 rates on Chinese goods run 7.5–25%, totaling **~20–30% for most consumer categories**
  after Nov 2025 truce adjustments.

This is a structural tax on every one-off cross-border shipment, and it lands hardest on the
low-value parcels the consumer version of this idea depends on.

### 4.4 Hardware cash-flow reality

- Hardware startup margins are 20–40%, and the failure mode is consistently **underestimating
  prototyping, tooling, QC, freight and certification**.
- **Pebble** died on a $15M inventory overhang. **Juicero, Jawbone**. **Quirky** burned ~$185M on
  crowdsourced invention.
- **Shapeways** — the literal pioneer of "consumer uploads a file, we manufacture and ship it" —
  filed **Chapter 7 on July 2, 2024** despite a SPAC listing. Public failure datasets document
  **61–77 failed consumer hardware startups destroying $21B–$45.3B** in capital.
- Tooling iterations are not optional: T1 → T2 → sometimes T3. A "30-day tool" realistically reaches
  approved status in **45–55 days**. Any promise of "days to production" ignores this.

---

## 5. Who actually holds the supply side

**Alibaba's Accio Work** (this is the real competitor, and it's a platform, not a startup):
- **Accio Sourcing Toolkit** (July 2026): finds suppliers, generates RFQs, contacts multiple
  suppliers at once, compares offers, negotiates across time zones **24/7**, follows up on unanswered
  requests, negotiates price, **sample cost, production lead times, MOQs and shipping terms**, and
  uses one supplier's terms as leverage with others. Retains context across conversations; if specs
  change, it updates all open threads.
- Built on market data for **100M+ products** and 20+ years of trade expertise.
- **10M+ monthly active users**; 230,000+ businesses deployed agent teams by April 2026.
- Crucially: the agent **cannot close deals**. Users approve pricing, terms and POs; payments need
  explicit confirmation. "The founder still makes the decision."
- **Made-in-China.com** launched **SourcingAI** for supplier matching/vetting (April 2026).

So the sourcing half of your pitch is already a free feature of the two largest B2B marketplaces on
earth. Don't build an RFQ bot. Build the thing that makes the RFQ *correct*: a spec so precise that
quotes come back comparable and the first article passes inspection.

---

## 6. Where the wedge actually is

Ranked by winnability:

### Option A — Spec + DFM + landed-cost engine for small-batch makers (RECOMMENDED)
**Who pays:** indie brands, Etsy/Amazon sellers, product designers, small D2C brands doing
**10–500 unit runs**. They currently pay a human sourcing agent or a Chinese trading company, and
they get burned by unclear specs.
**What you sell:** a conversation that produces a *machine-checkable spec* (parametric geometry,
material, process, tolerances, finish), a DFM report that blocks unbuildable choices before money
moves, and a **true landed cost** (unit + tooling amortization + duty + freight + QC + certs) with
3 competing quotes.
**Why it wins:** no certification gate, no consumer app store dynamics, buyer has budget and a
deadline, and the output (a buildable spec) is something Accio cannot produce — Alibaba has supplier
lists, not manufacturability logic.
**Revenue:** 5–15% take rate on orders, or $99–499/mo for the tooling, or a hybrid.

### Option B — Personalization on pre-tooled base products (the Casetify/POD model)
Factory tools the base once (already certified, already amortized); the AI customizes only the
cosmetic/parametric layer. This is how you get legitimately orderable **quantity 1** with no new
tooling and no new certification. Casetify's $300M proves consumers pay 3–5× commodity pricing for
this. Desk lamps, mounts and decor all fit as *families* (choose body + shade + arm geometry) rather
than arbitrary one-offs.

### Option C — Consumer "make me anything, ship it in days" (AVOID in v1)
Dies on tooling amortization (§4.1), per-parcel duty (§4.3) and certification (§4.2) simultaneously.
Only survives in 3DP/CNC at premium prices — a niche, not a platform.

---

## 7. Recommended MVP (what to actually build first)

Pick **one category with zero certification burden**: desk accessories / mounts / non-electrical
decor. Then build the three things nobody has:

1. **A typed spec schema** — parametric geometry parameters + material + process + tolerance + finish
   + interface constraints. Machine-checkable, versioned, diffable. Not a PDF, not a chat log.
2. **A DFM rule engine** — real constraints, not vibes: min wall thickness by material, draft angle
   per process, fillet/undercut rules, tolerance stack feasibility, screw-boss and snap-fit rules,
   plus a process recommender (3DP vs CNC vs soft tool vs hard tool) with the crossover volume.
3. **A landed-cost engine** — unit cost at 1 / 10 / 100 / 1,000 / 10,000 units including tooling
   amortization, steel grade vs shot life, **2026 duty and tariff treatment**, freight, QC and
   packaging. This is the number that makes the product feel like magic, because today nobody knows
   it until they've already paid a deposit.

Fulfillment for v1: **do not sign factories.** You have no volume, so you have no leverage. Route
orders through the existing instant-quote networks (JLC3DP, Protolabs, Xometry, Fictiv) whose
capacity is already live. Owning the spec layer is the moat; the factory relationship is a
commodity you can rent until you have volume to negotiate with.

**Explicitly out of scope for v1:** mains-powered anything, lithium batteries, Bluetooth.

---

## 8. The two moats worth building

1. **The spec format.** If every order in the system is a structured parametric spec rather than a
   STEP file plus an email thread, you can quote instantly, compare suppliers apples-to-apples, and
   auto-validate incoming parts against the golden sample. Whoever defines this format defines the
   category — the same way a design-token or CI config format creates lock-in.
2. **Per-factory capability + true-cost data, updated from real order outcomes.** Not supplier
   directories (Alibaba has 100M products). Actual manufacturability: which shop holds which
   tolerance, real scrap rates, real cycle times, who ships on time. That compounds and is
   uncopyable without doing the orders.

---

## 9. Open questions to answer with money, not slides

1. Will a maker doing a 250-unit run pay a 10% take rate, or do they clip coupons with a sourcing
   agent at 5%?
2. What's the real conversion from "AI spec" to "order placed"? If it's <5%, this is a lead-gen
   business and you're competing with RapidDirect's free funnel.
3. Can the DFM engine actually catch what an NPI engineer catches? Test it against 50 real failed
   first articles — if it can't predict those, it's a render generator with extra steps.
4. Is "made in China in days" still the right supply base post-de-minimis, or does the wedge want
   onshore/nearshore (as Gantri chose, manufacturing in San Leandro) for speed and tariff reasons?

---

## 10. Addendum — the quantity-1 model: compose, don't manufacture

**Raised:** most people want 1–2 units, not hundreds. Correct, and it changes the architecture rather
than the viability. At qty 1 you cannot amortize tooling, so the product can never be "custom
manufactured." It has to be **composed**.

**The reframe:** the AI's job stops being "write a factory-ready spec" and becomes four things:

1. **Select from pre-tooled, pre-certified modules.** An existing Etsy seller's listing says it
   plainly: *"The enclosed LED light unit is manufactured by a third-party supplier. The outer
   structure, diffuser, colour combination and final assembly are produced by [the seller]."* That
   is the qty-1 supply chain, already running — the LED engine is bought, only the shell is made.
2. **Generate only what qty-1 processes can make.** FDM from $5, resin from $20, SLS from $100,
   metal from $500+. CNC and sheet metal need no tooling at all: SendCutSend has **no minimum**
   (1–500 parts), PCBWay's minimum is as low as **5 pieces**.
3. **Guarantee assembly.** Clearances, thread engagement, fastener selection, wire routing, thermal
   path. This is the engineering nobody actually does at qty 1 today, and it's where the AI earns
   its keep — an unassemblable design is an expensive apology email.
4. **Assemble and ship from a local micro-factory.** Per-unit labor has zero economies of scale, so
   distance is the enemy: a one-off parcel pays full freight plus the new per-parcel duty (§4.3).
   Gantri manufactures in San Leandro, FabPub in London, the Etsy makers print locally.
   **"Made in your city in days" beats "shipped from China in days"** — and dodges tariffs entirely.

**Who is already here (all manual, none AI-driven):** [Leora](https://e-leora.com/) (browser-based
parametric lamp builder → export 3D-printable files), [minsurf](https://www.minsurf.com/) (on-demand
3D-printed art lighting, MOQ 10, 18-day delivery), [FabPub](https://fabpub.com/),
[Beelight](https://beelightlamp.com/), and dozens of Etsy "made to order" 3D-printed lamp sellers.
The customizer step is partly solved; the **validated, priced, orderable, assembled** step is not.

**The economics that must hold before you build anything**

| Path | Unit cost at qty 1 | Sells for | Who does this today |
|---|---|---|---|
| FDM print + certified LED module | $15–40 | $80–200 | Etsy sellers |
| SLS/MJF print, finished, assembled | $100–300 | $250–600 | Design studios |
| CNC aluminum + standard hardware | $150–500 | $400–1,500 | Bespoke fabricators |

The one-off buyer is not comparing you to a $25 Amazon lamp. They're comparing you to a $300 designer
piece or a $150 Etsy commission — the same 3–5× premium logic that got Casetify to $300M. **Qty 1
works at premium prices, with printed-part aesthetics, and only where there is no certification
gate.**

**Certification shortcut specific to qty 1:** keep mains power *outside* the product. A USB-C lamp
running off a pre-certified UL/CE-listed external adapter avoids a mains safety listing on the object
itself, and a UL test report from an ISO 17025 lab is generally what marketplaces ask for. Never put
a lithium cell in a one-off — UN38.3 attaches to the cell and shipping becomes the problem.

**What this makes the company:** not an agent that talks to factories, but a **design engine plus a
micro-factory network** — closer to Canva/Casetify for physical objects than to Xometry. Two
architectures, and the real product probably needs both:

- **(a) Parametric families on a pre-tooled base** — the factory owns the tooling, variations are
  cosmetic and parametric. Cheap, fast, reliable, near-zero cert risk. Limited expressiveness
  ("customize within this family").
- **(b) Generative one-offs** — print the hero geometry, buy every interface part. Infinite
  expressiveness, higher cost and variance, slower.

The DFM engine's most valuable function is deciding, per part, which of the two applies — and
refusing to let a customer order something that cannot be assembled or that will arrive broken.

**Blocking risk:** per-unit labor. At qty 1 there are no scale economies in assembly, QC, packing or
support. This is precisely why Shapeways died as a commodity printer while Etsy sellers survive —
the sellers charge premium prices and do the labor themselves. Your gross margin lives or dies on how
much assembly you can design *out* of the product.

---

## Sources

- [RapidDirect AI Creator](https://www.rapiddirect.com/ai-creator/) · [RapidDirect AI tool review](https://www.rapiddirect.com/blog/best-ai-cad-tools-review/)
- [Genpire](https://www.genpire.com/) · [Genpire PitchBook](https://pitchbook.com/profiles/company/1462835-71) · [Genpire US launch](https://www.einnews.com/pr_news/903133676/genpire-launches-ai-powered-design-and-manufacturing-platform-in-the-united-states-for-consumer-goods-brands)
- [Nirmana AI](https://www.nirmanaai.com/) · [MORPHIC](https://morphicsolution.com/) · [Cadly AI](https://cadly.ai/blog/2025/11/19/why-do-hardware-startups-fail/)
- [Leo AI $9.7M raise](https://www.getleo.ai/blog/leo-ai-raises-9-7m-to-build-the-world-s-first-ai-for-mechanical-engineering) · [Leo AI on TechStartups](https://techstartups.com/2025/09/02/leo-ai-raises-9-7m-backed-by-google-vp-and-a16z-to-transform-mechanical-engineering-with-worlds-first-large-mechanical-model/)
- [Text-to-CAD 2026 review — mesh, not parametric](https://www.getleo.ai/blog/text-to-cad-tools-2026-review) · [Best text-to-CAD tools 2026](https://www.getleo.ai/blog/best-text-to-cad-tools-2026) · [Zoo pricing](https://zoo.dev/zoo-pricing) · [Backflip AI](https://www.tctmagazine.com/backflip-3d-scans-3d-printable-cad-in-a-minute/)
- [Xometry Q1 2026 results](https://investors.xometry.com/news-releases/news-release-details/xometry-reports-record-first-quarter-2026-results) · [Xometry Q2 2026 + Siemens $50M](https://www.voxelmatters.com/xometry-posts-record-q1-2026-revenue-of-205-million-strikes-50-million-siemens-partnership/) · [Xometry revenue history](https://companiesmarketcap.com/xometry/revenue/) · [Xometry/Protolabs financials](https://3dprint.com/330078/3d-printing-financials-xometry-protolabs-and-lincoln-electric-post-strong-quarters/)
- [Fictiv funding/revenue](https://tracxn.com/d/companies/fictiv/__oAcqH5NmNODLHWlBF1k8lmHRKBMPjF9ke-hPL0-QghQ) · [On-demand manufacturing platforms 2026](https://leansupplai.com/en/blog/on-demand-manufacturing-platforms)
- [JLC3DP instant quote](https://jlc3dp.com/3d-printing-quote) · [JLCPCB 3D printing](https://jlcpcb.com/de/3d-printing/) · [Low-volume CNC 10–1000 parts](https://www.xavier-parts.com/low-volume-cnc-machining-complete-guide/)
- [China injection mold tooling costs 2026](https://woosourcing.com/china-injection-mold-tooling-cost/) · [Haizol tooling cost data](https://www.haizol.com/blog/injection-molding-tooling-cost-china) · [Trade Entrust tooling guide](https://tradeentrust.com/injection-mould-tooling-cost-china) · [MOQ negotiation 2026](https://woosourcing.com/wholesale-buying-china-moq-negotiation/) · [Low-MOQ private label](https://woosourcing.com/low-moq-private-label-china/)
- [Alibaba Accio Sourcing Toolkit](https://www.digitalcommerce360.com/2026/07/24/alibaba-accio-work-agentic-ai-b2b-sourcing/) · [Accio agent launch](https://www.prnewswire.com/news-releases/alibaba-international-releases-the-worlds-first-ai-agent-for-global-trade-302530000.html) · [Made-in-China SourcingAI](https://briefglance.com/articles/ai-enters-the-supply-chain-sourcingai-redefines-china-trade) · [AI reshaping China sourcing](https://www.newbuyingagent.com/resources/how-ai-is-reshaping-china-sourcing-in-2026-from-rfq-automation-to-smart-qc)
- [De minimis ended — China guide](https://tariffschart.com/blog/de-minimis-ended-2026-importer-guide) · [De minimis 2026 status](https://www.newbuyingagent.com/resources/de-minimis-rule-changes-2026-what-the-end-of-the-800-threshold-means-for-your-china-imports) · [FBA tariffs guide](https://www.unicargo.com/de-minimis-ended-2026-tariffs-guide-amazon-fba/) · [EO 14256 detail](https://www.exfreight.com/de-minimis-rule-china-800-threshold-eliminated/)
- [FCC certification costs](https://compliancetesting.com/fcc-certification-faqs/fcc-certification-cost/) · [CE vs UL vs FCC 2026](https://ecocomply.ai/blog/ce-mark-vs-ul-vs-fcc-certifications) · [Battery certification costs/timelines](https://www.ufinebattery.com/blog/essential-guide-to-battery-certification-types-costs-timeframes-and-standards/) · [EU Battery Regulation 2023/1542](https://www.polinovelpowbat.com/info/industrial-battery-certification-guide-ul-ce-103451114.html)
- [Shapeways Chapter 7](https://3dprinting.com/news/shapeways-files-for-bankruptcy/) · [Shapeways post-mortem](https://cadmore.com/blog/what-happened-to-shapeways) · [Hardware startup failure analysis](https://www.cbinsights.com/research/report/hardware-startups-failure-success/) · [Pebble inventory case study](https://startups.in/research/pebble-smart-watch-case-study) · [61 consumer hardware failures / $21B](https://ideaproof.io/failures/consumer-electronics) · [77 consumer electronics failures / $45.3B](https://www.loot-drop.io/deep-dive/consumer-electronics)
- [Leora — one-of-a-kind lamps, made by you](https://e-leora.com/) · [minsurf on-demand 3D printed lighting](https://www.minsurf.com/) · [FabPub London](https://fabpub.com/products/pupa-mandala-clear-lamp) · [Beelight](https://beelightlamp.com/) · [Etsy custom 3D printed lamps](https://www.etsy.com/market/custom_3d_printed_lamps) · [Etsy made-to-order lamp listing (LED module bought from third party)](https://www.etsy.com/uk/listing/4572574500/3d-printed-chevron-table-lamp-custom)
- [SendCutSend — no minimum order, 1–500 parts](https://sendcutsend.com/commercial/) · [PCBWay — MOQ as low as 5](https://m.pcbway.com/assembly-capabilities.html) · [3D printing cost guide 2026 (FDM $5, resin $20, SLS $100, metal $500+)](https://www.find3dprinting.com/blog/3d-printing-cost-guide) · [Cost-per-part benchmark 2026](https://www.makerverse.com/resources/cost-per-part/) · [Online CNC services compared 2026](https://cncdrop.com/guides/best-online-cnc-machining-services-2026)
- [ETL vs UL listed — what US importers need (2026)](https://www.epicsourcing.co/post/etl-listed-vs-ul-listed-us-importers-guide-2026) · [Amazon UL test report requirement (ISO 17025)](https://www.jjrlab.com/news/is-ul-certification-required-for-amazon.html) · [UL standards for importers and Amazon sellers](https://www.compliancegate.com/ul-standards/)
- [Gantri Made](https://www.gantri.com/news/gantri-launches-gantri-made-a-digital-manufacturing-platform-for-the-next-generation-of-designers-and-brands) · [Gantri Made on VoxelMatters](https://www.voxelmatters.com/gantri-made-a-digital-manufacturing-platform-for-lighting-products/) · [Casetify $300M](https://www.cnbc.com/2023/03/16/casetify-from-instagram-photos-on-phone-cases-to-millions-in-revenue.html)
- [POD market $15.19B → $46.43B](https://www.mordorintelligence.com/industry-reports/print-on-demand-market) · [POD market alt. estimate](https://www.coherentmarketinsights.com/industry-reports/print-on-demand-market) · [AI custom products TAM](https://custyle.ai/blog/ai-custom-products)
