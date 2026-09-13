/**
 * Manufacturing process capabilities and cost models.
 *
 * Every number here is a research-backed estimate with a source. None of it is
 * precise to the dollar - it is precise enough to make a design decision and to
 * catch the "that can't be made" class of error before money moves.
 *
 * Primary sources (see ../../RESEARCH.md, ../../OPERATIONS.md):
 *  - China injection mould tooling costs 2026 (woosourcing / haizol / tradeentrust)
 *  - 3D printing cost guide 2026 (find3dprinting: FDM from $5, resin from $20, SLS from $100, metal $500+)
 *  - Low-volume CNC: 10-1000 parts, no tooling, ~14 days (xavier-parts)
 *  - SendCutSend: no minimum, 1-500 parts (sendcutsend.com/commercial)
 *  - JLCPCB / JLC3DP: 3D print production from 2 days, parts from $0.30
 *  - Engineer estimate from the thread: "SLS in nylon, $50 for part this big"
 */

export type ProcessId =
  | 'fdm'
  | 'resin_sla'
  | 'sls_mjf'
  | 'cnc_3axis'
  | 'sheet_metal'
  | 'pcb_assembly'
  | 'soft_tool'
  | 'injection_molding'
  | 'injection_molding_multicavity';

export interface Process {
  id: ProcessId;
  label: string;
  /** Minimum wall thickness, mm. Below this the part fails or warps. */
  minWallMm: number;
  /** Minimum draft angle in degrees required to release from a tool. 0 = not applicable. */
  minDraftDeg: number;
  /** Smallest reliable feature (holes, ribs, bosses), mm. */
  minFeatureMm: number;
  /** Achievable tolerance, +/- mm. */
  toleranceMm: number;
  /** Overhang beyond this angle from vertical needs support (FDM). 90 = no limit. */
  maxOverhangDeg: number;
  /** One-time tooling or setup cost, USD. */
  toolingUsd: [number, number];
  /** Days from order to parts in hand (production + shipping), excluding design iterations. */
  leadTimeDays: [number, number];
  /** Recommended minimum order quantity. */
  moq: number;
  /** Whether supports land on cosmetic surfaces (a finished-goods problem, not just a cost problem). */
  supportsOnVisibleSurfaces: boolean;
  /** Effective cost per cubic centimetre of solid material, USD. Used with a bounding-box proxy. */
  costPerCm3: number;
  /** Per-order floor price, USD. */
  floorPriceUsd: number;
  /** Setup / programming / fixture cost per order (not amortised tooling), USD. */
  setupPerOrderUsd: [number, number];
  /** Notes a designer must know. */
  notes: string[];
  source: string;
}

