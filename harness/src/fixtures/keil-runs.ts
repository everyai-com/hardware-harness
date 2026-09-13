/**
 * Reconstructions of the two designs from the first live LuxoBench run (12 Sep 2026),
 * plus nim's DJ controller for contrast.
 *
 * IMPORTANT: these are reconstructions from the public descriptions, not the authors'
 * actual BOMs - neither has been published. Part lists, dimensions and tolerances are
 * plausible stand-ins chosen so the harness can be exercised against the failures that
 * were publicly reported. Replace `parts` with the real BOM when it lands; the checks
 * and the scoring will not change.
 *
 * Public description of the run, verbatim:
 *   "Astra's design is simple, but strange - the 'face' is on the back of the base.
 *    On the positive side, it has way fewer parts and therefore will be easier to build
 *    once the parts get here. Fable's design is more ambitious, and closer to the
 *    reference design. The build instructions are clear, though, so it seems buildable.
 *    ... Ordered both sets of parts last night"  - @pronounced_kyle
 */

import type { ProductSpec, Part, PartType } from '../engine/types.ts';
import { LAMP_REFERENCE_FEATURES } from './lamp.ts';
import { BLUEPRINT_VOICE_NOTE } from './blueprint-voice-note.ts';
import { VOICE_NOTE_FIXED } from './voice-note-fixed.ts';

const RECONSTRUCTION_NOTE = 'Reconstructed from the public description of the 12 Sep 2026 run; not the author\'s actual BOM.';

function catalogPart(
  id: string,
  label: string,
  partType: PartType,
  distributor: 'lcsc' | 'authorized' | 'broker',
  mpn: string,
  alternates: number,
  priceUsd: number,
  notes: string[] = [],
): Part {
  return {
    id,
    label,
    kind: 'catalog',
    process: 'fdm',
    material: 'n/a',
    qty: 1,
    bboxMm: { x: 40, y: 40, z: 10 },
    solidFraction: 0.2,
    purchasePriceUsd: priceUsd,
    source: { distributor, mpn, inStock: true, stockVerified: true, alternates, partType },
    notes,
  };
}

/** Astra: fewer parts, faster to build, face on the wrong side. */
export const ASTRA_LAMP: ProductSpec = {
  id: 'lamp-astra',
  name: 'Cube lamp - Astra design',
  intent: 'Simplified cube lamp: single-piece base, printed diffuser, prebuilt LED module.',
  targetRetailUsd: 69,
  targetQuantities: [1, 100, 1000],
  origin: 'china',
  markets: ['us'],
  power: { mainsInside: false, wireless: 'none', battery: 'none', usbPowered: true, externalAdapterCertified: true, maxWatts: 3 },
  features: [
    // The reported defect: the face ended up on the back.
    { id: 'face', label: 'Printed face (eyes + smile)', expectedFace: 'front', actualFace: 'back', present: true, cosmetic: true, note: 'Reported: "the face is on the back of the base"' },
    { id: 'dome', label: 'Translucent diffuser dome', expectedFace: 'top', actualFace: 'top', present: true, cosmetic: true },
    { id: 'power', label: 'Power / brightness control', expectedFace: 'top', actualFace: 'top', present: true, cosmetic: false },
    { id: 'usb', label: 'USB-C power inlet', expectedFace: 'back', actualFace: 'back', present: true, cosmetic: false },
    { id: 'feet', label: 'Non-slip feet', expectedFace: 'bottom', actualFace: 'bottom', present: true, cosmetic: false },
  ],
  parts: [
    {
      id: 'base',
      label: 'Base shell (face printed on it)',
      kind: 'custom',
      process: 'fdm',
      material: 'petg',
      qty: 1,
      bboxMm: { x: 90, y: 90, z: 60 },
      solidFraction: 0.22,
      wallMm: 1.8,
      toleranceMm: 0.5,
      visibleFaces: ['front', 'back', 'left', 'right', 'top'],
      maxOverhangDeg: 45,
      features: [{ label: 'USB-C cutout', sizeMm: 9, kind: 'slot' }],
    },
    {
      id: 'dome',
      label: 'Diffuser dome',
      kind: 'custom',
      process: 'fdm',
      material: 'petg',
      qty: 1,
      bboxMm: { x: 80, y: 80, z: 90 },
      solidFraction: 0.12,
      wallMm: 1.6,
      toleranceMm: 0.5,
      visibleFaces: ['front', 'back', 'left', 'right', 'top'],
      maxOverhangDeg: 45,
    },
    catalogPart('led', 'Prebuilt LED module (USB-powered)', 'led', 'lcsc', 'LCSC-C2843560', 3, 3.2),
    catalogPart('usbc', 'USB-C power breakout board', 'connector', 'lcsc', 'LCSC-C2765186', 2, 1.8),
    { ...catalogPart('feet', 'Adhesive silicone feet', 'mechanical', 'lcsc', 'LCSC-C2835692', 4, 0.15), qty: 4 },
  ],
  interfaces: [
    { id: 'dome-base', between: ['dome', 'base'], clearanceMm: 1.2, contributors: ['dome', 'base'] },
  ],
  operations: [
    { id: 'op-print', label: 'Print base and dome', minutes: 2, improvised: false },
    { id: 'op-fit', label: 'Press dome onto base', minutes: 1, improvised: false },
    { id: 'op-led', label: 'Connect LED module to USB-C board, no soldering (prebuilt connectors)', minutes: 4, improvised: false, wireCount: 2 },
    { id: 'op-feet', label: 'Apply 4 adhesive feet', minutes: 3, improvised: false },
  ],
  certificationsBudgeted: ['fcc_unintentional'],
  costDisclosed: false,
  firmware: {
    provided: true,
    language: 'C++ (Arduino framework)',
    toolchain: 'PlatformIO',
    builds: true,
    testedOnHardware: false,
    pinMapMatchesFootprints: true,
    dependenciesPinned: true,
    notes: ['Reported as delivered, but never flashed - no hardware has arrived yet.'],
  },
  cad: { opensClean: true, watertight: true, requiresManualRepair: false, ercClean: true, drcClean: true },
  producedBy: 'GPT-6 Astra',
  provenance: RECONSTRUCTION_NOTE,
};

