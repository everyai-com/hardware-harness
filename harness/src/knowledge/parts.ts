/**
 * The part catalogue.
 *
 * The harness historically validated only what a design *declared* (G1 checks
 * the caller's MPN and stock flags). That is the largest missing capability
 * relative to the funded tools in this category (PROCESS.md section 3): a
 * curated library of real parts with consequences - typical price, where to
 * buy, drop-in alternates, and which lines attract counterfeits.
 *
 * This is the seed of that library: ~35 parts a low-volume build actually
 * uses, each with a real manufacturer part number. Prices are qty-1 typical
 * 2026 distributor bands, not quotes - verify live before ordering. Every
 * entry carries its evidence so a wrong number can be corrected with a
 * source rather than argued about.
 */

import type { Distributor, PartType } from '../engine/types.ts';

export type CounterfeitRisk = 'high' | 'medium' | 'low';

export interface CatalogPart {
  /** Manufacturer part number - the thing you type into a distributor. */
  mpn: string;
  label: string;
  partType: PartType;
  /** Human grouping for browsing: 'mcu-module' | 'mcu-chip' | 'regulator' | ... */
  category: string;
  /** Channels where this part is legitimately available. */
  distributors: Distributor[];
  /** Typical qty-1 unit price band, USD. */
  typicalPriceUsd: [number, number];
  /** Key facts a design decision needs: voltage, package, protocol. */
  specs: Record<string, string>;
  /** Verified drop-in or near-drop-in alternates, by MPN. */
  alternates: string[];
  counterfeitRisk: CounterfeitRisk;
  note: string;
  evidence: string;
}

