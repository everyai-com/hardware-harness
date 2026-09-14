# EVIDENCE — Primary Sources

Every number in this repo traces to something on this page. If a claim is not sourced here, treat it as
an estimate and check it before acting on it.

Two kinds of evidence: the **raw scraped datasets** in this repo, and the **public sources** behind each
finding.

---

## 1. Raw datasets in this repo

### The thread that started it — `apify-output/`

**Source:** https://x.com/eminimnim/status/2098072497182666987 — *"Vibe hardware is here"* (10 Sep 2026,
~477.8K views). nim, co-founder of Dessn, gave GPT-6 Astra a credit card and asked for a Teenage
Engineering-style mini DJ controller.

| File | Contents |
|---|---|
| `x-comments-2098072497182666987.md` | **459 unique comments, 395 unique authors**, 10–12 Sep 2026. Includes the most-liked table and the full chronological thread. The readable master copy. |
| `xquik-x-reply-scraper-*.csv` | Same dataset, tabular (137 KB) |
| `xquik-x-reply-scraper-*.json` | Same dataset, raw (2.4 MB) |
| `data_x_comments.csv` | An **earlier, near-disjoint** 50-reply sample of the same thread |

**Reproduce it:** `npm start` (uses `run-actor.mjs`, `apify-input.json`, and `APIFY_TOKEN` from `.env`).
Token check: `npm run check`. Actor: `BELjuwQScEd6DZpW3` (Twitter/X Comment Scraper).

**What it established** (see `LUXOBENCH.md` §9–11):
- 23 separate people asked what it cost. **Zero answers.**
- nim replied 13 times out of 459 comments — a 2.8% response rate.
- A practitioner priced the real BOM: **$80 DAC + $20 ADC + $10 USB-C PD + $40 IO + $20 ports + $100+
  chassis**, plus **$500–1,000 for signed low-latency audio drivers** — more than the entire bill of
  materials.
- An engineer identified the hero defect: *"violating every DFM principle… only viable tech for that
  shape is SLS in nylon, **$50 for part this big**."*
- A builder reported: *"the pcbs had a lot of errors so i ended up breadboarding it."*
- A practitioner warned: *"sourcing is easy to mess up — last time I had it look for components, it
  nearly ordered me knockoffs."*

### The benchmark — Keil's three posts

