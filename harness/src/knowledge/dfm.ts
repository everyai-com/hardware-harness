/**
 * DFM rule definitions and material data.
 *
 * Rule IDs are stable API. Each rule exists because it corresponds to a real,
 * observed failure - the `evidence` field records where it came from.
 */

export type Severity = 'block' | 'warn' | 'info';

export interface RuleDef {
  id: RuleId;
  severity: Severity;
  title: string;
  /** Why this rule exists, in one line. */
  rationale: string;
  evidence: string;
}

export type RuleId =
  | 'WALL_TOO_THIN'
  | 'DRAFT_MISSING'
  | 'WALL_NOT_UNIFORM'
  | 'UNDERCUT_PRESENT'
  | 'OVERHANG_NEEDS_SUPPORT'
  | 'SUPPORT_ON_VISIBLE_SURFACE'
  | 'SHARP_INTERNAL_CORNER'
  | 'FEATURE_BELOW_MINIMUM'
  | 'TOLERANCE_UNACHIEVABLE'
  | 'TOLERANCE_STACK'
  | 'HOLE_TOO_CLOSE_TO_BEND'
  | 'SCREW_ENGAGEMENT_LOW'
  | 'SURFACE_QUALITY_MISMATCH'
  | 'PART_COUNT_HIGH'
  | 'TOOLING_AMORTIZATION'
  | 'MOQ_MISMATCH'
  | 'NO_SECOND_SOURCE'
  | 'COUNTERFEIT_RISK'
  | 'CERT_GAP'
  | 'DRIVER_SIGNING_UNBUDGETED'
  | 'RENDER_CAD_DIVERGENCE'
  | 'FEATURE_MISPLACED'
  | 'MAINS_INSIDE_PRODUCT'
  | 'LITHIUM_CELL'
  | 'IMPROVISED_OPERATION'
  | 'ASSEMBLY_TIME_HIGH'
  | 'COST_NOT_DISCLOSED'
  | 'ELECTRONICS_WITHOUT_PCB'
  | 'MISSING_POWER_SOURCE'
  | 'FIRMWARE_MISSING'
  | 'FIRMWARE_DOES_NOT_BUILD'
  | 'PINMAP_MISMATCH'
  | 'LIBRARIES_UNPINNED'
  | 'FIRMWARE_UNTESTED'
  | 'NO_NETS'
  | 'NET_UNKNOWN_PART';