/** Fable 5.1: closer to the reference, more parts, thinner walls. */
export const FABLE_LAMP: ProductSpec = {
  id: 'lamp-fable',
  name: 'Cube lamp - Fable 5.1 design',
  intent: 'Faithful cube lamp: two-part base shell, resin diffuser, captive light guide, touch control.',
  targetRetailUsd: 69,
  targetQuantities: [1, 100, 1000],
  origin: 'china',
  markets: ['us'],
  power: { mainsInside: false, wireless: 'none', battery: 'none', usbPowered: true, externalAdapterCertified: true, maxWatts: 5 },
  features: LAMP_REFERENCE_FEATURES.map((f) => ({
    ...f,
    actualFace: f.expectedFace,
    note: 'Design reported as "closer to the reference design"',
  })),
  parts: [
    {
      id: 'base_upper',
      label: 'Base shell, upper half',
      kind: 'custom',
      process: 'fdm',
      material: 'petg',
      qty: 1,
      bboxMm: { x: 92, y: 92, z: 35 },
      solidFraction: 0.2,
      wallMm: 1.6,
      toleranceMm: 0.3,
      visibleFaces: ['front', 'back', 'left', 'right', 'top'],
      features: [{ label: 'Tolerance lip', sizeMm: 2, kind: 'rib' }],
    },
    {
      id: 'base_lower',
      label: 'Base shell, lower half',
      kind: 'custom',
      process: 'fdm',
      material: 'petg',
      qty: 1,
      bboxMm: { x: 92, y: 92, z: 25 },
      solidFraction: 0.2,
      wallMm: 1.6,
      toleranceMm: 0.3,
      visibleFaces: ['front', 'back', 'left', 'right', 'bottom'],
    },
    {
      id: 'dome',
      label: 'Diffuser dome (thin, closely matches render)',
      kind: 'custom',
      process: 'fdm',
      material: 'petg',
      qty: 1,
      bboxMm: { x: 84, y: 84, z: 95 },
      solidFraction: 0.1,
      // Chosen to match the soft, thin-walled look of the reference render.
      wallMm: 0.9,
      toleranceMm: 0.5,
      visibleFaces: ['front', 'back', 'left', 'right', 'top'],
      maxOverhangDeg: 45,
    },
    {
      id: 'light_guide',
      label: 'Light guide ring',
      kind: 'custom',
      process: 'resin_sla',
      material: 'pmma',
      qty: 1,
      bboxMm: { x: 70, y: 70, z: 8 },
      solidFraction: 0.3,
      wallMm: 1.2,
      toleranceMm: 0.2,
      visibleFaces: ['top'],
    },
    {
      id: 'bracket',
      label: 'Internal LED bracket',
      kind: 'custom',
      process: 'fdm',
      material: 'petg',
      qty: 1,
      bboxMm: { x: 60, y: 60, z: 15 },
      solidFraction: 0.25,
      wallMm: 1.4,
      toleranceMm: 0.4,
      visibleFaces: [],
    },
    {
      id: 'touch_cap',
      label: 'Touch control cap',
      kind: 'custom',
      process: 'resin_sla',
      material: 'pmma',
      qty: 1,
      bboxMm: { x: 18, y: 18, z: 6 },
      solidFraction: 0.4,
      wallMm: 1.2,
      toleranceMm: 0.2,
      visibleFaces: ['top'],
    },
    catalogPart('led', 'LED module', 'led', 'lcsc', 'LCSC-C2843560', 3, 3.2),
    catalogPart('touch', 'Capacitive touch controller', 'mcu', 'lcsc', 'LCSC-C16581', 0, 1.4, ['MCU-class part sourced from a non-franchised channel']),
    catalogPart('usbc', 'USB-C receptacle board', 'connector', 'lcsc', 'LCSC-C2765186', 2, 1.8),
    { ...catalogPart('screw', 'M3 x 8 self-tapping screw', 'mechanical', 'lcsc', 'LCSC-C2864071', 5, 0.05), qty: 4 },
    { ...catalogPart('foot', 'Silicone foot', 'mechanical', 'lcsc', 'LCSC-C2835692', 4, 0.15), qty: 4 },
  ],
  interfaces: [
    {
      id: 'base-halves',
      between: ['base_upper', 'base_lower'],
      clearanceMm: 0.6,
      contributors: ['base_upper', 'base_lower'],
    },
    { id: 'dome-upper', between: ['dome', 'base_upper'], clearanceMm: 1.0, contributors: ['dome', 'base_upper'] },
  ],
  operations: [
    { id: 'op-print', label: 'Print base halves, dome and bracket', minutes: 3, improvised: false },
    { id: 'op-deburr', label: 'Deburr and file the dome seam to fit', minutes: 8, improvised: true },
    { id: 'op-lightguide', label: 'Seat light guide and bracket', minutes: 4, improvised: false },
    { id: 'op-screws', label: 'Drive 4 screws', minutes: 6, improvised: false },
    { id: 'op-touch', label: 'Wire touch board to LED driver', minutes: 7, improvised: false, wireCount: 3 },
    { id: 'op-feet', label: 'Fit 4 feet', minutes: 4, improvised: false },
  ],
  certificationsBudgeted: ['fcc_unintentional'],
  costDisclosed: false,
  firmware: {
    provided: true,
    language: 'C++ (Arduino framework)',
    toolchain: 'PlatformIO',
    builds: true,
    testedOnHardware: false,
    // The more ambitious design references a touch pin the board does not expose.
    pinMapMatchesFootprints: false,
    dependenciesPinned: true,
    notes: ['More parts and more peripherals means more pin-map surface for the two artifacts to disagree on.'],
  },
  cad: { opensClean: true, watertight: true, requiresManualRepair: false, ercClean: true, drcClean: true },
  producedBy: 'Claude Fable 5.1',
  provenance: RECONSTRUCTION_NOTE,
};