| Post | What it gives |
|---|---|
| [10 Sep — the benchmark ask](https://x.com/pronounced_kyle/status/2098141533430304985) | The rubric: *"cost, lead time, ease of build, and whether it actually works"* |
| [12 Sep — before/after](https://x.com/pronounced_kyle/status/2098614819041706462) | Why the first fixture failed: underspecified prompt → *"far-too-simple designs"* |
| [13 Sep — the two-model run](https://x.com/pronounced_kyle/status/2098855357208789449) | Astra vs Fable 5.1, both ordered. *"the face is on the back of the base."* Keil: *"you never really know until you get the parts."* |

### The generated voice note-taker

`harness/src/fixtures/blueprint-voice-note.ts` is encoded from a Blueprint.io output produced on
13 Sep 2026 — the parts list, sources (AliExpress/eBay), tools, and all 16 instruction steps. Nothing in
that fixture is invented; where the source was silent (no PCB, no battery cell, no firmware) the absence
is the finding.

---

## 2. Competition and prior art

| Source | What it establishes |
|---|---|
| **Schematik** — [site](https://www.schematik.io/) · [AI-info page](https://www.schematik.io/ai-info) · [parts catalogue](https://www.schematik.io/parts) · [a published build](https://www.schematik.io/projects/rovie-esp32-line-following-rover-nbn5) · [Build Season 2026](https://www.schematik.io/build-season-2026) · [WIRED](https://www.wired.com/story/schematik-is-cursor-for-hardware-anthropic-wants-in-on-it/) · [$4.6M pre-seed (Lightspeed)](https://techforward.io/schematik-raises-4-6m-pre-seed-to-turn-plain-english-into-working-hardware/) | **The funded, consumer-scale leader in maker electronics, and the strongest evidence that generation is a commodity.** "Cursor for Hardware", 100k+ users, 6,021-part catalogue, build guides with firmware + wiring + a per-project net table, one-click PlatformIO flashing, M5Stack Build Season. **And the counter-evidence for the wedge:** its published BOM tables carry **no prices**, its catalogue carries **no compliance analysis**, and its build contest asks for a photo of the working device rather than what it cost, how long it took or what failed. Also note the origin: the founder blew every fuse in his house with ChatGPT-supplied wiring — the safety case for a verification layer, as a company story |
| [RapidDirect AI Creator](https://www.rapiddirect.com/ai-creator/) | A Shenzhen manufacturer already ships text → render → PRD → CAD → DFM → NPI engineer, free. Generation is commoditised and factory-backed |
| [Atech — TechCrunch](https://techcrunch.com/2026/05/14/lovable-just-backed-a-company-thats-looking-to-bring-vibe-coding-to-hardware/) · [atech.dev](https://www.atech.dev/docs) | **Lovable led an $800K round** for "Lovable for hardware." Constrained to modules + ESP32 — the tell that unconstrained output isn't buildable |
| [Blueprint review](https://cldnavi.com/en/blog/blueprint-am-review-2026/) · [hands-on](https://fabscene.medium.com/can-ai-build-hardware-a-hands-on-review-of-blueprint-the-online-hardware-design-tool-21f07d6694e7) | "Claude for Hardware" ships wiring diagrams, BOMs and CAD, free |
| [Artilora](https://www.artilora.ai/) | Design → procurement → on-demand production, for consumer brands |
| [Genpire](https://www.genpire.com/) · [PitchBook](https://pitchbook.com/profiles/company/1462835-71) | Multi-agent platform, Tel Aviv, seed, 1–10 people |
| [Cofactr](https://www.cofactr.com/) · [funding](https://startupintros.com/orgs/cofactr) | **$17M Series A** (Bain Capital Ventures) for AI procurement execution. 15 people, <$5M revenue, ITAR/defense |
| [Alibaba Accio Sourcing Toolkit](https://www.digitalcommerce360.com/2026/07/24/alibaba-accio-work-agentic-ai-b2b-sourcing/) | Alibaba already runs RFQ + 24/7 supplier negotiation at **10M+ MAU** |
| [JuliaHub $65M](https://siliconangle.com/2026/04/30/agentic-engineering-startup-juliahub-lands-65m-automate-design-testing-industrial-products/) · [Autodesk Fusion MCP](https://www.engineering.com/autodesk-announces-fusion-mcp-servers-and-more-ai-updates/) | Incumbents and well-funded entrants moving in |
| [Leo AI $9.7M](https://www.getleo.ai/blog/leo-ai-raises-9-7m-to-build-the-world-s-first-ai-for-mechanical-engineering) · [Zoo pricing](https://zoo.dev/zoo-pricing) | Engineering AI funded; text-to-CAD given away |
| [atopile](https://atopile.io/) · [Circuit Weaver](https://circuit-weaver.com/) · [Copperplane](https://github.com/GittieLabs/copperplane) · [ForgeLab](https://github.com/andresparraarze/forgelab) | The code-CAD and EDA infrastructure is open source — including a design IR ("the LLVM of design") |

## 3. Benchmarks and eval

| Source | What it establishes |
|---|---|
| [EEBench](https://www.explainx.ai/blog/eebench-ai-circuit-board-design-benchmark-2026) | Grades circuits by **SPICE against real tolerances**. Leaderboard: Opus 5 61.6%, Grok 4.6 57.1%. Simulation only — no manufacturing |
| [PCB-Bench (ICLR 2026)](https://digailab.github.io/PCB-Bench/) | Placement/routing reasoning, 174 real projects |
| [BenchCAD](https://n8nlab.io/blog/gpt-six-astra-benchmark-test) | Astra 95.9% on **geometric overlap** — the metric that misses a face on the wrong side |
| [HWE-Bench](https://arxiv.org/html/2604.14709v1) · [ChipBench](https://arxiv.org/abs/2601.21448) | Hardware bug repair and chip design |

## 4. Manufacturing economics

| Source | What it establishes |
|---|---|
| [China injection mould tooling 2026](https://woosourcing.com/china-injection-mold-tooling-cost/) | Tooling $1,500–$60,000; soft tool $800–$3,000 (10–18 days); steel shot life; **50% deposit, 50% after T1** |
| [3D printing cost guide 2026](https://www.find3dprinting.com/blog/3d-printing-cost-guide) | FDM from $5, resin from $20, SLS from $100, metal $500+ |
| [JLC3DP](https://jlc3dp.com/3d-printing-quote) · [JLCPCB API](https://api.jlcpcb.com/) | Parts from $0.30; 2-day production; **programmatic order placement** |
| [SendCutSend](https://sendcutsend.com/commercial/) | No minimum order, 1–500 parts |
| [Small-batch PCBA](https://kibeloco.com/blog/top-10-small-batch-pcba-suppliers-2026/) · [PCBMay](https://www.pcbmay.com/prototype-pcb-assembly/) | Under-500-unit orders are a third of North American assembly requests; **"No MOQ, one piece prototype available"** |
| [Xometry FY2025](https://investors.xometry.com/news-releases/news-release-details/xometry-reports-record-fourth-quarter-and-strong-full-year-2025) · [10-K](https://www.stocktitan.net/sec-filings/XMTR/10-k-xometry-inc-files-annual-report-9cf4dec9e6a8.html) · [margin model](https://kaeda.co/cases/xometry) | **$686.6M revenue, 34.7% marketplace margin, −$61.7M net loss, 1,174 employees.** The middleware benchmark |
| [Fictiv — how it works](https://www.fictiv.com/why-choose-fictiv/how-it-works) | *"never a bidding pool, and always one accountable partner per order"* — why buyer-chosen factories lose |
| [Adafruit — pricing your product](https://learn.adafruit.com/how-to-build-a-hardware-startup/pricing-your-product) | **≥50% gross margin or the price is too low**; ~2.75× parts at retail; *"don't be surprised if it's 15%"* defect rate |

## 5. Compliance — the volume wall

| Source | What it establishes |
|---|---|
| [FCC kit & subassembly rules](https://emcfastpass.com/fcc-rules-kits-subassemblies/) | **15.23:** exemption needs *not marketed, not from a kit, ≤5 units*. **KDB 927445:** personal builds *"may not be marketed as a kit."* **15.101:** subassemblies sold for further fabrication need no authorisation — how SparkFun/Adafruit operate legally |
| [FCC certification costs](https://compliancetesting.com/fcc-certification-faqs/fcc-certification-cost/) | Unintentional radiator $3–5k; pre-certified module $6.5–10k; **Bluetooth/WiFi/LTE $9–12k**; licensed $12–15k |
| [Battery certification](https://www.ufinebattery.com/blog/essential-guide-to-battery-certification-types-costs-timeframes-and-standards/) · [EU Battery Reg 2023/1542](https://www.polinovelpowbat.com/info/industrial-battery-certification-guide-ul-ce-103451114.html) | UN38.3 attaches to the cell; digital battery passports by 2027 |
| [ETL vs UL for importers](https://www.epicsourcing.co/post/etl-listed-vs-ul-listed-us-importers-guide-2026) · [Amazon UL requirement](https://www.jjrlab.com/news/is-ul-certification-required-for-amazon.html) | Mains products need a listing; a UL test report from an ISO 17025 lab can satisfy marketplaces |

## 6. Tariffs and landed cost

| Source | What it establishes |
|---|---|
| [De minimis ended — 2026 guide](https://tariffschart.com/blog/de-minimis-ended-2026-importer-guide) · [EO 14256](https://www.exfreight.com/de-minimis-rule-china-800-threshold-eliminated/) · [FBA tariffs](https://www.unicargo.com/de-minimis-ended-2026-tariffs-guide-amazon-fba/) | **$800 exemption ended 2 May 2025** for China/HK, globally suspended 29 Aug 2025. Per-parcel duty +35–50%; Section 301 7.5–25%; **~20–30% all-in** |

## 7. Quality, sourcing and counterfeit risk

| Source | What it establishes |
|---|---|
| [Third-party inspection costs](https://topchinasourcing.com/third-party-inspection-companies-china-2026-qima-vs-sgs/) · [QC pricing guide](https://metricrig.com/answers/quality-control-inspection-cost-china-2026/) | **$120–400 per man-day**; QIMA from $229, SGS/BV $300–400; audits $350–500; **AQL 2.5** |
| [Counterfeit sourcing risk](https://electricalflux.com/learn-components/electronic-component-sourcing-counterfeit-avoidance) · [authorised vs grey market](https://www.pcbcart.com/article/content/pcba-component-authenticity.html) | **Analog ICs, voltage regulators and popular MCUs (STM32F103 class) are the most counterfeited.** Authorised costs 5–15% more and removes the exposure |
| [Supplier onboarding](https://ifactoryapp.com/vendor-management/vendor-onboarding-qualification-automation-manufacturing) | 10–15 business days manually: capability, certs, insurance, NDA, payment setup |

## 8. Precedents — why this is hard

| Source | What it establishes |
|---|---|
| [Shapeways Chapter 7](https://3dprinting.com/news/shapeways-files-for-bankruptcy/) · [post-mortem](https://cadmore.com/blog/what-happened-to-shapeways) | "Upload a file, we manufacture and ship it" ran 17 years, listed via SPAC, filed Chapter 7 in July 2024 |
| [Pebble case study](https://startups.in/research/pebble-smart-watch-case-study) · [CB Insights](https://www.cbinsights.com/research/report/hardware-startups-failure-success/) · [61 failures / $21B](https://ideaproof.io/failures/consumer-electronics) · [77 failures / $45.3B](https://www.loot-drop.io/deep-dive/consumer-electronics) | $15M inventory death; the failure pattern is underestimate-and-run-out |
| [Gantri Made](https://www.gantri.com/news/gantri-launches-gantri-made-a-digital-manufacturing-platform-for-the-next-generation-of-designers-and-brands) · [Casetify $300M](https://www.cnbc.com/2023/03/16/casetify-from-instagram-photos-on-phone-cases-to-millions-in-revenue.html) | The models that work: narrow category, pre-tooled base, on-prem manufacturing; 3–5× premium for customisation |
| [Drift DJ Zero](https://driftdj.com/) · [Dirtywave](https://dirtywave.com/) · [Etsy made-to-order lamps](https://www.etsy.com/market/custom_3d_printed_lamps) | The real comparables: small-batch enthusiast hardware that ships, and one-off objects sold at premium prices |

## 9. Enabling infrastructure

| Source | What it establishes |
|---|---|
| [Visa × OpenAI agent payments](https://www.digitalcommerce360.com/2026/06/12/visa-openai-agent-led-payments/) | Since 10 Jun 2026 agents can complete purchases with tokenised credentials, spending limits and merchant controls |
| [KiCAD MCP](https://github.com/ercbb/KiCAD-MCP-Server) · [FreeCAD MCP](https://mcp.directory/blog/freecad-mcp-complete-guide-2026) | Agents can already drive PCB and mechanical CAD, and read datasheets with citations |
| [Anthropic Model Hardware Standard](https://www.pymnts.com/news/artificial-intelligence/2026/anthropic-previews-standard-for-ai-control-of-physical-devices/) | Research preview for agents operating physical lab and manufacturing equipment, via MCP |

---

## How to verify a claim

1. Find the claim in a document.
2. Find its row above.
3. Open the primary source — or re-run the scraper and grep the raw thread.

If a number appears in the repo without a row here, it is an **estimate from the harness model**
(calibrated to the sources above, ±40%) rather than a measurement. The harness labels these
explicitly.
