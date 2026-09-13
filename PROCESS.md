# The Vibe-Hardware Process — Verified Stack & Competitive Map

*Compiled 2026-09-12. Fourth doc; see `RESEARCH.md`, `OPERATIONS.md`, `LUXOBENCH.md`.*

---

## 0. Two clarifications first

**Yes — LuxoBench is not a product, and the person is at a16z.** Christian Keil (@pronounced_kyle) is
an **Investing Partner at Andreessen Horowitz** on the *American Dynamism* team (joined early 2026),
formerly an executive at **Astranis** building satellites. LuxoBench is a personal weekend benchmark
he's recruiting collaborators for. Nobody owns it, there's no repo, no leaderboard, no company. It is
an **open invitation** — which is why it's an opportunity rather than a competitor.

**"Cursor Bench" is a different thing entirely.** **CursorBench** is Anysphere's internal *coding*
benchmark — evaluation tasks pulled from real Cursor sessions by their own engineers (averaging 352
lines across 8 files), specifically because public benchmarks like SWE-bench had become contaminated.
It has nothing to do with hardware.

But the *pattern* is the point, and it's worth naming: **CursorBench is exactly the template Keil is
implicitly copying.** Cursor built its own benchmark from real usage instead of curated public tasks,
and it became the standard the industry cites. Keil is proposing the hardware version of that. That's
why LuxoBench matters more than it looks — it's the pattern that produced a de-facto industry standard
last time.

---

## 1. The exact process, stage by stage

This is the whole loop, with the real tooling that exists for each step today. Nothing here is
speculative or Astra-specific.

### Stage 1 — Intent → concept image
Any image model. Style anchors do the work ("Teenage Engineering-style"). **This stage is solved and
worth zero.**

### Stage 2 — Circuit design (the part people assume is impossible)
| Tool | What it does |
|---|---|
| **atopile** | `.ato` declarative language + compiler + toolchain. "Write hardware like software." Deep validation, KiCad-native layout. v0.16 is a browser workspace. Funded company, open-core |
| **Circuit Weaver** | Open-source AI circuit design + KiCad automation: generates **native** schematics, validates, prepares placement, sources parts, exports manufacturing files |
| **KiCad MCP servers** | ~233 tools covering schematic capture, layout, routing, **DRC/ERC**, 3D render, manufacturing export. Multiple implementations |
| **EEBench's approach** | Grading by **SPICE simulation against real manufacturer component tolerances** across worst-case corners — the strongest verification method published so far |