export const RULES: Record<RuleId, RuleDef> = {
  WALL_TOO_THIN: {
    id: 'WALL_TOO_THIN',
    severity: 'block',
    title: 'Wall thinner than the process can make',
    rationale: 'Below the minimum, the part warps, short-shots or fails in service.',
    evidence: 'Process capability data, woosourcing/3D-printing cost guides 2026',
  },
  DRAFT_MISSING: {
    id: 'DRAFT_MISSING',
    severity: 'block',
    title: 'No draft angle on a moulded part',
    rationale: 'A part with no draft cannot be ejected from a steel tool.',
    evidence: 'Moulding DFM review, step 1 of the 8-step tooling process',
  },
  WALL_NOT_UNIFORM: {
    id: 'WALL_NOT_UNIFORM',
    severity: 'warn',
    title: 'Wall thickness varies widely',
    rationale: 'Thick sections cool slower and pull sink marks into the cosmetic face.',
    evidence: 'Moulding DFM review - sink risk is a named flag in every quote',
  },
  UNDERCUT_PRESENT: {
    id: 'UNDERCUT_PRESENT',
    severity: 'warn',
    title: 'Undercut requires a slider or lifter',
    rationale: 'Every side action adds machining cost and a new failure point.',
    evidence: 'Tooling cost driver #3, woosourcing 2026',
  },
  OVERHANG_NEEDS_SUPPORT: {
    id: 'OVERHANG_NEEDS_SUPPORT',
    severity: 'warn',
    title: 'Overhang needs support material',
    rationale: 'Supports add print time, material and cleanup.',
    evidence: 'FDM process limits',
  },
  SUPPORT_ON_VISIBLE_SURFACE: {
    id: 'SUPPORT_ON_VISIBLE_SURFACE',
    severity: 'block',
    title: 'Supports land on a cosmetic surface',
    rationale: 'Support witness marks cannot be sanded out of a visible face without ruining it.',
    evidence: 'Reference render analysis: unmouldable shape "a nightmare for FDM and SLA" - @BartekMoniewski',
  },
  SHARP_INTERNAL_CORNER: {
    id: 'SHARP_INTERNAL_CORNER',
    severity: 'warn',
    title: 'Internal corner tighter than the tool radius',
    rationale: 'A rotating cutter leaves its own radius; the corner will be rounded anyway.',
    evidence: 'CNC process limits',
  },
  FEATURE_BELOW_MINIMUM: {
    id: 'FEATURE_BELOW_MINIMUM',
    severity: 'warn',
    title: 'Feature smaller than the process minimum',
    rationale: 'Small holes and ribs come out undersized or blocked.',
    evidence: 'Process capability data',
  },
  TOLERANCE_UNACHIEVABLE: {
    id: 'TOLERANCE_UNACHIEVABLE',
    severity: 'block',
    title: 'Tolerance tighter than the process can hold',
    rationale: 'The drawing asks for something the machine cannot do, so the part is wrong by design.',
    evidence: 'Process capability data',
  },
  TOLERANCE_STACK: {
    id: 'TOLERANCE_STACK',
    severity: 'block',
    title: 'Tolerance stack exceeds the interface clearance',
    rationale: 'Nominal CAD fits. The assembled worst case does not.',
    evidence: '"cad can fit nominal parts, but tolerance stacks decide whether batch two assembles" - @sebuzdugan',
  },
  HOLE_TOO_CLOSE_TO_BEND: {
    id: 'HOLE_TOO_CLOSE_TO_BEND',
    severity: 'warn',
    title: 'Hole too close to a bend',
    rationale: 'The hole distorts and the fastener no longer lines up.',
    evidence: 'Sheet metal forming limits',
  },
  SCREW_ENGAGEMENT_LOW: {
    id: 'SCREW_ENGAGEMENT_LOW',
    severity: 'warn',
    title: 'Screw thread engagement below minimum',
    rationale: 'Threads strip on first assembly, and again on every service.',
    evidence: 'Plastic fastener design practice',
  },
  SURFACE_QUALITY_MISMATCH: {
    id: 'SURFACE_QUALITY_MISMATCH',
    severity: 'warn',
    title: 'Cosmetic surface made by a process that cannot finish it',
    rationale: 'The part works and still looks wrong - the most common reason a verified build is rejected by the buyer.',
    evidence: '"This looks nothing like what Teenage Engineering would build" - @air_chud',
  },
  PART_COUNT_HIGH: {
    id: 'PART_COUNT_HIGH',
    severity: 'warn',
    title: 'Part count above the assembly budget',
    rationale: 'Every part is a tolerance, a screw, a line in the instructions and a failure mode.',
    evidence: '"HOW many frame pieces is that?" - @Avaviel; LuxoBench gate of 15 parts',
  },
  TOOLING_AMORTIZATION: {
    id: 'TOOLING_AMORTIZATION',
    severity: 'warn',
    title: 'Tooling adds more than 20% to the unit cost',
    rationale: 'The tool is only free at volume. Below break-even you are subsidising the mould.',
    evidence: 'A $5,200 tool is $20.80/unit at 250 units, $5.20 at 1,000',
  },
  MOQ_MISMATCH: {
    id: 'MOQ_MISMATCH',
    severity: 'block',
    title: 'Order quantity is below the process MOQ',
    rationale: 'The order cannot actually be placed, or gets silently rounded up.',
    evidence: '"have your agent pay for 500 MOQ and charge your credit card without realizing" - @PranjayKum77600',
  },
  NO_SECOND_SOURCE: {
    id: 'NO_SECOND_SOURCE',
    severity: 'warn',
    title: 'Part has no second source',
    rationale: 'A single-source ligne item stalls the whole build when it goes out of stock.',
    evidence: '"how does it handle component substitutions when specific chips are unavailable" - @andra_volya',
  },
  COUNTERFEIT_RISK: {
    id: 'COUNTERFEIT_RISK',
    severity: 'block',
    title: 'Programmable or analog part sourced from a non-authorised channel',
    rationale: 'Counterfeits concentrate in exactly these part types, and a fake MCU fails at the worst time.',
    evidence: 'ERAI: most counterfeited are analog ICs, voltage regulators, STM32F103 class MCUs; authorised channels cost 5-15% more. Broker channels (AliExpress/eBay) block; LCSC is reported as an advisory, because a primary-source Asia-market part and a re-marked one look identical from a BOM line.',
  },
  CERT_GAP: {
    id: 'CERT_GAP',
    severity: 'block',
    title: 'Certification required but not budgeted',
    rationale: 'You cannot legally sell it, and the cost lands after the money is spent.',
    evidence: 'FCC $3,000-$15,000 depending on radio class; UL/ETL for mains; UN38.3 for lithium',
  },
  DRIVER_SIGNING_UNBUDGETED: {
    id: 'DRIVER_SIGNING_UNBUDGETED',
    severity: 'warn',
    title: 'USB audio/HID device without driver budget',
    rationale: 'Signed drivers cost more than the entire bill of materials and appear in no AI-generated BOM.',
    evidence: '"signed drivers for low latency audio capabilities, which can cost $500-1000" - @alexflorias',
  },
  RENDER_CAD_DIVERGENCE: {
    id: 'RENDER_CAD_DIVERGENCE',
    severity: 'block',
    title: 'The CAD does not match the render it was made from',
    rationale: 'The AI\'s own artifacts disagree, so "it matches the reference" is not a claim you can make.',
    evidence: '"it assembled you a 3d model that looks completely different from the concept" - @tabloida_',
  },
  FEATURE_MISPLACED: {
    id: 'FEATURE_MISPLACED',
    severity: 'block',
    title: 'A feature is on the wrong face',
    rationale: 'Geometry can be perfect and the design still wrong. A human spots this in half a second.',
    evidence: 'Astra scored 95.9% on BenchCAD and put the face on the back of the base - @pronounced_kyle',
  },
  MAINS_INSIDE_PRODUCT: {
    id: 'MAINS_INSIDE_PRODUCT',
    severity: 'block',
    title: 'Mains voltage inside the product',
    rationale: 'A safety listing per product, plus real liability. Keep mains outside via a certified adapter.',
    evidence: 'UL/ETL listing required for plug-in electrical products; Amazon requires it for most',
  },
  LITHIUM_CELL: {
    id: 'LITHIUM_CELL',
    severity: 'block',
    title: 'Lithium cell in a one-off build',
    rationale: 'UN38.3 attaches to the cell and shipping becomes its own project.',
    evidence: 'UN38.3 mandatory for lithium transport; EU Battery Regulation digital passports by 2027',
  },
  IMPROVISED_OPERATION: {
    id: 'IMPROVISED_OPERATION',
    severity: 'block',
    title: 'Instructions require an improvised operation',
    rationale: '"File this down" and structural epoxy are not build steps, they are the design failing.',
    evidence: 'LuxoBench gate: no improvised operations',
  },
  ASSEMBLY_TIME_HIGH: {
    id: 'ASSEMBLY_TIME_HIGH',
    severity: 'warn',
    title: 'Estimated assembly time over budget',
    rationale: 'Per-unit labour has no economies of scale. It is the margin killer at qty 1.',
    evidence: 'OPERATIONS.md per-order labour model',
  },
  FIRMWARE_MISSING: {
    id: 'FIRMWARE_MISSING',
    severity: 'block',
    title: 'Hardware with no firmware',
    rationale: 'A board with no firmware is inert. Instructions that say "flash the firmware" without shipping any is an unfinished design.',
    evidence: '"curious if the firmware actually runs or just looks plausible. that\'s usually where these builds fall apart" - @RocketDIYerBen',
  },
  FIRMWARE_DOES_NOT_BUILD: {
    id: 'FIRMWARE_DOES_NOT_BUILD',
    severity: 'block',
    title: 'Firmware that has never compiled',
    rationale: 'The software equivalent of a drawing nobody has cut metal for.',
    evidence: 'Same class as a generated PCB that arrives full of errors - @stableshaman',
  },
  PINMAP_MISMATCH: {
    id: 'PINMAP_MISMATCH',
    severity: 'block',
    title: 'Firmware and board disagree about the pin map',
    rationale: 'The single most common reason a first article powers on and does nothing. Two artifacts, one truth.',
    evidence: 'Firmware named as the usual point of failure in AI hardware builds',
  },
  LIBRARIES_UNPINNED: {
    id: 'LIBRARIES_UNPINNED',
    severity: 'warn',
    title: 'Unpinned dependencies',
    rationale: 'The build that worked last month will not build today. Reproducibility includes the toolchain.',
    evidence: 'Standard embedded toolchain drift',
  },
  FIRMWARE_UNTESTED: {
    id: 'FIRMWARE_UNTESTED',
    severity: 'warn',
    title: 'Firmware has never run on real hardware',
    rationale: 'Compiling is not running. Only a physical flash closes this. It is the last unverifiable claim before the build.',
    evidence: '"you never really know until you get the parts" - @pronounced_kyle',
  },
  NO_NETS: {
    id: 'NO_NETS',
    severity: 'warn',
    title: 'Electrical connections are declared nowhere',
    rationale: 'Interfaces say what must fit; only nets say what must connect. Without them the wiring is a guess, and generated designs routinely omit power and ground rails entirely.',
    evidence: 'Every reviewed AI hardware tool tells the user to verify wiring by hand - Blueprint\'s own docs say "AI-generated wiring isn\'t 100% accurate - always verify".',
  },
  NET_UNKNOWN_PART: {
    id: 'NET_UNKNOWN_PART',
    severity: 'block',
    title: 'A net references a part that does not exist in the BOM',
    rationale: 'A connection to a phantom part is a guaranteed dead build - the most basic consistency check there is, and generated designs fail it constantly.',
    evidence: 'Generated designs list modules that never appear in their own BOM (Blueprint voice note-taker: 5 electronic parts, no firmware, marketplace sourcing).',
  },
  ELECTRONICS_WITHOUT_PCB: {
    id: 'ELECTRONICS_WITHOUT_PCB',
    severity: 'block',
    title: 'Electronics with no board in the bill of materials',
    rationale: 'Hand-wiring a module to discrete chips is not a build step, it is the absence of a design. Nothing is repeatable and nothing can be debugged.',
    evidence: 'A generated design listed an MCU, mic, NFC, charger and LEDs with wiring steps but no PCB line item - the plan said "design a custom PCB", the BOM never contained one',
  },
  MISSING_POWER_SOURCE: {
    id: 'MISSING_POWER_SOURCE',
    severity: 'block',
    title: 'The battery is described but not in the bill of materials',
    rationale: 'You cannot order a device that lists a charger for a cell it never specifies - capacity and connector decide whether it fits at all.',
    evidence: 'A generated BOM listed a LiPo charger IC and referenced a 1S battery, with no cell line item',
  },
  COST_NOT_DISCLOSED: {
    id: 'COST_NOT_DISCLOSED',
    severity: 'info',
    title: 'Landed cost not published with the design',
    rationale: 'Everyone publishes designs. Nobody publishes cost. It is the first thing buyers ask.',
    evidence: '23 cost questions, 0 answers on the viral thread; cost is first on Keil\'s own rubric',
  },
};

