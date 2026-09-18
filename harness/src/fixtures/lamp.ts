/**
 * Fixture 1: the cube lamp.
 *
 * The reference is the render Keil's benchmark starts from (LUXOBENCH.md section 5):
 * a rounded translucent dome glowing on a white, subtly filleted base with a printed
 * face. Everything here is the acceptance criteria for that object, expressed as data.
 */

import type { ProductSpec, FeatureIntent } from '../engine/types.ts';

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

export const LAMP_ACCEPTANCE_CRITERIA = {
  optical: {
    minLuxAt300mm: 150,
    ledHotspotVisible: false,
    evenDiffusionRequired: true,
  },
  thermal: {
    maxSurfaceTempCAfter4h: 45,
  },
  electrical: {
    usbVoltage: 5,
    maxWatts: 5,
    inputProtectionRequired: true,
    mainsInsideProduct: false,
    battery: 'none' as const,
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
  manufacturing: {
    printBedMm: 180,
    maxPrintHoursPerPart: 8,
    supportsOnVisibleSurfacesAllowed: false,
    minDraftDegIfMoulded: 1,
    minWallMmIfMoulded: 1.5,
    maxParts: 15,
    maxStandardFasteners: 4,
  },
  cost: {
    targetRetailUsd: 69,
    expectedLanded: { qty1: [35, 50], qty100: [18, 25], qty1000: [10, 14] },
  },
  assembly: {
    maxMinutes: 20,
    maxSolderedJointsOrPrebuiltModulesOnly: 4,
    epoxyAllowed: false,
    customToolsAllowed: false,
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
    dropTest: {
      heightM: LAMP_ACCEPTANCE_CRITERIA.mechanical.dropTestHeightM,
      orientations: LAMP_ACCEPTANCE_CRITERIA.mechanical.dropTestOrientations,
    },
    producedBy,
  };
}