OpenAI putting **KiCad on the GPT-6 Astra launch page** (calling PCB layout "a common source of
latency in electronics design") is what made this mainstream in September 2026.

### Stage 3 — Mechanical CAD + the datasheet problem
| Tool | What it does |
|---|---|
| **Copperplane / Hardware Agent Studio** (open source, local-first) | One workspace bridging **KiCad + FreeCAD** instead of disconnected plugins — and critically: **"It reads the datasheet and shows you the page it got that from."** Citation-grounded datasheet reading is the actual anti-hallucination mechanism |
| **FreeCAD MCP** | 11 tools, parametric part recipes, **screenshot feedback loop**, STEP/STL export |
| **ForgeLab** | "The LLVM of design" — agents design parts and 3D models, export to real tool files, **one JSON intermediate representation**. This is someone building the spec/IR layer in the open |
| **Blender MCP / OpenSCAD** | Renders and assembly animations |

### Stage 4 — Verification (the stage everyone skips)
ERC/DRC clean → SPICE against real tolerances → DFM check → tolerance stack. **EEBench's core lesson
is the entire justification for this stage:** a design that compiles is not a design that works. Their
canonical failure: a 22µF capacitor at 4.7V bias delivers only **11.4µF** effective when the circuit
needed 545µF — rail collapsed in 0.85ms against a 20ms requirement. **It built cleanly and still
failed.** Every AI hardware design faces this exact trap.

### Stage 5 — Parts sourcing (programmatic, today)
| Rail | Status |
|---|---|
| **LCSC API** | Live part search/pricing; requires account + business docs + API key via support |
| **LCSC MCP Server** | Parametric search for passives by value/package/tolerance with live API access |
| **JLCPCB API** | **Public API for PCB, stencil and 3D printing order placement**, with SDKs — you can automate quote → Gerber upload → order |
| **DigiKey / Mouser / Octopart** | Distributor APIs for availability and pricing |
| **Chinese datasheets** | Reading them is the acknowledged bottleneck for hobbyists (potentiometers, encoders, small SBCs) — a real, verified differentiator |

### Stage 6 — Checkout
**This became real on June 10, 2026:** Visa plugged its payment network into ChatGPT at the Visa
Payments Forum — tokenized credentials, fraud monitoring, **user-defined spending limits, merchant
category controls, and approval requirements** for agent-initiated payments. Combined with
JLCPCB/LCSC APIs, "give the agent a card and tell it to order everything" is now a supported pattern
with guardrails rather than a stunt.

### Stage 7 — Assembly documentation + physical fulfillment
Blender animation/printed guide (keil's framing: instructions-first, hardware-second). Fulfillment via
JLC3DP (parts from **$0.30**, 2-day production), PCBWay (MOQ as low as 5), SendCutSend (no minimum,
1–500 parts), or Xometry/Protolabs Network/Fictiv for industrial tolerances.

**Bottom line: every stage of the pipeline exists today, almost all of it open source or free, and
none of it is model-specific.**

---

## 2. "Normal models can also work well" — you're right, and here's the evidence

| Evidence | Detail |
|---|---|
| **EEBench leaderboard** (Sep 1 2026, 13 tasks) | Claude Opus 5 **61.6%**, Grok 4.6 **57.1%**, Claude Fable 5.1 **56.4%**, Fable 5 **54.3%**, Opus 4.8 Max **51.4%** — vs GPT-5.5 42.3%, GPT-5.6 Sol 39.4%. Astra's 69.3% is an unofficial single HN comment, not published methodology |
| **Real fabbed board** | A developer had Claude Opus 4.8 design a 74-series-logic VGA-from-EEPROM circuit, routed it manually, and fabbed it at **JLCPCB for $6** — one error, one blue-wire fix, otherwise it worked |
| **Other reports** | Fable 5 vibe-coded 3 PCBs that "came back working first time"; Sol fully routed an RP2040 board via generated Python routing scripts |
| **Structural point** | atopile, KiCad MCP, Circuit Weaver and FreeCAD MCP are **model-agnostic by design**. The capability lives in the toolchain and the verification loop, not in one vendor's weights |

Notable inversion worth holding onto: **OpenAI's models underperform on EEBench relative to their
general coding standing** while Claude and Grok lead — the opposite of the BenchCAD picture, where
Astra leads at 95.9% (a *geometric overlap* metric). Two benchmarks, two different winners, because
they measure different things. **Pick your benchmark and you pick your winner.**

---

## 3. Who already owns each layer

| Layer | Occupants | Status |
|---|---|---|
| Concept → BOM + CAD + instructions | **Blueprint** (blueprint.io, by 3E8 Robotics, marketed as "Claude for Hardware" — free tier, wiring diagrams + BOM + assembly guides + 3D CAD in minutes), **RapidDirect AI Creator** (free, factory-backed), MORPHIC, Nirmana AI, Zoo, Leo AI ($9.7M), Backflip | **Crowded, mostly free, commoditizing fast** |
| Code-CAD / EDA infrastructure | atopile (funded, open-core), Circuit Weaver (OSS), Copperplane (OSS), ForgeLab (OSS, design IR), KiCad/FreeCAD MCPs | **Open source, commoditizing** |
| BOM → procurement execution | **Cofactr** — $17M total, **Series A led by Bain Capital Ventures** + YC + Floating Point; ITAR-registered, physical ESD-safe warehouses, 500+ suppliers, "upload your BOM, AI sources and negotiates, we kit and ship." **15 employees, <$5M revenue**. Also Alibaba's Accio (100M+ products) and Made-in-China's SourcingAI | **Funded, but narrow: defense/aero/ITAR, B2B** |
| Design → on-demand production for brands | **Artilora** — "world's first product design & procurement AI agent… from design, visuals and 3D to **on-demand production**," aimed at jewelry, designer toys, consumer goods, with "a path to RFQ-ready specs" | **Closest direct competitor to your idea. Early** |
| **Modular hardware-from-chat** | **Atech** (atech.dev, Danish) — describe a device → generated configuration + **working ESP32 firmware**; pre-built modules snap onto a motherboard, **no soldering, no breadboards**. Tagline: "Hardware from a chat" | **$800K pre-seed from Lovable, Emblem, Nordic Makers, Sequoia Scout Fund and a16z's scout fund. Funded and shipping** |
| Enterprise engineering AI | JuliaHub (**$65M**, agentic engineering), Neural Concept (AI Design Copilot, thousands of manufacturing-ready geometries), **Autodesk** (Fusion MCP servers + Assistant + generative rendering + generative design), Siemens | **Well-funded incumbents moving in** |
| Middleware / fulfillment | Xometry ($807M TTM), Protolabs Network, Fictiv ($192M raised), Craftcloud (180+ partners), Treatstock | **Established, owns the factories** |
| Physical equipment control | **Anthropic Model Hardware Standard** (research preview, Aug 2026) — shared spec letting agents operate microscopes, liquid handlers, robotic arms, manufacturing equipment via MCP/CLI/code, model-agnostic, plans to open-source. Genentech, HHMI Janelia, QuEra already running it | **The rails for machine-verified builds** |

### The one you need to know about: Atech

Found through the reply CSV, not through search — **nim himself was pointed at @Atech_dev and replied "oh
this is exactly what I need!"** Atech is a Danish startup that raised **$800K pre-seed in May 2026, led
by Lovable** (with Emblem, Nordic Makers, Sequoia Scout Fund and a16z's scout fund), covered by
TechCrunch as *"Lovable just backed a company that's looking to bring vibe coding to hardware."*

Read those two sentences again alongside the name of this folder. **"Lovable for hardware" is no longer
a pitch — it's a funded company, and Lovable itself wrote the check.**

Two things matter about their architecture:

1. **They solved certification by design.** Pre-built modules snap onto a motherboard with no soldering
   and no breadboards. Pre-certified modules mean you don't need a fresh FCC filing per product — that's
   the exact workaround identified in `RESEARCH.md` §4.2, implemented as a product decision.
2. **They converged on composition, not fabrication.** This is the same conclusion as `RESEARCH.md` §10
   ("compose, don't manufacture") and as nim's own reply about keeping soldering minimal and using
   prebuilt parts. Two independent teams, same answer.

Their limits are the interesting part: ESP32 firmware + configurable modules is **electronics-first and
constrained to a module catalog**. It doesn't do industrial design, injection-mold-ready mechanical
specs, tooling-cost amortization, or supplier negotiation. **The mechanical/industrial and fulfillment
halves are still open** — which is exactly where `RESEARCH.md` §7 and `OPERATIONS.md` put the value.

---

## 4. So is what you're building already there?

**Partly — and the part that's missing is not the part everyone thinks.**

✅ **Design/spec generation: solved, commoditized, mostly free.** Blueprint gives away wiring diagrams,
BOMs and CAD. RapidDirect gives away renders, PRDs, DFM analysis and 3D models to funnel you into
their factory. Do not build this as your product.

✅ **Ordering rails: exist and are open.** JLCPCB API accepts programmatic orders; LCSC API does parts;
Visa×OpenAI handles agentic payment with limits.

✅ **BOM → procurement: funded but narrow.** Cofactr ($17M, 15 people, <$5M revenue, ITAR/defense).
Small enough to be beatable, specialized enough to leave the consumer/prosumer space open.

❌ **The closed loop with physical verification and accountability: nobody has it.** Nobody guarantees
the object that arrives works. Nobody owns the consequence when it doesn't. Every player above stops
at the artifact — a schematic, a BOM, a render, an animation, at most a shipment. The gap isn't
"can AI design hardware" — that shipped in September 2026 and it's free. **The gap is the
acceptance test and the liability.**

That's not an accident. It's missing for exactly the reasons in `OPERATIONS.md`: per-unit labor, QC on
every order, working capital, merchant-of-record risk. Which means **the gap is an ops gap disguised
as a software gap** — and that's precisely why it's still open three weeks after the demos went viral.

---

## 5. Where you can actually "be there"

Three entry points, ranked by how defensible they are right now:

**1. Be the acceptance test, not another generator.** Everyone above generates artifacts; nobody
verifies them physically. Build the harness that takes any tool's output (Blueprint's, Artilora's,
RapidDirect's, a raw model's) and answers: are the parts real and in stock, does the CAD open clean,
does ERC/DRC pass, what's the true landed cost and critical-path lead time, does a human build it in
under 20 minutes, does it survive a drop. **This is LuxoBench as a service.** It's small, fast,
model-agnostic, sells into the entire ecosystem above, and the failure taxonomy you accumulate becomes
the DFM rule engine — which is the moat from `RESEARCH.md` §8. Keil is recruiting collaborators for
this publicly, on the a16z American Dynamism account, in a category they fund.

> **Built:** `harness/` is the first working version of this layer — a model-agnostic engine and MCP
> server that scores a design against the LuxoBench gates and prices it at qty 1/100/1000. See
> `harness/README.md`.

**2. Own one niche end to end, at qty 1–10.** Artilora is generic across jewelry/toys/consumer goods.
Pick a single category with a real community (desk lamps, MIDI controllers, mechanical keyboards,
desk accessories), zero certification burden, and customers who already pay a premium for
one-offs. Compete on *"it arrives and it works,"* not on design quality. The generic players cannot
out-execute you on one category's assembly reality.

**3. Sell the BOM reality layer as an API.** Part availability + true landed cost + critical-path lead
time, for prosumer/consumer rather than ITAR defense. Cofactr proved the demand at $17M raised; they've
deliberately aimed away from your market.

**What I would not do:** build another design generator, or a general marketplace. Both are occupied,
one is free, and the second needs 1,174 employees and 13 years.

---

## 6. Market reality check

- **Timing:** Astra launched **Sep 3**, EEBench published **Sep 4**, the DJ controller went viral
  **Sep 10**, Blueprint's "Claude for Hardware" push was **Sep 10–13**. This category is roughly two
  weeks old. Being early is an advantage — and the reason it's movable is that it's this new.
- **The survivorship warning:** one 2026 analysis claims **3,800 AI agent startups shut down in 2025
  and another 1,800 in early 2026, with over 70% of horizontal agents never converting from demo to
  production.** Treat those numbers as directional (single source, marketing-adjacent), but the shape
  is right: horizontal "agent for everything" companies are dying in bulk. The survivors are
  vertical, ops-heavy, and own a specific hard step.
- **The one-line positioning that survives all of the above:** *everyone else generates the design;
  you're the one who proves it's real and takes the risk that it isn't.* That's an operations company
  with software leverage — which is exactly what Xometry is, and exactly what the last three weeks of
  viral demos haven't built.

---

## Sources

- [Christian Keil is an a16z Investing Partner (American Dynamism), ex-Astranis](https://www.pronouncedkyle.com/) · [a16z profile summary](https://yespress.io/christian-keil) · [Keil's X profile](https://x.com/pronounced_kyle) · [Keil on hardware design as a process, graded on manufacturability](https://x.com/pronounced_kyle/status/2096641789516193954)
- [CursorBench — real Cursor sessions, not public repos](https://cursor.com/blog/cursorbench) · [CursorBench leaderboard](https://cursor.com/cursorbench) · [Why Cursor built its own benchmark](https://agent-wars.com/news/2026-03-13-how-cursor-compares-model-quality-with-cursorbench)
- [atopile — design circuit boards with code](https://atopile.io/) · [atopile GitHub](https://github.com/atopile/atopile) · [atopile funding profile](https://pitchbook.com/profiles/company/553973-68)
- [Circuit Weaver — open-source AI circuit design & KiCad automation](https://circuit-weaver.com/) · [Copperplane / Hardware Agent Studio (KiCad + FreeCAD, cites its datasheet sources)](https://github.com/GittieLabs/copperplane) · [Hardware Agent Studio site](https://gittielabs.github.io/hardware-agent-studio/) · [ForgeLab — one JSON IR for design tools](https://github.com/andresparraarze/forgelab)
- [EEBench — SPICE grading against real tolerances, leaderboard and the 22µF capacitor failure](https://www.explainx.ai/blog/eebench-ai-circuit-board-design-benchmark-2026) · [KiCad MCP server discussion incl. DRC/ERC, auto-routing, manufacturing export](https://forum.kicad.info/t/i-built-an-open-source-mcp-server-for-ai-assisted-kicad-workflows/68678) · [AI hardware design in 2026: schematics, PCB, enclosures](https://tecadrise.ai/blog/ai-hardware-design-vibe-pcb-enclosures-2026)
- [JLCPCB API — automate PCB, stencil and 3D printing orders](https://api.jlcpcb.com/) · [JLCPCB API access](https://jlcpcb.com/help/article/jlcpcb-online-api-available-now) · [LCSC API docs](https://www.lcsc.com/docs/index.html) · [LCSC MCP server for live part search](https://pjcau.github.io/esp32-emu-turbo/docs/tooling/jlcpcb-integration)
- [Visa × OpenAI agent-led payments (June 10 2026): tokenized credentials, spending limits, merchant controls](https://www.digitalcommerce360.com/2026/06/12/visa-openai-agent-led-payments/) · [Agentic payments stack 2026](https://payspacemagazine.com/articles/agentic-payments-2026-how-ai-agents-are-reshaping-commerce-and-payment-infrastructure/)
- [Blueprint ("Claude for Hardware") hands-on review](https://cldnavi.com/en/blog/blueprint-am-review-2026/) · [Blueprint review — free tier, 4.1/5](https://agentaya.com/ai-review/blueprint/) · [Blueprint manual test on a real concept](https://fabscene.medium.com/can-ai-build-hardware-a-hands-on-review-of-blueprint-the-online-hardware-design-tool-21f07d6694e7) · [blueprint.io](https://www.blueprint.io/)
- [Artilora — product design & procurement AI agent, design to on-demand production](https://www.artilora.ai/) · [Artilora product page (RFQ-ready specs)](https://www.artilora.ai/solutions/product)
- **Atech** — [Lovable invests in Danish hardware startup Atech (TechCrunch, May 2026)](https://techcrunch.com/2026/05/14/lovable-just-backed-a-company-thats-looking-to-bring-vibe-coding-to-hardware/) · [atech.dev — "Hardware from a chat"](https://www.atech.dev/) · [Atech docs: modular platform, ESP32 firmware, no soldering](https://www.atech.dev/docs) · [$800K pre-seed detail](https://varenyaz.com/news/lovable-atech-vibe-coding-hardware/)
- **The real hardware comparables** nim pointed at: [Dirtywave (linked from the thread)](https://dirtywave.com/) · [Drift DJ Industries Zero — Chicago-built palm-sized standalone DJ system, production units shipping](https://driftdj.com/) · [Drift Zero specs and coverage](https://synthanatomy.com/2026/05/drift-dj-industries-zero.html)
- [Cofactr — $17M Series A led by Bain Capital Ventures, 15 employees, <$5M revenue](https://startupintros.com/orgs/cofactr) · [Cofactr: upload BOM, AI sources and negotiates, we kit and ship](https://www.cofactr.com/) · [Cofactr ITAR procurement execution profile](https://spotlightonstartups.com/cofactr-news-inside-the-itar-registered-procurement-execution-platform-built-for-aerospace-and-defense-hardware-teams/)
- [JuliaHub raises $65M for agentic industrial engineering](https://siliconangle.com/2026/04/30/agentic-engineering-startup-juliahub-lands-65m-automate-design-testing-industrial-products/) · [Neural Concept AI Design Copilot](https://www.neuralconcept.com/press-release/neural-concept-ai-design-copilot) · [Autodesk Fusion MCP servers and AI updates](https://www.engineering.com/autodesk-announces-fusion-mcp-servers-and-more-ai-updates/)
- [Anthropic Model Hardware Standard research preview](https://www.pymnts.com/news/artificial-intelligence/2026/anthropic-previews-standard-for-ai-control-of-physical-devices/) · [MHS for manufacturing equipment](https://metrology.news/anthropic-develops-standard-for-ai-agents-to-control-manufacturing-equipment/) · [MHS security criticism](https://www.esecurityplanet.com/artificial-intelligence/news-anthropic-mhs-ai-agent-machine-security/)
- [3,800 agent startups shut down in 2025 / 1,800 in early 2026 (single-source, directional)](https://preuve.ai/blog/ai-agent-startup-ideas-2026)
