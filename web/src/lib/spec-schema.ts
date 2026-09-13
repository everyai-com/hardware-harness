import { z } from "zod";

/**
 * Zod mirror of the harness ProductSpec (harness/src/engine/types.ts).
 * The AI generator must produce JSON that passes this schema before the
 * engine ever sees it. Keep in sync with the engine.
 *
 * LLM-tolerant by design: numbers may arrive as strings ("1"), enums may
 * arrive with different casing ("FDM"), and `power` may be omitted entirely.
 */

export const FACES = ["front", "back", "left", "right", "top", "bottom", "internal"] as const;
export const PROCESSES = [
  "fdm",
  "resin_sla",
  "sls_mjf",
  "cnc_3axis",
  "sheet_metal",
  "pcb_assembly",
  "soft_tool",
  "injection_molding",
] as const;
export const PART_TYPES = [
  "mcu",
  "regulator",
  "analog_ic",
  "passive",
  "connector",
  "led",
  "motor",
  "sensor",
  "battery",
  "mechanical",
  "enclosure",
] as const;
export const DISTRIBUTORS = ["lcsc", "authorized", "broker", "unknown"] as const;
export const WIRELESS = ["none", "bluetooth", "wifi", "lte", "custom"] as const;
export const BATTERY = ["none", "lithium", "alkaline"] as const;

const num = z.coerce.number();
const int = z.coerce.number().int();
/** Accepts any casing and surrounding whitespace for enum values. */
function lcEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase().replaceAll(" ", "_") : v),
    z.enum(values),
  );
}

/** Common synonyms the model emits, mapped onto the harness's part types. */
const PART_TYPE_SYNONYMS: Record<string, string> = {
  speaker: "motor",
  driver: "motor",
  buzzer: "motor",
  transducer: "motor",
  display: "sensor",
  screen: "sensor",
  button: "mechanical",
  switch: "mechanical",
  knob: "mechanical",
  fastener: "mechanical",
  frame: "mechanical",
};

/** Marketplace names are broker channels; franchise distributors are authorized. */
const DISTRIBUTOR_SYNONYMS: Record<string, string> = {
  aliexpress: "broker",
  ebay: "broker",
  amazon: "broker",
  marketplace: "broker",
  mouser: "authorized",
  digikey: "authorized",
  "digi-key": "authorized",
  arrow: "authorized",
  avnet: "authorized",
  jlcpcb: "lcsc",
  jlc: "lcsc",
};

function withSynonyms(map: Record<string, string>) {
  return (v: unknown) => {
    if (typeof v !== "string") return v;
    const key = v.trim().toLowerCase().replaceAll(" ", "_");
    return map[key] ?? key;
  };
}

const bboxSchema = z.object({
  x: num.positive(),
  y: num.positive(),
  z: num.positive(),
});

/** Models omit the package size on bought parts; the freight proxy needs something sane. */
const DEFAULT_CATALOG_BBOX = { x: 20, y: 20, z: 10 };

const catalogSourceSchema = z.object({
  distributor: z.preprocess(withSynonyms(DISTRIBUTOR_SYNONYMS), lcEnum(DISTRIBUTORS)),
  mpn: z.string().min(2).optional(),
  inStock: z.boolean().optional(),
  alternates: int.nonnegative().optional(),
  stockVerified: z.boolean().optional(),
  partType: z.preprocess(withSynonyms(PART_TYPE_SYNONYMS), lcEnum(PART_TYPES).optional()),
});

const partSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: lcEnum(["custom", "catalog"]).default("custom"),
  process: lcEnum(PROCESSES),
  material: z.string().min(1),
  qty: int.positive(),
  bboxMm: bboxSchema.default(DEFAULT_CATALOG_BBOX),
  solidFraction: num.min(0.01).max(1).optional(),
  wallMm: num.positive().optional(),
  draftDeg: num.optional(),
  toleranceMm: num.positive().optional(),
  visibleFaces: z.array(lcEnum(FACES)).optional(),
  internalCornerRadiusMm: num.positive().optional(),
  holeToBendMm: num.positive().optional(),
  features: z
    .array(
      z.object({
        label: z.string().min(1),
        sizeMm: num.positive(),
        kind: lcEnum(["hole", "rib", "boss", "slot"]),
      }),
    )
    .optional(),
  maxOverhangDeg: num.optional(),
  supportsTouchVisibleFace: z.boolean().optional(),
  source: catalogSourceSchema.optional(),
  purchasePriceUsd: num.nonnegative().optional(),
  notes: z.array(z.string()).optional(),
});

const featureIntentSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  expectedFace: lcEnum(FACES),
  actualFace: lcEnum(FACES).optional(),
  present: z.boolean().default(true),
  cosmetic: z.boolean().default(false),
  note: z.string().optional(),
});

const operationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  minutes: num.nonnegative(),
  improvised: z.boolean().default(false),
  requiresSoldering: z.boolean().optional(),
  wireCount: int.nonnegative().optional(),
});

const interfaceSchema = z.object({
  id: z.string().min(1),
  between: z.tuple([z.string(), z.string()]),
  clearanceMm: num.nonnegative(),
  contributors: z.array(z.string()).default([]),
});

const SIGNALS = ["power", "gnd", "i2c", "spi", "uart", "usb", "gpio", "analog", "rf", "other"] as const;

const netEndpointSchema = z.object({
  part: z.string().min(1),
  pin: z.string().optional(),
});

const netSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  signal: lcEnum(SIGNALS).default("other"),
  endpoints: z.array(netEndpointSchema).min(2),
  voltage: num.positive().optional(),
  note: z.string().optional(),
});

const powerSchema = z.object({
  mainsInside: z.boolean().default(false),
  wireless: lcEnum(WIRELESS).default("none"),
  battery: lcEnum(BATTERY).default("none"),
  usbPowered: z.boolean().default(false),
  externalAdapterCertified: z.boolean().optional(),
  includesAdapter: z.boolean().optional(),
  maxWatts: num.positive().optional(),
});

const firmwareSchema = z.object({
  provided: z.boolean().optional(),
  language: z.string().optional(),
  toolchain: z.string().optional(),
  builds: z.boolean().optional(),
  testedOnHardware: z.boolean().optional(),
  pinMapMatchesFootprints: z.boolean().optional(),
  dependenciesPinned: z.boolean().optional(),
  linesApprox: int.nonnegative().optional(),
  notes: z.array(z.string()).optional(),
});

const cadSchema = z.object({
  opensClean: z.boolean().optional(),
  watertight: z.boolean().optional(),
  requiresManualRepair: z.boolean().optional(),
  ercClean: z.boolean().optional(),
  drcClean: z.boolean().optional(),
});

export const specSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  intent: z.string().min(1),
  referenceRender: z.string().optional(),
  targetRetailUsd: num.positive().optional(),
  targetQuantities: z.array(int.positive()).nonempty().default([1, 100, 1000]),
  origin: lcEnum(["china", "domestic", "other"]).default("china"),
  markets: z.array(lcEnum(["us", "eu", "uk", "ca"])).optional(),
  power: powerSchema.default({
    mainsInside: false,
    wireless: "none",
    battery: "none",
    usbPowered: false,
  }),
  features: z.array(featureIntentSchema).default([]),
  parts: z.array(partSchema).min(1),
  interfaces: z.array(interfaceSchema).default([]),
  nets: z.array(netSchema).optional(),
  operations: z.array(operationSchema).min(1),
  certificationsBudgeted: z.array(z.string()).optional(),
  requiresSignedDrivers: z.boolean().optional(),
  costDisclosed: z.boolean().optional(),
  firmware: firmwareSchema.optional(),
  cad: cadSchema.optional(),
  producedBy: z.string().optional(),
  provenance: z.string().optional(),
});

export type SpecInput = z.infer<typeof specSchema>;