export interface Material {
  id: string;
  label: string;
  minWallMm: number;
  /** Shrinkage as a fraction, used for moulded parts. */
  shrink: number;
  densityGPerCm3: number;
  costPerKgUsd: [number, number];
  notes: string[];
}

export const MATERIALS: Record<string, Material> = {
  pla: { id: 'pla', label: 'PLA', minWallMm: 1.2, shrink: 0.003, densityGPerCm3: 1.24, costPerKgUsd: [18, 30], notes: ['Brittle, low heat resistance (~55C). Prototypes only.'] },
  petg: { id: 'petg', label: 'PETG', minWallMm: 1.2, shrink: 0.004, densityGPerCm3: 1.27, costPerKgUsd: [20, 35], notes: ['Tougher than PLA, still low heat resistance.'] },
  pa12: { id: 'pa12', label: 'Nylon PA12 (SLS/MJF)', minWallMm: 0.8, shrink: 0.015, densityGPerCm3: 1.01, costPerKgUsd: [60, 110], notes: ['The default for complex functional parts. Matte finish, dyeable.'] },
  abs: { id: 'abs', label: 'ABS', minWallMm: 1.5, shrink: 0.006, densityGPerCm3: 1.04, costPerKgUsd: [2, 5], notes: ['Moulding workhorse. Uniform wall thickness is critical.'] },
  pp: { id: 'pp', label: 'PP', minWallMm: 1.2, shrink: 0.016, densityGPerCm3: 0.905, costPerKgUsd: [1.5, 3], notes: ['Living hinges possible. High shrink needs generous draft.'] },
  pc: { id: 'pc', label: 'Polycarbonate', minWallMm: 1.8, shrink: 0.006, densityGPerCm3: 1.2, costPerKgUsd: [4, 9], notes: ['Tough and clear; needs drying and higher mould temps.'] },
  pmma: { id: 'pmma', label: 'Acrylic (PMMA)', minWallMm: 1.5, shrink: 0.005, densityGPerCm3: 1.18, costPerKgUsd: [3, 7], notes: ['Clear light guide / diffuser material. Scratches easily.'] },
  resin_std: { id: 'resin_std', label: 'SLA standard resin', minWallMm: 0.8, shrink: 0.0, densityGPerCm3: 1.12, costPerKgUsd: [40, 80], notes: ['Good surface finish, brittle, UV-ages. Not structural, not for outdoors.'] },
  silicone: { id: 'silicone', label: 'Silicone (cast/moulded)', minWallMm: 1.0, shrink: 0.0, densityGPerCm3: 1.15, costPerKgUsd: [18, 40], notes: ['Diffuser and grip material; needs its own mould.'] },
  tpu: { id: 'tpu', label: 'TPU', minWallMm: 1.0, shrink: 0.008, densityGPerCm3: 1.21, costPerKgUsd: [25, 45], notes: ['Flexible printed parts; slow to print.'] },
  alu6061: { id: 'alu6061', label: 'Aluminium 6061', minWallMm: 0.8, shrink: 0.0, densityGPerCm3: 2.7, costPerKgUsd: [5, 12], notes: ['Machined finish reads as premium. Anodising is a separate line item.'] },
};
