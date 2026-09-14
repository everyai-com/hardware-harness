/**
 * The same product, architected the way small-batch electronics actually gets built.
 *
 * This is the counter-example to `blueprint-voice-note.ts`: identical requirements,
 * same module platform, but with a board in the design and the labour designed out.
 *
 * The architecture, which is the standard pattern for a product at this scale:
 *   1. Build on a documented module platform (ESP32-S3 module), not bare silicon.
 *   2. Put everything on ONE 2-layer board that the board house populates.
 *   3. Specify the cell, with its capacity and connector, in the bill of materials.
 *   4. Move anything expensive on-device (transcription) to the phone.
 *   5. Buy from authorised channels for the ICs, LCSC for passives.
 *   6. Snap-fit or two screws, not four brackets and four fasteners.
 */

import type { ProductSpec, Part, PartType } from '../engine/types.ts';

function bought(
  id: string,
  label: string,
  partType: PartType,
  qty: number,
  unitPriceUsd: number,
  distributor: 'lcsc' | 'authorized',
  note: string,
): Part {
  return {
    id,
    label,
    kind: 'catalog',
    process: 'fdm',
    material: 'n/a',
    qty,
    bboxMm: { x: 20, y: 20, z: 5 },
    solidFraction: 0.3,
    purchasePriceUsd: unitPriceUsd,
    source: { distributor, mpn: id.toUpperCase(), inStock: true, stockVerified: true, alternates: 2, partType },
    notes: [note],
  };
}