export const PART_CATALOGUE: CatalogPart[] = [
  // ---- MCU modules (the composition path: buy the radio, print the shell) ----
  {
    mpn: 'ESP32-WROOM-32E',
    label: 'ESP32-WROOM-32E Wi-Fi + BT module',
    partType: 'mcu',
    category: 'mcu-module',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [2.8, 4.5],
    specs: { wireless: 'Wi-Fi 4 + BLE 4.2', voltage: '3.0-3.6V', package: 'SMD module 25.5x18mm', cert: 'FCC/CE pre-certified module' },
    alternates: ['ESP32-S3-WROOM-1', 'ESP32-WROOM-32UE'],
    counterfeitRisk: 'medium',
    note: 'The default radio for low-volume builds. Pre-certified as a module, so the filing is the streamlined path, not a full intentional-radiator certification.',
    evidence: 'Espressif module datasheet; LCSC/authorized 2026 pricing',
  },
  {
    mpn: 'ESP32-S3-WROOM-1',
    label: 'ESP32-S3-WROOM-1 Wi-Fi + BLE5 module',
    partType: 'mcu',
    category: 'mcu-module',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [3.2, 5.0],
    specs: { wireless: 'Wi-Fi 4 + BLE 5', voltage: '3.0-3.6V', package: 'SMD module', cert: 'FCC/CE pre-certified module' },
    alternates: ['ESP32-WROOM-32E', 'ESP32-C3-WROOM-02'],
    counterfeitRisk: 'medium',
    note: 'Native USB and more GPIO than the original ESP32. Pick this for new USB-peripheral designs.',
    evidence: 'Espressif module datasheet; LCSC/authorized 2026 pricing',
  },
  {
    mpn: 'SC0915',
    label: 'Raspberry Pi Pico (RP2040 board)',
    partType: 'mcu',
    category: 'mcu-module',
    distributors: ['authorized', 'lcsc'],
    typicalPriceUsd: [4.0, 6.0],
    specs: { wireless: 'none (Pico W adds Wi-Fi)', voltage: '1.8-5.5V in', package: 'DIP-40 castellated 51x21mm' },
    alternates: ['SC0917', 'XIAO-RP2040'],
    counterfeitRisk: 'low',
    note: 'No radio on the base Pico, which removes the entire FCC radio filing. The cleanest legal ground for a first product.',
    evidence: 'Raspberry Pi documentation; authorized 2026 pricing',
  },
  {
    mpn: 'XIAO-RP2040',
    label: 'Seeed XIAO RP2040',
    partType: 'mcu',
    category: 'mcu-module',
    distributors: ['authorized'],
    typicalPriceUsd: [5.5, 7.5],
    specs: { wireless: 'none', voltage: '5V USB-C in', package: '21x17.5mm' },
    alternates: ['SC0915', 'XIAO-ESP32S3'],
    counterfeitRisk: 'low',
    note: 'Tiny USB-C RP2040 board. Good brain for keypads and macro controllers.',
    evidence: 'Seeed Studio wiki; authorized 2026 pricing',
  },
  {
    mpn: 'STM32F103C8T6',
    label: 'STM32F103C8T6 ("Blue Pill" MCU)',
    partType: 'mcu',
    category: 'mcu-chip',
    distributors: ['authorized'],
    typicalPriceUsd: [1.5, 3.0],
    specs: { wireless: 'none', voltage: '2.0-3.6V', package: 'LQFP-48' },
    alternates: ['STM32F103CBT6', 'GD32F103C8T6'],
    counterfeitRisk: 'high',
    note: 'The single most counterfeited MCU in the hobby market. Re-marked and cloned dies are common on marketplace channels - authorized only, no exceptions.',
    evidence: 'ERAI counterfeit data via electricalflux; EVIDENCE.md section 7',
  },
  {
    mpn: 'ATMEGA328P-AU',
    label: 'ATmega328P-AU',
    partType: 'mcu',
    category: 'mcu-chip',
    distributors: ['authorized', 'lcsc'],
    typicalPriceUsd: [1.8, 3.2],
    specs: { wireless: 'none', voltage: '1.8-5.5V', package: 'TQFP-32' },
    alternates: ['ATMEGA328PB-AU'],
    counterfeitRisk: 'medium',
    note: 'The Arduino-classic chip. Fine for simple logic; outclassed by ARM on price/performance for new designs.',
    evidence: 'Microchip datasheet; authorized 2026 pricing',
  },
  {
    mpn: 'NRF52840-QIAA',
    label: 'nRF52840 BLE/Thread SoC',
    partType: 'mcu',
    category: 'mcu-chip',
    distributors: ['authorized'],
    typicalPriceUsd: [5.0, 7.5],
    specs: { wireless: 'BLE 5.4 / Thread / Zigbee', voltage: '1.7-5.5V', package: 'QFN-73' },
    alternates: ['NRF52833-QIAA'],
    counterfeitRisk: 'medium',
    note: 'The serious low-power radio chip. Use a pre-certified module (e.g. Raytac MDBT50Q) instead of the bare chip unless you have an RF engineer.',
    evidence: 'Nordic datasheet; authorized 2026 pricing',
  },
  // ---- regulators ----
  {
    mpn: 'AMS1117-3.3',
    label: 'AMS1117-3.3 LDO regulator',
    partType: 'regulator',
    category: 'regulator',
    distributors: ['authorized'],
    typicalPriceUsd: [0.15, 0.4],
    specs: { output: '3.3V 1A', dropout: '~1.1V', package: 'SOT-223' },
    alternates: ['LD1117S33TR', 'AP2112K-3.3'],
    counterfeitRisk: 'high',
    note: 'Ubiquitous and heavily counterfeited; fakes regulate badly and run hot. Costs cents from authorized stock - never worth the marketplace gamble.',
    evidence: 'ERAI counterfeit data; authorized 2026 pricing',
  },
  {
    mpn: 'AP2112K-3.3TRG1',
    label: 'AP2112K 3.3V LDO',
    partType: 'regulator',
    category: 'regulator',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.2, 0.5],
    specs: { output: '3.3V 600mA', dropout: '250mV', package: 'SOT-23-5' },
    alternates: ['AMS1117-3.3', 'XC6206P332MR'],
    counterfeitRisk: 'low',
    note: 'The ESP32-board standard LDO. Low dropout matters on USB power.',
    evidence: 'Diodes Inc datasheet; LCSC 2026 pricing',
  },
  {
    mpn: 'MP1584EN-LF-Z',
    label: 'MP1584EN buck converter',
    partType: 'regulator',
    category: 'regulator',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.5, 1.0],
    specs: { output: 'adjustable to 0.8V, 3A', input: '4.5-28V', package: 'SOIC-8' },
    alternates: ['LM2596S-ADJ', 'SY8113B'],
    counterfeitRisk: 'medium',
    note: 'Cheap 3A buck for 5V rails from higher-voltage supplies. Needs an inductor and layout care.',
    evidence: 'MPS datasheet; LCSC 2026 pricing',
  },
  // ---- analog ----
  {
    mpn: 'NE555DR',
    label: 'NE555 timer',
    partType: 'analog_ic',
    category: 'analog',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.15, 0.4],
    specs: { voltage: '4.5-16V', package: 'SOIC-8' },
    alternates: ['TLC555CDR', 'LMC555CM'],
    counterfeitRisk: 'low',
    note: 'Still the cheapest way to blink, beep or debounce without firmware.',
    evidence: 'TI datasheet; LCSC 2026 pricing',
  },
  {
    mpn: 'MCP6002-I/SN',
    label: 'MCP6002 dual op-amp',
    partType: 'analog_ic',
    category: 'analog',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.4, 0.8],
    specs: { voltage: '1.8-6V rail-to-rail', package: 'SOIC-8' },
    alternates: ['LMV358IDR', 'TLV9002IDR'],
    counterfeitRisk: 'medium',
    note: 'Rail-to-rail 5V op-amp for sensor front ends. Analog ICs are a counterfeited class - prefer authorized.',
    evidence: 'Microchip datasheet; ERAI class data',
  },
  {
    mpn: 'PCM5102APWR',
    label: 'PCM5102A I2S DAC',
    partType: 'analog_ic',
    category: 'analog',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [2.5, 4.5],
    specs: { interface: 'I2S', output: '2.1Vrms line out', package: 'TSSOP-20' },
    alternates: ['PCM5100APWR', 'UDA1334BTS'],
    counterfeitRisk: 'medium',
    note: 'The DIY-audio DAC. Pairs with an ESP32-S3 over I2S for audio gadgets.',
    evidence: 'TI datasheet; LCSC 2026 pricing',
  },
  // ---- passives (the LCSC aisle) ----
  {
    mpn: 'RC0603FR-0710KL',
    label: '10k resistor 0603 1%',
    partType: 'passive',
    category: 'passive',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.005, 0.02],
    specs: { value: '10k', tolerance: '1%', package: '0603' },
    alternates: ['CR0603-FX-1002ELF'],
    counterfeitRisk: 'low',
    note: 'Commodity jellybean. Buy the reel strip from LCSC; nobody counterfeits a 10k resistor.',
    evidence: 'LCSC 2026 pricing',
  },
  {
    mpn: 'CL10B104KB8NNNC',
    label: '100nF ceramic capacitor 0603',
    partType: 'passive',
    category: 'passive',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.01, 0.03],
    specs: { value: '100nF X7R 50V', package: '0603' },
    alternates: ['GRM188R71H104KA93D'],
    counterfeitRisk: 'low',
    note: 'One per power pin, no exceptions. The EEBench 22uF derating failure is what happens when capacitance is assumed.',
    evidence: 'Samsung Electro-Mechanics datasheet; LCSC 2026 pricing',
  },
  {
    mpn: 'CL21A226MAQNNNE',
    label: '22uF ceramic capacitor 0805',
    partType: 'passive',
    category: 'passive',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.05, 0.15],
    specs: { value: '22uF X5R 10V', package: '0805' },
    alternates: ['GRM21BR61A226ME44L'],
    counterfeitRisk: 'low',
    note: 'DC-bias derating is real: 22uF nominal can be ~11uF effective at working voltage. Size the rail for effective, not nominal.',
    evidence: 'EEBench capacitor failure (11.4uF effective vs 545uF needed); LCSC 2026 pricing',
  },
  // ---- LEDs and light ----
  {
    mpn: 'WS2812B',
    label: 'WS2812B addressable RGB LED',
    partType: 'led',
    category: 'led',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.12, 0.3],
    specs: { interface: 'single-wire 800kHz', voltage: '5V', package: '5050 SMD' },
    alternates: ['SK6812', 'APA102C'],
    counterfeitRisk: 'low',
    note: 'The NeoPixel LED. Timing-sensitive: needs a tight loop or peripheral, and a fat capacitor on the rail.',
    evidence: 'Worldsemi datasheet; LCSC 2026 pricing',
  },
  {
    mpn: 'XPEWHT-L1-0000-00C01',
    label: 'Cree XP-E2 white LED',
    partType: 'led',
    category: 'led',
    distributors: ['authorized'],
    typicalPriceUsd: [0.8, 1.6],
    specs: { output: '~100lm @ 350mA', voltage: '~3.0Vf', package: '3535 SMD' },
    alternates: ['Nichia NF2W757G', 'Samsung LM281B'],
    counterfeitRisk: 'medium',
    note: 'Real illumination-grade LED for lamps. Needs a driver and a thermal path - not a resistor and hope.',
    evidence: 'Cree datasheet; authorized 2026 pricing',
  },
  // ---- connectors ----
  {
    mpn: 'TYPE-C-6P-SMT',
    label: 'USB-C 6-pin mid-mount receptacle',
    partType: 'connector',
    category: 'connector',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.3, 0.8],
    specs: { pins: '6 (power + CC)', rating: '5V 3A', package: 'SMT mid-mount' },
    alternates: ['USB-C-16P-SMT'],
    counterfeitRisk: 'low',
    note: 'Power-only USB-C for 5V designs. Needs 5.1k CC pulldowns or many chargers will not deliver current.',
    evidence: 'LCSC connector listings 2026; USB-C spec CC requirement',
  },
  {
    mpn: 'JST-XH-2P',
    label: 'JST-XH 2-pin connector pair',
    partType: 'connector',
    category: 'connector',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.1, 0.25],
    specs: { pitch: '2.5mm', rating: '3A', package: 'through-hole + housing' },
    alternates: ['JST-PH-2P', 'Molex-KK-2P'],
    counterfeitRisk: 'low',
    note: 'The battery-and-button connector. Polarized, crimpable with a cheap tool.',
    evidence: 'JST datasheet; LCSC 2026 pricing',
  },
  // ---- sensors ----
  {
    mpn: 'BME280',
    label: 'BME280 temp/humidity/pressure sensor',
    partType: 'sensor',
    category: 'sensor',
    distributors: ['authorized', 'lcsc'],
    typicalPriceUsd: [2.5, 5.0],
    specs: { interface: 'I2C/SPI', voltage: '1.7-3.6V', package: 'LGA-8 2.5x2.5mm' },
    alternates: ['BME680', 'SHT31-DIS'],
    counterfeitRisk: 'medium',
    note: 'Genuine Bosch parts via authorized; marketplace modules are often re-marked BMP280s without humidity.',
    evidence: 'Bosch datasheet; community counterfeit reports',
  },
  {
    mpn: 'HC-SR04',
    label: 'HC-SR04 ultrasonic module',
    partType: 'sensor',
    category: 'sensor',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [1.5, 3.5],
    specs: { interface: 'trigger/echo GPIO', voltage: '5V (echo is 5V logic)', range: '2-400cm' },
    alternates: ['US-015', 'RCWL-1601'],
    counterfeitRisk: 'low',
    note: 'Echo output is 5V logic - level-shift before pairing with a 3.3V MCU or the pin dies young.',
    evidence: 'Schematik catalogue cross-part warning; LCSC 2026 pricing',
  },
  {
    mpn: 'MPU-6050',
    label: 'MPU-6050 6-axis IMU module',
    partType: 'sensor',
    category: 'sensor',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [2.0, 4.5],
    specs: { interface: 'I2C', voltage: '3.3V', package: 'module 20x16mm' },
    alternates: ['MPU-9250', 'ICM-20948'],
    counterfeitRisk: 'medium',
    note: 'End-of-life at TDK, so new stock claims deserve skepticism. ICM-series is the current line.',
    evidence: 'TDK EOL notice; LCSC 2026 pricing',
  },
  {
    mpn: 'TTP223-BA6',
    label: 'TTP223 capacitive touch IC',
    partType: 'sensor',
    category: 'sensor',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.15, 0.4],
    specs: { interface: 'digital out', voltage: '2.0-5.5V', package: 'SOT-23-6' },
    alternates: ['TTP224N', 'AT42QT1010'],
    counterfeitRisk: 'low',
    note: 'One-channel touch through up to ~2mm of wall. The lamp-fixture touch answer.',
    evidence: 'Tontek datasheet; LCSC 2026 pricing',
  },
  {
    mpn: 'INMP441',
    label: 'INMP441 I2S MEMS microphone',
    partType: 'sensor',
    category: 'sensor',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [1.5, 3.0],
    specs: { interface: 'I2S 24-bit', voltage: '1.8-3.3V', package: 'module or LHC-4.7x3.76' },
    alternates: ['SPH0645LM4H', 'ICS-43434'],
    counterfeitRisk: 'low',
    note: 'Digital mic over I2S - no preamp design needed. The voice-note-taker capsule.',
    evidence: 'TDK InvenSense datasheet; LCSC 2026 pricing',
  },
  // ---- motion ----
  {
    mpn: 'SG90',
    label: 'SG90 9g micro servo',
    partType: 'motor',
    category: 'motor',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [2.0, 4.0],
    specs: { torque: '1.8kg-cm', voltage: '4.8-6V', interface: 'PWM 50Hz' },
    alternates: ['MG90S', 'SG92R'],
    counterfeitRisk: 'low',
    note: 'Plastic gears strip under shock loads. MG90S (metal gear) is the drop-in upgrade.',
    evidence: 'Tower Pro datasheet; LCSC 2026 pricing',
  },
  {
    mpn: 'NEMA17-42BYGH',
    label: 'NEMA 17 stepper motor',
    partType: 'motor',
    category: 'motor',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [8.0, 15.0],
    specs: { torque: '40N-cm holding', current: '1.5-1.7A/phase', frame: '42x42mm' },
    alternates: ['NEMA17-SLIM-34MM'],
    counterfeitRisk: 'low',
    note: 'The 3D-printer motor. Needs a driver (TMC2209) and a 12-24V supply - never drive from logic pins.',
    evidence: 'OEM datasheets; LCSC 2026 pricing',
  },
  {
    mpn: 'TMC2209-LA',
    label: 'TMC2209 stepper driver',
    partType: 'analog_ic',
    category: 'motor-driver',
    distributors: ['authorized', 'lcsc'],
    typicalPriceUsd: [4.0, 7.0],
    specs: { current: '2A RMS', interface: 'STEP/DIR + UART', package: 'QFN-28 / module' },
    alternates: ['TMC2226-SA', 'DRV8825'],
    counterfeitRisk: 'medium',
    note: 'Silent StealthChop driver. Marketplace modules often substitute the chip - buy the driver from authorized.',
    evidence: 'ADI/Trinamic datasheet; authorized 2026 pricing',
  },
  // ---- power ----
  {
    mpn: 'NCR18650B',
    label: 'Panasonic NCR18650B 3400mAh cell',
    partType: 'battery',
    category: 'battery',
    distributors: ['authorized'],
    typicalPriceUsd: [5.0, 9.0],
    specs: { chemistry: 'Li-ion 3.7V', capacity: '3400mAh', package: '18650 cylinder' },
    alternates: ['Samsung INR18650-35E', 'LG MJ1'],
    counterfeitRisk: 'high',
    note: 'Genuine cells only from authorized channels - marketplace 18650s are routinely rewrapped low-grade cells, and a lithium cell triggers UN38.3 shipping rules.',
    evidence: 'Panasonic datasheet; UN38.3 transport requirement',
  },
  // ---- mechanical ----
  {
    mpn: 'M3-BRASS-INSERT',
    label: 'M3x5.7 brass heat-set insert',
    partType: 'mechanical',
    category: 'fastener',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.05, 0.15],
    specs: { thread: 'M3', length: '5.7mm', install: 'soldering iron 200C' },
    alternates: ['M3-HEX-NUT-TRAP'],
    counterfeitRisk: 'low',
    note: 'The right way to fasten into printed plastic. Self-tapping into FDM strips on the second service.',
    evidence: 'McMaster/CNC Kitchen pull-out tests; LCSC 2026 pricing',
  },
  {
    mpn: 'M3X8-BUTTON-SS',
    label: 'M3x8 button-head screw, stainless',
    partType: 'mechanical',
    category: 'fastener',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [0.03, 0.1],
    specs: { thread: 'M3x0.5', length: '8mm', drive: '2mm hex' },
    alternates: ['M3X8-SOCKET-SS'],
    counterfeitRisk: 'low',
    note: 'Standardize on one screw across the product. Mixed fasteners are an assembly-time tax.',
    evidence: 'LCSC 2026 pricing',
  },
  // ---- display ----
  {
    mpn: 'SSD1306-096-OLED',
    label: '0.96in SSD1306 OLED module',
    partType: 'sensor',
    category: 'display',
    distributors: ['lcsc', 'authorized'],
    typicalPriceUsd: [2.5, 5.0],
    specs: { interface: 'I2C/SPI', resolution: '128x64 mono', voltage: '3.3-5V' },
    alternates: ['SH1106-096-OLED', 'SSD1309-096-OLED'],
    counterfeitRisk: 'low',
    note: 'The default status display. I2C needs only two wires plus power.',
    evidence: 'Solomon Systech datasheet; LCSC 2026 pricing',
  },
  // ---- audio in ----
  {
    mpn: 'MAX98357AETE-T',
    label: 'MAX98357A I2S 3W amplifier',
    partType: 'analog_ic',
    category: 'analog',
    distributors: ['authorized', 'lcsc'],
    typicalPriceUsd: [1.5, 3.0],
    specs: { interface: 'I2S in', output: '3.2W into 4ohm', package: 'TQFN-16' },
    alternates: ['MAX98357BETE-T', 'PAM8302AASCR'],
    counterfeitRisk: 'medium',
    note: 'I2S in, speaker out, no DAC stage to design. The voice-note-taker playback path.',
    evidence: 'ADI/Maxim datasheet; authorized 2026 pricing',
  },
];

