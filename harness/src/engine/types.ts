/**
 * The spec schema.
 *
 * This is the moat described in RESEARCH.md section 8: a structured, parametric,
 * machine-checkable description of a physical product. A chat log is not a spec,
 * a STEP file with an email thread is not a spec, and neither can be verified.
 * Everything downstream - DFM checks, process selection, landed cost, the build
 * gates - reads this one shape.
 */

import type { ProcessId } from '../knowledge/processes.ts';

/** A face of the product, used for feature placement and cosmetic declarations. */
export type Face = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'internal';

export interface FeatureIntent {
  id: string;
  /** Human name: "face", "diffuser dome", "USB-C port", "power button". */
  label: string;
  /** Where the reference says this feature must be. */
  expectedFace: Face;
  /** Where the design actually put it. Undefined = not specified by the design. */
  actualFace?: Face;
  /** Is this feature present in the parts/operations at all? */
  present: boolean;
  /** Must be visible and finished to a high standard in the final object. */
  cosmetic: boolean;
  note?: string;
}

export interface PowerSpec {
  /** Line voltage anywhere inside the product. Forbidden in v1. */
  mainsInside: boolean;
  wireless: 'none' | 'bluetooth' | 'wifi' | 'lte' | 'custom';
  battery: 'none' | 'lithium' | 'alkaline';
  usbPowered: boolean;
  /** External power brick carries its own certification. */
  externalAdapterCertified?: boolean;
  /** True if a mains adapter is included in the box. That adapter needs a listing. */
  includesAdapter?: boolean;
  /**
   * True when the radio is a module certified and used as-is. Changes the filing
   * from a full intentional-radiator certification to the streamlined module path.
   */
  radioModulePrecertified?: boolean;
  maxWatts?: number;
}

export type PartKind = 'custom' | 'catalog';

export type Distributor = 'lcsc' | 'authorized' | 'broker' | 'unknown';

export type PartType =
  | 'mcu'
  | 'regulator'
  | 'analog_ic'
  | 'passive'
  | 'connector'
  | 'led'
  | 'motor'
  | 'sensor'
  | 'battery'
  | 'mechanical'
  | 'enclosure';

export interface CatalogSource {
  distributor: Distributor;
  mpn?: string;
  inStock?: boolean;
  /** Number of verified drop-in alternates. 0 means single-sourced. */
  alternates?: number;
  stockVerified?: boolean;
  partType?: PartType;
}

export interface Part {
  id: string;
  label: string;
  kind: PartKind;
  process: ProcessId;
  /** Key into MATERIALS, or a free-text material name. */
  material: string;
  qty: number;
  /** Bounding box, mm. The cost proxy uses this. */
  bboxMm: { x: number; y: number; z: number };
  /** Approximate solid fraction of the bounding box, 0-1. Defaults to 0.25. */
  solidFraction?: number;
  wallMm?: number;
  /** Thickest wall in the part. A large spread against `wallMm` pulls sink marks. */
  maxWallMm?: number;
  draftDeg?: number;
  toleranceMm?: number;
  /** Moulding only: a feature undercuts the tool, so it needs a slider or lifter. */
  hasUndercut?: boolean;
  /** Thread engagement depth available in a plastic boss, mm. */
  screwEngagementMm?: number;
  /** Faces of this part visible in the finished product. */
  visibleFaces?: Face[];
  /** CNC only: smallest internal corner radius, mm. */
  internalCornerRadiusMm?: number;
  /** Sheet metal only: closest hole-to-bend distance, mm. */
  holeToBendMm?: number;
  /** Standalone features, for the minimum-feature-size rule. */
  features?: Array<{ label: string; sizeMm: number; kind: 'hole' | 'rib' | 'boss' | 'slot' }>;
  /** Catalog parts only. */
  source?: CatalogSource;
  /** Bought-part price, USD. Used instead of the process model for catalog parts. */
  purchasePriceUsd?: number;
  /** Overhang angle from vertical, degrees. 90 = vertical wall, no support. */
  maxOverhangDeg?: number;
  /** Does this part need support material on a declared visible face? */
  supportsTouchVisibleFace?: boolean;
  notes?: string[];
}