export const VOICE_NOTE_FIXED: ProductSpec = {
  id: 'voice-note-fixed',
  name: 'Magnetic Voice Note-Taker (board-based architecture)',
  intent:
    'Same device and same requirements as the generated design, built around one assembled PCB instead of 18 hand-soldered wires.',
  referenceRender: 'Ultra-slim MagSafe voice recorder with an LED ring and a tactile button.',
  targetRetailUsd: 79,
  targetQuantities: [1, 100, 1000],
  origin: 'china',
  markets: ['us'],
  power: {
    mainsInside: false,
    wireless: 'bluetooth',
    battery: 'lithium', // still present: an honest trade, and the reason G4 still fails
    usbPowered: false,
    externalAdapterCertified: false,
    includesAdapter: false,
    maxWatts: 5,
  },
  features: [
    { id: 'led_ring', label: 'LED status ring', expectedFace: 'top', actualFace: 'top', present: true, cosmetic: true },
    { id: 'button', label: 'Tactile input switch', expectedFace: 'top', actualFace: 'top', present: true, cosmetic: true },
    { id: 'nfc', label: 'NFC tag on the back (phone tap to pair)', expectedFace: 'back', actualFace: 'back', present: true, cosmetic: false },
    { id: 'mic', label: 'Microphone port', expectedFace: 'front', actualFace: 'front', present: true, cosmetic: false },
    {
      id: 'transcription',
      label: 'Understands everything (voice transcription)',
      expectedFace: 'internal',
      actualFace: 'internal',
      present: true,
      cosmetic: false,
      note: 'Implemented in the companion app, not on the device. On-device transcription is what destroys the battery budget.',
    },
  ],
  parts: [
    // One board, populated by the board house. This replaces 8 discrete electronic
    // parts, 4 mounting brackets and 18 hand-soldered wires.
    {
      id: 'main_pcb',
      label: 'Main PCB, assembled (ESP32-S3 module, I2S mic, charger, NFC, LED driver)',
      kind: 'custom',
      process: 'pcb_assembly',
      material: 'n/a',
      qty: 1,
      bboxMm: { x: 62, y: 38, z: 1.6 },
      solidFraction: 0.1,
      toleranceMm: 0.1,
      visibleFaces: [],
      notes: ['PCB fab + assembly at JLCPCB, parts placed from the board house library.'],
    },
    bought('battery', '1S LiPo cell, 400mAh with JST-PH connector', 'battery', 1, 4.2, 'authorized', 'Specified with capacity and connector, and dimensioned against the shell.'),
    bought('magnet', 'Neodymium magnet ring (MagSafe)', 'mechanical', 1, 2.0, 'lcsc', 'Mounted with an NFC keep-out: the antenna sits adjacent, not underneath.'),
    bought('screws', 'M1.4 x 4mm screws', 'mechanical', 2, 0.15, 'lcsc', 'Two fasteners, not four brackets.'),
    // Enclosure: two parts.
    { id: 'top_shell', label: 'Top shell', kind: 'custom', process: 'resin_sla', material: 'resin_std', qty: 1, bboxMm: { x: 70, y: 45, z: 18 }, solidFraction: 0.18, wallMm: 1.6, toleranceMm: 0.2, visibleFaces: ['front', 'back', 'left', 'right', 'top'] },
    { id: 'bottom_shell', label: 'Bottom shell (snap-fit, magnet pocket)', kind: 'custom', process: 'resin_sla', material: 'resin_std', qty: 1, bboxMm: { x: 70, y: 45, z: 12 }, solidFraction: 0.2, wallMm: 1.6, toleranceMm: 0.2, visibleFaces: ['front', 'back', 'left', 'right', 'bottom'] },
    { id: 'gasket', label: 'Microphone isolation gasket (cast silicone)', kind: 'custom', process: 'resin_sla', material: 'silicone', qty: 1, bboxMm: { x: 12, y: 12, z: 2 }, solidFraction: 0.9, wallMm: 1.0, toleranceMm: 0.2, visibleFaces: [] },
  ],
  interfaces: [
    { id: 'shells', between: ['top_shell', 'bottom_shell'], clearanceMm: 0.6, contributors: ['top_shell', 'bottom_shell'] },
    { id: 'board-to-shell', between: ['main_pcb', 'bottom_shell'], clearanceMm: 0.5, contributors: ['main_pcb'] },
  ],
  /**
   * This is the one fixture that declares its wiring, and it is the point of the
   * counter-example: everything else on the board is inside the assembled PCB, so the
   * entire electrical interface is the single JST lead the build step describes.
   *
   * The model-generated fixtures deliberately declare nothing here. Their NO_NETS
   * warning is a finding about them, not an omission in this file - generated designs
   * routinely specify a battery and a charger without ever stating which pin goes where.
   */
  nets: [
    {
      id: 'vbat',
      name: 'VBAT_3V7',
      signal: 'power',
      voltage: 3.7,
      endpoints: [
        { part: 'battery', pin: 'BAT+' },
        { part: 'main_pcb', pin: 'VBAT' },
      ],
      note: 'Single JST-PH lead, keyed so it cannot be reversed.',
    },
    {
      id: 'gnd',
      name: 'GND',
      signal: 'gnd',
      endpoints: [
        { part: 'battery', pin: 'GND' },
        { part: 'main_pcb', pin: 'GND' },
      ],
      note: 'Return path, same connector.',
    },
  ],
  operations: [
    { id: 'op-print', label: 'Print two shells and the gasket (one print order)', minutes: 10, improvised: false },
    { id: 'op-cure', label: 'Clean and cure resin parts', minutes: 15, improvised: false },
    { id: 'op-insert', label: 'Drop in the battery and the assembled board, connect one JST lead', minutes: 4, improvised: false, wireCount: 0 },
    { id: 'op-close', label: 'Snap the shell closed, fit 2 screws and the magnet ring', minutes: 4, improvised: false },
    { id: 'op-flash', label: 'Flash firmware over USB-C and test the ring, mic and NFC tap', minutes: 6, improvised: false },
  ],
  // The difference between a design that ignores certification and one that plans for it.
  certificationsBudgeted: ['fcc_radio', 'un383'],
  requiresSignedDrivers: false,
  firmware: {
    provided: true,
    language: 'C++ (ESP-IDF)',
    toolchain: 'ESP-IDF v5.x, pinned',
    builds: true,
    testedOnHardware: false,
    pinMapMatchesFootprints: true,
    dependenciesPinned: true,
    notes: ['Still untested until the board arrives - that is the one thing design cannot resolve.'],
  },
  costDisclosed: true,
  cad: { opensClean: true, watertight: true, requiresManualRepair: false, ercClean: true, drcClean: true },
  producedBy: 'Reference architecture (this harness)',
  provenance:
    'The corrected build of the Blueprint voice note-taker. Same product, same requirements, board-based architecture: 7 line items instead of 25, 39 minutes of labour instead of 262.',
};
