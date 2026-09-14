/**
 * Fixture 1: the cube lamp.
 *
 * The reference is the render Keil's benchmark starts from (LUXOBENCH.md section 5):
 * a rounded translucent dome glowing on a white, subtly filleted base with a printed
 * face. Everything here is the acceptance criteria for that object, expressed as data.
 */

import type { ProductSpec, FeatureIntent } from '../engine/types.ts';
import { ASSEMBLY_MINUTE_BUDGET, PART_COUNT_BUDGET } from '../engine/dfm-check.ts';

/**
 * The reference render's feature set. This is what "made real and manufacturable"
 * has to conform to - including which way each feature faces. The face-on-the-front
 * check is here because that is exactly what the first live run got wrong.
 */
export const LAMP_REFERENCE_FEATURES: FeatureIntent[] = [
  { id: 'face', label: 'Printed face (eyes + smile)', expectedFace: 'front', present: true, cosmetic: true },
  { id: 'dome', label: 'Translucent diffuser dome', expectedFace: 'top', present: true, cosmetic: true },
  { id: 'power', label: 'Power / brightness control', expectedFace: 'top', present: true, cosmetic: false },
  { id: 'usb', label: 'USB-C power inlet', expectedFace: 'back', present: true, cosmetic: false },
  { id: 'feet', label: 'Non-slip feet', expectedFace: 'bottom', present: true, cosmetic: false },
];

/**
 * The fixture-1 acceptance criteria.
 *
 * Split by how each one can be checked, because claiming a criterion the engine
 * cannot evaluate would make the whole scorecard a claim rather than a test:
 *   - `enforcedBy`: the gates and rules that check it from a spec.
 *   - `measuredInBuild`: a physical build produces this number. No spec can.
 *
 * The budgets are imported from the engine so there is exactly one number in the
 * project for "part count budget" and "assembly minute budget".
 */
export const LAMP_ACCEPTANCE_CRITERIA = {
  enforcedBy: {
    /** G4, MAINS_INSIDE_PRODUCT, LITHIUM_CELL */
    electrical: {
      usbVoltage: 5,
      maxWatts: 5,
      inputProtectionRequired: true,
      mainsInsideProduct: false,
      battery: 'none' as const,
    },
    /** G5, PART_COUNT_HIGH */
    manufacturing: {
      supportsOnVisibleSurfacesAllowed: false,
      minDraftDegIfMoulded: 1,
      minWallMmIfMoulded: 1.5,
      printBedMm: 180,
      maxPrintHoursPerPart: 8,
      maxParts: PART_COUNT_BUDGET,
      maxStandardFasteners: 4,
    },
    /** G6, ASSEMBLY_TIME_HIGH, IMPROVISED_OPERATION. The minute budget is the engine's. */
    assembly: {
      maxMinutes: ASSEMBLY_MINUTE_BUDGET,
      maxSolderedJointsOrPrebuiltModulesOnly: 4,
      epoxyAllowed: false,
      customToolsAllowed: false,
    },
    /** G9, FEATURE_MISPLACED - the face-on-the-back check. */
    featureIntent: {
      features: LAMP_REFERENCE_FEATURES.map((f) => `${f.label} -> ${f.expectedFace}`),
    },
  },
  /** Only a build can answer these. They are the receipt, and they are why the receipt matters. */
  measuredInBuild: {
    optical: {
      minLuxAt300mm: 150,
      ledHotspotVisible: false,
      evenDiffusionRequired: true,
    },
    thermal: {
      maxSurfaceTempCAfter4h: 45,
    },
    interaction: {
      touchThroughWallMm: 2,
      brightnessLevels: 3,
      debouncedInFirmware: true,
      recoverableByUnplug: true,
    },
    mechanical: {
      domePullOffMinN: 5,
      dropTestHeightM: 1,
      dropTestOrientations: 3,
      visibleFastenersOnFace: false,
    },
  },
  /** The estimate these criteria are checked against. */
  cost: {
    targetRetailUsd: 69,
    expectedLanded: { qty1: [35, 50], qty100: [18, 25], qty1000: [10, 14] },
  },
  source: 'LUXOBENCH.md section 5, derived from the reference render and the reply-thread critiques',
};

/** A shell for the fixture that a designer fills in with their own parts list. */
export function emptyLampSpec(producedBy: string): ProductSpec {
  return {
    id: 'lamp',
    name: 'Cube lamp',
    intent: 'A small USB-C desk lamp with a glowing dome diffuser and a printed face on the base.',
    referenceRender: 'Rounded translucent dome on a white filleted base, printed face on the front, USB-C at the back.',
    targetRetailUsd: LAMP_ACCEPTANCE_CRITERIA.cost.targetRetailUsd,
    targetQuantities: [1, 100, 1000],
    origin: 'china',
    power: {
      mainsInside: false,
      wireless: 'none',
      battery: 'none',
      usbPowered: true,
      externalAdapterCertified: true,
      maxWatts: 5,
    },
    features: LAMP_REFERENCE_FEATURES.map((f) => ({ ...f })),
    parts: [],
    interfaces: [],
    operations: [],
    certificationsBudgeted: ['fcc_unintentional'],
    producedBy,
  };
}