export const PROCESSES: Record<ProcessId, Process> = {
  fdm: {
    id: 'fdm',
    label: 'FDM 3D print (PLA/PETG)',
    minWallMm: 1.2,
    minDraftDeg: 0,
    minFeatureMm: 2.0,
    toleranceMm: 0.5,
    maxOverhangDeg: 45,
    toolingUsd: [0, 0],
    leadTimeDays: [2, 5],
    moq: 1,
    supportsOnVisibleSurfaces: true,
    costPerCm3: 0.05,
    floorPriceUsd: 5,
    setupPerOrderUsd: [0, 0],
    notes: [
      'Layer lines are visible - not a finished cosmetic surface without post-processing.',
      'Overhangs beyond 45 degrees need supports that scar the surface they touch.',
      'Weakest option in Z (layer adhesion). Do not use for load-bearing joints.',
    ],
    source: 'find3dprinting 2026 cost guide; JLC3DP 2-day production',
  },
  resin_sla: {
    id: 'resin_sla',
    label: 'SLA / DLP resin print',
    minWallMm: 0.8,
    minDraftDeg: 0,
    minFeatureMm: 1.0,
    toleranceMm: 0.2,
    maxOverhangDeg: 30,
    toolingUsd: [0, 0],
    leadTimeDays: [2, 6],
    moq: 1,
    supportsOnVisibleSurfaces: true,
    costPerCm3: 0.12,
    floorPriceUsd: 20,
    setupPerOrderUsd: [0, 0],
    notes: [
      'Best surface finish of the additive processes.',
      'Standard resins are brittle and UV-age - not a structural or outdoor part.',
      'Supports leave witness marks; orient so they land on hidden faces.',
    ],
    source: 'find3dprinting 2026 cost guide (resin from $20)',
  },
  sls_mjf: {
    id: 'sls_mjf',
    label: 'SLS / MJF nylon',
    minWallMm: 0.8,
    minDraftDeg: 0,
    minFeatureMm: 1.5,
    toleranceMm: 0.3,
    maxOverhangDeg: 90,
    toolingUsd: [0, 0],
    leadTimeDays: [3, 8],
    moq: 1,
    supportsOnVisibleSurfaces: false,
    costPerCm3: 0.45,
    floorPriceUsd: 30,
    setupPerOrderUsd: [0, 0],
    notes: [
      'No supports required - the only process that makes complex geometry with a clean finish.',
      'Matte, slightly porous nylon: takes dye and paint well, no glossy finish.',
      'The engineer-verified answer for shapes that violate moulding rules: "only viable tech for that shape is SLS in nylon".',
    ],
    source: 'find3dprinting (SLS from $100); @BartekMoniewski thread estimate ~$50 for a lamp-size part',
  },
  cnc_3axis: {
    id: 'cnc_3axis',
    label: 'CNC machining (3-axis)',
    minWallMm: 0.8,
    minDraftDeg: 0,
    minFeatureMm: 1.0,
    toleranceMm: 0.05,
    maxOverhangDeg: 90,
    toolingUsd: [0, 0],
    leadTimeDays: [5, 14],
    moq: 1,
    supportsOnVisibleSurfaces: false,
    costPerCm3: 1.8,
    floorPriceUsd: 40,
    setupPerOrderUsd: [25, 80],
    notes: [
      'No tooling - the correct answer for 10-1000 units that must look machined.',
      'Internal corners carry the tool radius; you cannot machine a sharp internal corner.',
      'Cost is driven by setup + machine time, so unit price falls slowly with quantity.',
    ],
    source: 'xavier-parts low-volume CNC guide (10-1000 parts, no tooling, ~14 days)',
  },
  sheet_metal: {
    id: 'sheet_metal',
    label: 'Sheet metal (laser cut + bend)',
    minWallMm: 0.5,
    minDraftDeg: 0,
    minFeatureMm: 1.0,
    toleranceMm: 0.2,
    maxOverhangDeg: 90,
    toolingUsd: [0, 0],
    leadTimeDays: [3, 10],
    moq: 1,
    supportsOnVisibleSurfaces: false,
    costPerCm3: 0.9,
    floorPriceUsd: 15,
    setupPerOrderUsd: [0, 40],
    notes: [
      'No minimum order - genuinely qty 1 friendly.',
      'Bend radius must be >= material thickness; design flat patterns, not solid models.',
      'Holes closer than ~1.5x thickness to a bend will distort.',
    ],
    source: 'SendCutSend: no minimum order, 1-500 parts',
  },
  pcb_assembly: {
    id: 'pcb_assembly',
    label: 'PCB fabrication + assembly (JLCPCB / PCBWay)',
    minWallMm: 0.4,
    minDraftDeg: 0,
    minFeatureMm: 0.15,
    toleranceMm: 0.1,
    maxOverhangDeg: 90,
    toolingUsd: [0, 0],
    leadTimeDays: [3, 7],
    moq: 5,
    supportsOnVisibleSurfaces: false,
    costPerCm3: 0.03,
    floorPriceUsd: 2,
    setupPerOrderUsd: [5, 25],
    notes: [
      'JLCPCB will fabricate AND place the parts from the LCSC library - 5 boards from a few dollars, 2-day production.',
      'This is the cheapest way to delete hand-wiring labour, which is the dominant cost in small-batch electronics.',
      'MOQ is effectively 5 boards: cheap enough that the minimum never blocks a one-off.',
    ],
    source: 'JLCPCB API / PCBA pricing; PCBWay order minimum 5',
  },
  soft_tool: {
    id: 'soft_tool',
    label: 'Soft tool (aluminium / P20 prototype mould)',
    minWallMm: 1.5,
    minDraftDeg: 1,
    minFeatureMm: 1.0,
    toleranceMm: 0.15,
    maxOverhangDeg: 90,
    toolingUsd: [800, 3000],
    leadTimeDays: [10, 18],
    moq: 50,
    supportsOnVisibleSurfaces: false,
    costPerCm3: 0.09,
    floorPriceUsd: 0,
    setupPerOrderUsd: [100, 300],
    notes: [
      'Real production material, real moulding faults exposed, at a fraction of hard tool cost.',
      'Shot life 5,000-30,000 (aluminium/P20) - fine for validation, not for a production run.',
      'The correct bridge between prototyping and a $6,000+ steel tool.',
    ],
    source: 'woosourcing 2026 tooling guide: soft/prototype tool $800-$3,000, 10-18 days',
  },
  injection_molding: {
    id: 'injection_molding',
    label: 'Injection moulding (single cavity, steel)',
    minWallMm: 1.5,
    minDraftDeg: 1,
    minFeatureMm: 1.0,
    toleranceMm: 0.1,
    maxOverhangDeg: 90,
    toolingUsd: [1500, 6000],
    leadTimeDays: [30, 55],
    moq: 500,
    supportsOnVisibleSurfaces: false,
    costPerCm3: 0.04,
    floorPriceUsd: 0,
    setupPerOrderUsd: [100, 300],
    notes: [
      'Tool build 18-25 days for a small simple part; add 2-3 weeks for T1/T2 correction rounds.',
      'Wall thickness must be uniform or you get sink marks on the cosmetic face.',
      'Undercuts need sliders/lifters, which add cost and failure points.',
      'Amortisation is the whole game: a $5,200 tool is $20.80/unit at 250 units and $5.20 at 1,000.',
    ],
    source: 'woosourcing 2026: small simple part $1,500-$4,000 (18-25 days); medium $6,000-$18,000 (30-40 days)',
  },
  injection_molding_multicavity: {
    id: 'injection_molding_multicavity',
    label: 'Injection moulding (4-8 cavity production tool)',
    minWallMm: 1.5,
    minDraftDeg: 1,
    minFeatureMm: 1.0,
    toleranceMm: 0.1,
    maxOverhangDeg: 90,
    toolingUsd: [15000, 40000],
    leadTimeDays: [35, 60],
    moq: 5000,
    supportsOnVisibleSurfaces: false,
    costPerCm3: 0.02,
    floorPriceUsd: 0,
    setupPerOrderUsd: [100, 300],
    notes: [
      'Costs 2.5-3x a single cavity but cuts per-part moulding cost 50-70%.',
      'Payback under 12 months only above roughly 30,000-50,000 units per year.',
      'Do not order this before the design is frozen by a soft tool.',
    ],
    source: 'woosourcing 2026: multi-cavity $15,000-$40,000; payback rule of thumb',
  },
};

export const STEEL_SHOT_LIFE: Array<{ steel: string; shots: [number, number]; bestFor: string }> = [
  { steel: 'Aluminium (7075 / QC-10)', shots: [5000, 30000], bestFor: 'Prototypes, market tests' },
  { steel: 'P20 pre-hardened', shots: [100000, 300000], bestFor: 'General-purpose ABS/PP parts' },
  { steel: '718H / NAK80', shots: [300000, 600000], bestFor: 'Cosmetic parts, better polish' },
  { steel: 'H13 hardened', shots: [500000, 1000000], bestFor: 'High volume, abrasive resins' },
  { steel: 'S136 stainless', shots: [500000, 1000000], bestFor: 'Clear parts, PVC, medical, humid plants' },
];

/**
 * Quality of the final surface each process can produce, on a 1-5 scale.
 * Used by the feature-intent check: a visible face finished to 2/5 will read as
 * "looks nothing like the reference" even if every dimension is correct.
 */
export const SURFACE_QUALITY: Record<ProcessId, number> = {
  fdm: 2,
  resin_sla: 4,
  sls_mjf: 3,
  cnc_3axis: 5,
  sheet_metal: 4,
  soft_tool: 5,
  injection_molding: 5,
  injection_molding_multicavity: 5,
};