/**
 * nim's mini DJ controller (10 Sep 2026) - included for contrast because it shows the
 * cost line nobody models. The public description states the design deliberately used
 * prebuilt parts with minimal soldering.
 */
export const DJ_CONTROLLER: ProductSpec = {
  id: 'dj-controller',
  name: 'Mini DJ controller (public demo)',
  intent: 'Teenage Engineering-style pocket DJ controller, USB-powered, prebuilt modules.',
  targetRetailUsd: 220,
  targetQuantities: [1, 100, 1000],
  origin: 'china',
  markets: ['us'],
  power: { mainsInside: false, wireless: 'none', battery: 'none', usbPowered: true, externalAdapterCertified: true, maxWatts: 5 },
  features: [
    { id: 'jog', label: 'Rotary jog wheels', expectedFace: 'top', actualFace: 'top', present: true, cosmetic: true },
    { id: 'faders', label: 'Faders and knobs', expectedFace: 'top', actualFace: 'top', present: true, cosmetic: true },
    { id: 'usb', label: 'USB-C port', expectedFace: 'back', actualFace: 'back', present: true, cosmetic: false },
  ],
  parts: [
    { id: 'enclosure_top', label: 'Enclosure top', kind: 'custom', process: 'fdm', material: 'petg', qty: 1, bboxMm: { x: 180, y: 110, z: 12 }, solidFraction: 0.2, wallMm: 1.6, toleranceMm: 0.5, visibleFaces: ['top', 'front', 'left', 'right'] },
    { id: 'enclosure_bottom', label: 'Enclosure bottom', kind: 'custom', process: 'fdm', material: 'petg', qty: 1, bboxMm: { x: 180, y: 110, z: 20 }, solidFraction: 0.22, wallMm: 1.6, toleranceMm: 0.5, visibleFaces: ['bottom'] },
    // The engineer-identified detail: a 2804 hollow-shaft brushless motor per jog wheel.
    { id: 'motor', label: '2804 hollow-shaft brushless motor', kind: 'catalog', process: 'fdm', material: 'n/a', qty: 2, bboxMm: { x: 28, y: 28, z: 12 }, solidFraction: 0.5, toleranceMm: 0.1, purchasePriceUsd: 12, source: { distributor: 'lcsc', mpn: '2804-BL-HOLLOW', inStock: true, stockVerified: true, alternates: 1, partType: 'motor' } },
    catalogPart('mcu', 'Audio/MCU module (Pi-class)', 'mcu', 'lcsc', 'LCSC-C2040', 0, 24, ['Non-franchised channel for an MCU-class part']),
    catalogPart('dac', 'Cirrus internal DAC and mixer', 'analog_ic', 'authorized', 'CS42L42', 1, 12),
    catalogPart('adc', 'TI ADC', 'analog_ic', 'authorized', 'PCM1808', 1, 3),
    catalogPart('usbpd', 'USB-C PD controller', 'regulator', 'lcsc', 'LCSC-C2835409', 2, 1.5),
    catalogPart('usbio', 'USB IO controller', 'mcu', 'authorized', 'CY7C65211', 1, 6),
    { ...catalogPart('knob', 'Knob', 'mechanical', 'lcsc', 'LCSC-C2884690', 3, 0.8), qty: 6 },
    { ...catalogPart('fader', 'Fader', 'mechanical', 'lcsc', 'LCSC-C2929189', 2, 2.2), qty: 2 },
    { ...catalogPart('screw', 'M2.5 screw', 'mechanical', 'lcsc', 'LCSC-C2864071', 3, 0.04), qty: 8 },
  ],
  interfaces: [
    { id: 'case-halves', between: ['enclosure_top', 'enclosure_bottom'], clearanceMm: 0.6, contributors: ['enclosure_top', 'enclosure_bottom'] },
    { id: 'motor-mount', between: ['motor', 'enclosure_top'], clearanceMm: 0.25, contributors: ['motor', 'enclosure_top'] },
  ],
  operations: [
    { id: 'op-print', label: 'Print enclosure halves', minutes: 4, improvised: false },
    { id: 'op-mount', label: 'Mount motors, knobs and faders', minutes: 25, improvised: false },
    { id: 'op-wire', label: 'Connect modules (prebuilt, minimal soldering)', minutes: 20, improvised: false, wireCount: 8 },
    { id: 'op-screws', label: 'Assemble case, 8 screws', minutes: 12, improvised: false },
  ],
  certificationsBudgeted: ['fcc_unintentional'],
  // The public thread's practitioner BOM breakdown: signed low-latency audio drivers run $500-1,000.
  requiresSignedDrivers: true,
  firmware: {
    provided: true,
    language: 'C++',
    builds: false,
    testedOnHardware: false,
    pinMapMatchesFootprints: true,
    dependenciesPinned: false,
    notes: ['Community reports: "the pcbs had a lot of errors so i ended up breadboarding it".'],
  },
  costDisclosed: false,
  cad: { opensClean: true, watertight: true, requiresManualRepair: false, ercClean: true, drcClean: true },
  producedBy: 'GPT-6 Astra',
  provenance: 'Reconstruction from the public thread; community BOM estimate from @alexflorias. Not the author\'s actual BOM.',
};

export const FIXTURES: ProductSpec[] = [ASTRA_LAMP, FABLE_LAMP, DJ_CONTROLLER, BLUEPRINT_VOICE_NOTE, VOICE_NOTE_FIXED];
