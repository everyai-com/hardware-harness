/**
 * A Muse Gadget reference design - the first fixture that passes every gate.
 *
 * The architecture is the SDK's own: one supported board carries the screen,
 * audio, radio and enclosure mounting, and the product around it is the shell
 * and the software. The harness verifies the claim against the SDK's published
 * board matrix: supported board, ESP-IDF v6.0.1 toolchain, every asked
 * capability present on that board - and nothing invented.
 *
 * The remaining unverifiable claim is the honest one: flashed, paired and
 * working on a desk. That closes only with the physical build.
 */

import type { ProductSpec, Part } from '../engine/types.ts';

function bought(
  id: string,
  label: string,
  partType: 'mcu' | 'mechanical',
  qty: number,
  unitPriceUsd: number,
  distributor: 'lcsc' | 'authorized',
  mpn: string,
  note: string,
): Part {
  return {
    id,
    label,
    kind: 'catalog',
    process: 'pcb_assembly',
    material: 'n/a',
    qty,
    bboxMm: partType === 'mcu' ? { x: 44, y: 44, z: 12 } : { x: 3, y: 3, z: 6 },
    solidFraction: 0.35,
    purchasePriceUsd: unitPriceUsd,
    source: { distributor, mpn, inStock: true, stockVerified: true, alternates: 2, partType },
    notes: [note],
  };
}

export const MUSE_DESK_COMPANION: ProductSpec = {
  id: 'muse-desk-companion',
  name: 'Muse desk companion - round AMOLED',
  intent:
    'A round-screened desk gadget that pairs with Muse: voice notes in, answers and images on the screen, all on one board the SDK already supports.',
  referenceRender: 'Slim round desk puck with a 1.75-inch AMOLED face, fabric-wrapped side, single talk button on top.',
  targetRetailUsd: 129,
  targetQuantities: [1, 100, 1000],
  origin: 'china',
  markets: ['us'],
  target: {
    platform: 'muse-gadgets',
    sdk: 'esp32',
    board: 'waveshare-esp32-s3-touch-amoled-1.75',
    capabilities: ['display', 'images', 'ui', 'touch', 'audio', 'push_to_talk', 'tunnel', 'ota'],
  },
  power: {
    mainsInside: false,
    wireless: 'wifi',
    battery: 'none',
    usbPowered: true,
    externalAdapterCertified: false,
    includesAdapter: false,
    maxWatts: 10,
  },
  features: [
    { id: 'screen', label: 'Round AMOLED face', expectedFace: 'front', actualFace: 'front', present: true, cosmetic: true },
    { id: 'button', label: 'Push-to-talk button', expectedFace: 'top', actualFace: 'top', present: true, cosmetic: true },
    { id: 'speaker', label: 'Speaker grille', expectedFace: 'front', actualFace: 'front', present: true, cosmetic: false },
    { id: 'usb', label: 'USB-C port', expectedFace: 'back', actualFace: 'back', present: true, cosmetic: false },
  ],
  parts: [
    bought(
      'amoled_board',
      'Waveshare ESP32-S3-Touch-AMOLED-1.75 board (Muse Gadgets SDK supported)',
      'mcu',
      1,
      39.9,
      'authorized',
      'ESP32-S3-Touch-AMOLED-1.75',
      'The SDK documents this board as a supported target: full on-screen UI, push-to-talk, images, tunnel and OTA.',
    ),
    {
      id: 'front_bezel',
      label: 'Front bezel (screen surround, printed)',
      kind: 'custom',
      process: 'resin_sla',
      material: 'resin_std',
      qty: 1,
      bboxMm: { x: 50, y: 50, z: 8 },
      solidFraction: 0.25,
      wallMm: 2,
      toleranceMm: 0.2,
      visibleFaces: ['front', 'left', 'right', 'top', 'bottom'],
    },
    {
      id: 'stand',
      label: 'Desk stand base (printed)',
      kind: 'custom',
      process: 'resin_sla',
      material: 'resin_std',
      qty: 1,
      bboxMm: { x: 56, y: 56, z: 6 },
      solidFraction: 0.3,
      wallMm: 2,
      toleranceMm: 0.2,
      visibleFaces: ['front', 'left', 'right', 'bottom'],
    },
    bought('screws', 'M2 x 6mm screws', 'mechanical', 4, 0.12, 'lcsc', 'M2-6-SHCS', 'Four fasteners; the bezel and base clamp the board between them.'),
  ],
  interfaces: [
    { id: 'bezel-stand', between: ['front_bezel', 'stand'], clearanceMm: 0.5, contributors: ['front_bezel', 'stand'] },
    { id: 'board-bezel', between: ['amoled_board', 'front_bezel'], clearanceMm: 0.6, contributors: ['front_bezel'] },
  ],
  operations: [
    { id: 'op-print', label: 'Print the bezel and base (one print order)', minutes: 7, improvised: false },
    { id: 'op-cure', label: 'Clean and cure the resin parts', minutes: 4, improvised: false },
    { id: 'op-insert', label: 'Seat the board in the bezel, connect nothing else - it is the whole device', minutes: 3, improvised: false },
    { id: 'op-close', label: 'Clamp the base with 4 screws', minutes: 2, improvised: false },
    { id: 'op-flash', label: 'Flash the Muse Gadget firmware over USB-C and pair it', minutes: 3, improvised: false },
  ],
  certificationsBudgeted: ['fcc_radio'],
  requiresSignedDrivers: false,
  firmware: {
    provided: true,
    language: 'C++ (ESP-IDF)',
    toolchain: 'ESP-IDF v6.0.1',
    builds: true,
    testedOnHardware: false,
    pinMapMatchesFootprints: true,
    dependenciesPinned: true,
    notes: [
      'The firmware is the upstream Muse Gadgets SDK, built at the pinned ESP-IDF v6.0.1 - the design does not fork it.',
      'Flashing and pairing stay unverified until the board arrives. That is the one claim design cannot close.',
    ],
  },
  costDisclosed: true,
  cad: { opensClean: true, watertight: true, requiresManualRepair: false, ercClean: true, drcClean: true },
  producedBy: 'Reference architecture (this harness)',
  provenance:
    'The Muse Gadgets SDK reference design: a supported board, a printed shell, and the SDK firmware. Exists to show a design that clears every harness gate - including the platform-compatibility gate - before anything is ordered.',
};