/** MPNs in lowercase, for matching. */
const byMpn = new Map<string, CatalogPart>();
for (const p of PART_CATALOGUE) byMpn.set(p.mpn.toLowerCase(), p);

/**
 * Look up catalogue parts by free text: matches MPN, label, category and
 * part type. Returns best matches first, capped at `limit`.
 */
export function lookupPart(query: string, limit = 8): CatalogPart[] {
  const q = query.trim().toLowerCase();
  if (!q) return PART_CATALOGUE.slice(0, limit);
  const scored: Array<{ part: CatalogPart; score: number }> = [];
  for (const part of PART_CATALOGUE) {
    const mpn = part.mpn.toLowerCase();
    const label = part.label.toLowerCase();
    let score = -1;
    if (mpn === q) score = 100;
    else if (mpn.startsWith(q)) score = 80;
    else if (mpn.includes(q)) score = 60;
    else if (label.includes(q)) score = 40;
    else if (part.category.toLowerCase().includes(q) || part.partType.toLowerCase() === q) score = 20;
    else if (Object.values(part.specs).some((s) => s.toLowerCase().includes(q))) score = 10;
    if (score >= 0 && scored.length < 200) scored.push({ part, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, Math.min(limit, 50))).map((s) => s.part);
}

/** Exact MPN match, case-insensitive. */
export function partByMpn(mpn: string): CatalogPart | undefined {
  return byMpn.get(mpn.trim().toLowerCase());
}

/**
 * Drop-in alternates for an MPN: catalogue entries first, then the part's own
 * declared alternate MPNs that are not in the catalogue (returned as stubs).
 */
export function suggestAlternates(mpn: string): CatalogPart[] {
  const part = partByMpn(mpn);
  if (!part) return [];
  const found: CatalogPart[] = [];
  for (const alt of part.alternates) {
    const entry = partByMpn(alt);
    if (entry) found.push(entry);
  }
  return found;
}

/** Catalogue coverage, for the reference page and the CLI. */
export function catalogueStats(): { parts: number; categories: string[]; highRisk: string[]; priceBands: number } {
  const categories = [...new Set(PART_CATALOGUE.map((p) => p.category))].sort();
  const highRisk = PART_CATALOGUE.filter((p) => p.counterfeitRisk === 'high').map((p) => p.mpn);
  return { parts: PART_CATALOGUE.length, categories, highRisk, priceBands: PART_CATALOGUE.length };
}