export interface Interface {
  id: string;
  /** Part ids that must fit together. */
  between: [string, string];
  /** Nominal designed clearance, mm. */
  clearanceMm: number;
  /** Part ids whose tolerances contribute to this interface. */
  contributors: string[];
}

export type SignalKind =
  | 'power'
  | 'gnd'
  | 'i2c'
  | 'spi'
  | 'uart'
  | 'usb'
  | 'gpio'
  | 'analog'
  | 'rf'
  | 'other';

/** One end of a net: a part, and optionally the pin on it. */
export interface NetEndpoint {
  part: string;
  /** Pin / designator, e.g. "GPIO4", "VCC", "D+". Free text. */
  pin?: string;
}

/**
 * An electrical connection: one net, two or more endpoints. This is what makes
 * wiring CHECKABLE - interfaces say what must fit, nets say what must connect.
 */
export interface Net {
  id: string;
  /** Human net name: "3V3_RAIL", "I2C_SDA", "USB_DP". */
  name: string;
  signal: SignalKind;
  endpoints: NetEndpoint[];
  /** For power nets, volts. */
  voltage?: number;
  note?: string;
}

export interface Operation {
  id: string;
  label: string;
  minutes: number;
  /** Filing, bending, epoxy-as-structure, making a fixture. Any of these fails a gate. */
  improvised: boolean;
  requiresSoldering?: boolean;
  wireCount?: number;
}

export type Market = 'us' | 'eu' | 'uk' | 'ca';

export interface ProductSpec {
  id: string;
  name: string;
  /** One sentence: what this object is for. */
  intent: string;
  /** Description of the reference render this was generated from. */
  referenceRender?: string;
  targetRetailUsd?: number;
  /** Quantities to cost, e.g. [1, 100, 1000]. */
  targetQuantities: number[];
  origin: 'china' | 'domestic' | 'other';
  /** Where it will be sold. This - not the sourcing country - drives CE/GPSR/ISED. */
  markets?: Market[];
  /**
   * Who the product is for. Children's products trigger CPSIA testing, and the
   * render-driven category has a habit of producing cute objects that legally count as toys.
   */
  audience?: 'adult' | 'general' | 'children';
  power: PowerSpec;
  features: FeatureIntent[];
  parts: Part[];
  interfaces: Interface[];
  /** Electrical connections. Absent = the wiring is declared nowhere. */
  nets?: Net[];
  operations: Operation[];
  /** Certification ids the designer has already accounted for. */
  certificationsBudgeted?: string[];
  /**
   * USB audio/HID class device that needs an OS-signed driver.
   * Costs $500-1,000 one-off and appears in no generated BOM.
   */
  requiresSignedDrivers?: boolean;
  /** True if the cost was published alongside the design. */
  costDisclosed?: boolean;
  /**
   * Firmware readiness. Reported separately because "does it work" splits into two
   * claims: the board works, and the software works.
   */
  firmware?: {
    provided?: boolean;
    language?: string;
    toolchain?: string;
    /** Has it ever compiled? */
    builds?: boolean;
    /** Has it run on real hardware? */
    testedOnHardware?: boolean;
    /** Does the firmware's pin map match the board's footprints? */
    pinMapMatchesFootprints?: boolean;
    /** Are library and SDK versions pinned? */
    dependenciesPinned?: boolean;
    linesApprox?: number;
    notes?: string[];
  };
  /** CAD hygiene - the LuxoBench "no manual repair" gate. */
  cad?: {
    opensClean?: boolean;
    watertight?: boolean;
    requiresManualRepair?: boolean;
    ercClean?: boolean;
    drcClean?: boolean;
  };
  /** Set when the design was produced by a model; used for the scorecard header. */
  producedBy?: string;
  /** Free-form provenance: URL, date, notes. */
  provenance?: string;
}

export function partVolumeCm3(part: Part): number {
  const frac = part.solidFraction ?? 0.25;
  return (part.bboxMm.x * part.bboxMm.y * part.bboxMm.z) / 1000 * frac;
}

export function totalPartCount(spec: ProductSpec): number {
  return spec.parts.reduce((n, p) => n + p.qty, 0);
}
