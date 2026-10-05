/**
 * Target platform knowledge: the Muse Gadgets SDK.
 *
 * "Muse Gadget compatible" is a checkable claim, not a vibe: the SDK runs on a
 * published list of boards, builds with exactly one ESP-IDF version, and each
 * board supports a known set of capabilities. This file encodes those facts so
 * the harness can verify a design against them instead of trusting prose.
 *
 * Every row is transcribed from the upstream docs (Apache-2.0), read 2026-10-04:
 *   https://github.com/facebookincubator/muse-gadget-sdk
 * If a design asks for a capability the board does not have, it is a finding -
 * not a footnote.
 */

const REPO = 'https://github.com/facebookincubator/muse-gadget-sdk';
const DEVICES_DOC = `${REPO}/blob/main/esp32/devices/README.md`;
const ESP32_DOC = `${REPO}/blob/main/esp32/README.md`;
const LINUX_DOC = `${REPO}/blob/main/linux/README.md`;

export const MUSE_SDK = {
  id: 'muse-gadgets',
  label: 'Muse Gadgets SDK',
  repo: REPO,
  license: 'Apache-2.0',
  /** The only supported toolchain version: "Other versions aren't supported." */
  espIdf: 'v6.0.1',
  tokenUrl: 'https://gadgets.muse.ai/settings/sdk-tokens',
  termsUrl: 'https://gadgets.muse.ai/sdk-terms',
  /** ESP32 devices appear in the Muse app as `MuseGadget-XXXXXX` (Linux: `MuseGadgetXXXXXX`). */
  devicePrefix: 'MuseGadget',
  community: 'https://discord.gg/3bhjCkZdd6',
  /** Community tracker of real builds (third-party, not Meta-run). */
  communityBuilds: 'https://musecases.netlify.app/hardware/',
  source: 'muse-gadget-sdk esp32/README.md + esp32/devices/README.md + linux/README.md, read 2026-10-04',
} as const;

/**
 * What a design can ask of a gadget. The ESP32 set comes from the devices
 * feature matrix; the Linux set is the SDK's command surface.
 */
export const MUSE_CAPABILITIES = [
  'display',
  'images',
  'ui',
  'touch',
  'audio',
  'push_to_talk',
  'tunnel',
  'battery_status',
  'sensors',
  'camera',
  'ota',
  'system_run',
  'file_access',
  'device_health',
] as const;

export type MuseCapability = (typeof MUSE_CAPABILITIES)[number];

export interface MuseBoard {
  id: string;
  label: string;
  /** ESP-IDF target: 'esp32' | 'esp32c5' | 'esp32c6' | 'esp32s3'. */
  chip: string;
  flashMb: number;
  psramMb: number | null;
  display: string | null;
  buttons: string;
  /** Real capabilities from the feature matrix - what the design may rely on. */
  capabilities: MuseCapability[];
  /** sdkconfig overlays loaded on top of sdkconfig.defaults, in order. */
  overlays: string[];
  /** The documented build command (explicit idf.py form for "by hand" boards). */
  buildCmd: string;
  /** Port still experimental upstream - say so rather than implying support. */
  experimental?: boolean;
  /** Flashing, backup and hardware caveats a builder must know before ordering. */
  flashNote?: string;
  docsUrl?: string;
  source: string;
}

function board(b: Omit<MuseBoard, 'source'>): MuseBoard {
  // OTA is configurable on every board (CONFIG_HOMEHUB_OTA_ENABLED); the matrix's
  // On/Off column is the default, not the capability. Defaults live in
  // MUSE_OTA_DEFAULT_OFF so the scaffold can emit the delta when a design asks.
  const capabilities = b.capabilities.includes('ota') ? b.capabilities : [...b.capabilities, 'ota' as MuseCapability];
  return { ...b, capabilities, source: DEVICES_DOC };
}

/** Over-the-air updates are off by default on these; the full-UI boards turn them on. */
export const MUSE_OTA_DEFAULT_OFF = new Set([
  'esp32-c5-devkitc-1',
  'ideaspark-esp32-1.9',
  'sensecap-indicator',
  'reterminal-e1001',
  'reterminal-e1002',
  'home-assistant-voice-pe',
  'm5stack-cardputer-adv',
]);

export const MUSE_BOARDS: Record<string, MuseBoard> = {
  'esp32-c5-devkitc-1': board({
    id: 'esp32-c5-devkitc-1',
    label: 'ESP32-C5 DevKitC-1',
    chip: 'esp32c5',
    flashMb: 8,
    psramMb: 8,
    display: null,
    buttons: 'BOOT',
    capabilities: ['tunnel'],
    overlays: [],
    buildCmd: 'idf.py build',
    flashNote: 'The SDK default: works as-is with its built-in status light and BOOT button.',
    docsUrl: 'https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c5/esp32-c5-devkitc-1/index.html',
  }),
  'ideaspark-esp32-1.9': board({
    id: 'ideaspark-esp32-1.9',
    label: 'ideaspark ESP32 with 1.9" display',
    chip: 'esp32',
    flashMb: 16,
    psramMb: null,
    display: '1.9" 170×320 LCD',
    buttons: 'BOOT',
    capabilities: ['display', 'images'],
    overlays: ['devices/sdkconfig.ideaspark'],
    buildCmd: 'tools/board.sh ideaspark build',
    flashNote: 'No PSRAM: no home-network tunnel, and the UI holds no image buffer - status on screen only.',
  }),
  'sensecap-indicator': board({
    id: 'sensecap-indicator',
    label: 'Seeed SenseCAP Indicator',
    chip: 'esp32s3',
    flashMb: 8,
    psramMb: 8,
    display: '4" 480×480 LCD',
    buttons: 'Top',
    capabilities: ['display', 'images', 'tunnel', 'sensors'],
    overlays: ['devices/sdkconfig.sensecap-indicator'],
    buildCmd: 'tools/board.sh sensecap-indicator build',
    flashNote: 'Air sensors (CO2, tVOC) hang off the onboard RP2040 and need Seeed\'s stock RP2040 firmware.',
  }),
  'reterminal-e1001': board({
    id: 'reterminal-e1001',
    label: 'Seeed reTerminal E1001',
    chip: 'esp32s3',
    flashMb: 32,
    psramMb: 8,
    display: '7.5" 800×480 1-bit e-paper',
    buttons: 'Green',
    capabilities: ['display', 'images', 'tunnel'],
    overlays: ['devices/sdkconfig.reterminal-e1001'],
    buildCmd: 'tools/board.sh reterminal-e1001 build',
    flashNote: 'E-paper refresh takes a second or two; images are dithered to black and white on-device.',
  }),
  'reterminal-e1002': board({
    id: 'reterminal-e1002',
    label: 'Seeed reTerminal E1002',
    chip: 'esp32s3',
    flashMb: 32,
    psramMb: 8,
    display: '7.3" 800×480 six-colour e-paper (E Ink Spectra 6)',
    buttons: 'Green',
    capabilities: ['display', 'images', 'tunnel'],
    overlays: ['devices/sdkconfig.reterminal-e1002'],
    buildCmd: 'tools/board.sh reterminal-e1002 build',
    flashNote: 'Each six-colour refresh takes about 30 seconds and flashes - design the status cadence around it.',
  }),
  'home-assistant-voice-pe': board({
    id: 'home-assistant-voice-pe',
    label: 'Home Assistant Voice Preview Edition',
    chip: 'esp32s3',
    flashMb: 16,
    psramMb: 8,
    display: null,
    buttons: 'Centre (talk), dial',
    capabilities: ['tunnel', 'push_to_talk', 'audio'],
    overlays: ['devices/sdkconfig.home-assistant-voice'],
    buildCmd: 'tools/board.sh home-assistant-voice build',
    flashNote: 'No screen: Muse replies show up in the Muse app; status lives on the 12-LED ring.',
  }),
  'waveshare-esp32-s3-touch-amoled-1.75c': board({
    id: 'waveshare-esp32-s3-touch-amoled-1.75c',
    label: 'Waveshare ESP32-S3-Touch-AMOLED-1.75C',
    chip: 'esp32s3',
    flashMb: 32,
    psramMb: 8,
    display: '1.75" 466×466 round AMOLED, touch',
    buttons: 'PWR (talk), BOOT',
    capabilities: ['display', 'images', 'ui', 'touch', 'audio', 'push_to_talk', 'tunnel', 'battery_status', 'ota'],
    overlays: ['devices/sdkconfig.muse', 'devices/sdkconfig.muse-waveshare-s3-175c'],
    buildCmd:
      'idf.py -B build-waveshare-s3-175c -DIDF_TARGET=esp32s3 -DSDKCONFIG=build-waveshare-s3-175c/sdkconfig -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;devices/sdkconfig.muse;devices/sdkconfig.muse-waveshare-s3-175c" build',
    docsUrl: 'https://docs.waveshare.com/ESP32-S3-Touch-AMOLED-1.75C',
  }),
  'waveshare-esp32-s3-touch-amoled-1.75': board({
    id: 'waveshare-esp32-s3-touch-amoled-1.75',
    label: 'Waveshare ESP32-S3-Touch-AMOLED-1.75',
    chip: 'esp32s3',
    flashMb: 16,
    psramMb: 8,
    display: '1.75" 466×466 round AMOLED, touch',
    buttons: 'BOOT (talk), PWR',
    capabilities: ['display', 'images', 'ui', 'touch', 'audio', 'push_to_talk', 'tunnel', 'battery_status', 'ota'],
    overlays: ['devices/sdkconfig.muse', 'devices/sdkconfig.muse-waveshare-s3-175'],
    buildCmd:
      'idf.py -B build-waveshare-s3-175 -DIDF_TARGET=esp32s3 -DSDKCONFIG=build-waveshare-s3-175/sdkconfig -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;devices/sdkconfig.muse;devices/sdkconfig.muse-waveshare-s3-175" build',
    docsUrl: 'https://docs.waveshare.com/ESP32-S3-Touch-AMOLED-1.75',
  }),
  'esp32-s3-box-3': board({
    id: 'esp32-s3-box-3',
    label: 'Espressif ESP32-S3-BOX-3',
    chip: 'esp32s3',
    flashMb: 16,
    psramMb: 16,
    display: '2.4" 320×240 LCD, touch',
    buttons: 'BOOT/CONFIG (talk)',
    capabilities: ['display', 'images', 'ui', 'touch', 'audio', 'push_to_talk', 'tunnel', 'ota'],
    overlays: ['devices/sdkconfig.muse', 'devices/sdkconfig.muse-espressif-box-3'],
    buildCmd: 'tools/muse/board.sh build box3',
    flashNote: 'See esp32/devices/esp32-s3-box-3.md for PowerShell build/flash commands and the hardware checklist.',
  }),
  'aipi-lite': board({
    id: 'aipi-lite',
    label: 'AIPI Lite',
    chip: 'esp32s3',
    flashMb: 16,
    psramMb: 8,
    display: '128×128 LCD',
    buttons: 'Two',
    capabilities: ['display', 'images', 'ui', 'audio', 'push_to_talk', 'tunnel', 'battery_status', 'ota'],
    overlays: ['devices/sdkconfig.muse', 'devices/sdkconfig.muse-aipi'],
    buildCmd:
      'idf.py -B build-aipi -DIDF_TARGET=esp32s3 -DSDKCONFIG=build-aipi/sdkconfig -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;devices/sdkconfig.muse;devices/sdkconfig.muse-aipi" build',
  }),
  'waveshare-esp32-c6-touch-amoled-1.8': board({
    id: 'waveshare-esp32-c6-touch-amoled-1.8',
    label: 'Waveshare ESP32-C6-Touch-AMOLED-1.8',
    chip: 'esp32c6',
    flashMb: 16,
    psramMb: null,
    display: '1.8" 368×448 AMOLED, touch',
    buttons: 'BOOT (talk), PWR',
    capabilities: ['display', 'ui', 'touch', 'audio', 'push_to_talk', 'battery_status', 'ota'],
    overlays: ['devices/sdkconfig.muse', 'devices/sdkconfig.muse-waveshare-c6-18'],
    buildCmd:
      'idf.py -B build-waveshare-c6-18 -DIDF_TARGET=esp32c6 -DSDKCONFIG=build-waveshare-c6-18/sdkconfig -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;devices/sdkconfig.muse;devices/sdkconfig.muse-waveshare-c6-18" build',
    flashNote: 'No PSRAM: no home-network tunnel and no images; push-to-talk replies scroll as text.',
    docsUrl: 'https://docs.waveshare.com/ESP32-C6-Touch-AMOLED-1.8',
  }),
  'sensecap-watcher': board({
    id: 'sensecap-watcher',
    label: 'Seeed SenseCAP Watcher',
    chip: 'esp32s3',
    flashMb: 32,
    psramMb: 8,
    display: '1.45" 412×412 round LCD, touch',
    buttons: 'Wheel (press to talk, turn to sleep)',
    capabilities: ['display', 'images', 'ui', 'touch', 'audio', 'push_to_talk', 'tunnel', 'battery_status', 'ota', 'camera'],
    overlays: ['devices/sdkconfig.muse', 'devices/sdkconfig.muse-sensecap-watcher'],
    buildCmd:
      'idf.py -B build-sensecap-watcher -DIDF_TARGET=esp32s3 -DSDKCONFIG=build-sensecap-watcher/sdkconfig -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;devices/sdkconfig.muse;devices/sdkconfig.muse-sensecap-watcher" build',
    flashNote:
      'Back up the factory nvsfactory partition (0x9000, 0x32000) before the first Muse flash; the CH342 bridge needs the paced esptool at 115200. Camera needs CONFIG_MUSE_WATCHER_CAMERA=y and PSRAM.',
  }),
  'm5stack-cardputer-adv': board({
    id: 'm5stack-cardputer-adv',
    label: 'M5Stack Cardputer ADV',
    chip: 'esp32s3',
    flashMb: 8,
    psramMb: null,
    display: '1.14" 240×135 LCD',
    buttons: 'GO/Space (talk), Esc/Enter/arrows (menu)',
    capabilities: ['display', 'ui', 'audio', 'push_to_talk'],
    overlays: ['devices/sdkconfig.muse', 'devices/sdkconfig.muse-m5stack-cardputer-adv'],
    buildCmd: 'tools/muse/board.sh build cardputer-adv',
    experimental: true,
    flashNote:
      'Experimental port (ESP-IDF 6.0.1): voice notes and text replies only - no images, tunnel or SD/IMU/IR. Back up the original 8 MB flash first; download mode is switch-off, hold GO, connect USB, release GO.',
  }),
  'm5stack-sticks3': board({
    id: 'm5stack-sticks3',
    label: 'M5Stack StickS3',
    chip: 'esp32s3',
    flashMb: 8,
    psramMb: 8,
    display: '1.14" 135×240 LCD',
    buttons: 'Front (talk), side (menu), PWR',
    capabilities: ['display', 'images', 'ui', 'audio', 'push_to_talk', 'tunnel', 'ota'],
    overlays: ['devices/sdkconfig.muse', 'devices/sdkconfig.muse-m5stack-sticks3'],
    buildCmd:
      'idf.py -B build-m5stack-sticks3 -DIDF_TARGET=esp32s3 -DSDKCONFIG=build-m5stack-sticks3/sdkconfig -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;devices/sdkconfig.muse;devices/sdkconfig.muse-m5stack-sticks3" build',
    flashNote:
      'Factory UiFlow2 takes over the USB port: unlock it via the REPL snippet in the SDK docs and use --after no-reset until Muse is flashed. Back up the 8 MB flash first. Battery shows voltage only.',
  }),
  'm5stack-stopwatch': board({
    id: 'm5stack-stopwatch',
    label: 'M5Stack StopWatch',
    chip: 'esp32s3',
    flashMb: 16,
    psramMb: 8,
    display: '1.75" 466×466 round AMOLED, touch',
    buttons: 'Yellow (talk), blue (sleep), PWR',
    capabilities: ['display', 'images', 'ui', 'touch', 'audio', 'push_to_talk', 'tunnel', 'battery_status', 'ota'],
    overlays: ['devices/sdkconfig.muse', 'devices/sdkconfig.muse-m5stack-stopwatch'],
    buildCmd:
      'idf.py -B build-m5stack-stopwatch -DIDF_TARGET=esp32s3 -DSDKCONFIG=build-m5stack-stopwatch/sdkconfig -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;devices/sdkconfig.muse;devices/sdkconfig.muse-m5stack-stopwatch" build',
    flashNote: 'Enumerates as the chip\'s own USB serial port - flashing needs nothing special.',
  }),
  'm5stack-cores3': board({
    id: 'm5stack-cores3',
    label: 'M5Stack CoreS3',
    chip: 'esp32s3',
    flashMb: 16,
    psramMb: 8,
    display: '2" 320×240 LCD, touch',
    buttons: 'PWR (talk), RST',
    capabilities: ['display', 'images', 'ui', 'touch', 'audio', 'push_to_talk', 'tunnel', 'battery_status', 'ota'],
    overlays: ['devices/sdkconfig.muse', 'devices/sdkconfig.muse-m5stack-cores3'],
    buildCmd: 'tools/muse/board.sh build cores3',
    flashNote: 'If esptool cannot connect, hold RST for 3 seconds until the green LED lights to enter the bootloader.',
  }),
  'm5stack-stickc-plus2': board({
    id: 'm5stack-stickc-plus2',
    label: 'M5Stack StickC Plus2',
    chip: 'esp32',
    flashMb: 8,
    psramMb: 2,
    display: '1.14" 135×240 LCD',
    buttons: 'Front (talk), side (menu), PWR',
    capabilities: ['display', 'images', 'ui', 'audio', 'push_to_talk', 'tunnel', 'ota'],
    overlays: ['devices/sdkconfig.muse', 'devices/sdkconfig.muse-m5stack-stickc-plus2'],
    buildCmd:
      'idf.py -B build-m5stack-stickc-plus2 -DIDF_TARGET=esp32 -DSDKCONFIG=build-m5stack-stickc-plus2/sdkconfig -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;devices/sdkconfig.muse;devices/sdkconfig.muse-m5stack-stickc-plus2" build',
    flashNote:
      'End of life. CH9102 bridge drops above 230400 baud; back up the 8 MB flash first. Speaker is a small buzzer; battery shows voltage only.',
  }),
};

/** The Linux device SDK turns a Pi or any BLE Linux box into a gadget. */
export const MUSE_LINUX = {
  id: 'linux',
  label: 'Muse Gadgets SDK - Linux',
  boards: [
    {
      id: 'raspberry-pi',
      label: 'Raspberry Pi (3B+, 4, 5, Zero 2 W)',
      notes: ['Bluetooth LE required', 'Raspberry Pi OS Bullseye or later'],
    },
    {
      id: 'linux-ble',
      label: 'Other Linux with Bluetooth LE',
      notes: ['Debian 11 or later, or Ubuntu 22.04 or later', '32-bit and 64-bit both work'],
    },
  ],
  /** What the Linux SDK exposes to Muse. There is no device UI. */
  capabilities: ['system_run', 'file_access', 'device_health'] as MuseCapability[],
  requirements: [
    'An account with sudo on the machine',
    'Already on your network (Wi-Fi pairing needs no password)',
    'An SDK token from gadgets.muse.ai',
  ],
  commands: [
    { id: 'system.run', label: 'Runs a shell command, returns output and exit code' },
    { id: 'file.read', label: 'Reads a file, 64 KB at a time' },
    { id: 'file.write', label: 'Writes a file, 64 KB at a time' },
    { id: 'device.health', label: 'Uptime, load, memory, disk, temperature' },
  ],
  installCmd:
    'curl -fsSL https://raw.githubusercontent.com/facebookincubator/muse-gadget-sdk/main/linux/install.sh -o install.sh',
  pairCmd: 'sudo musegadget pair',
  pairingNote: 'Pairing is open for 10 minutes after install or `musegadget pair`; confirm on the device itself.',
  source: LINUX_DOC,
} as const;

export function museBoard(id: string | undefined): MuseBoard | undefined {
  return id ? MUSE_BOARDS[id] : undefined;
}

export function museLinuxBoard(id: string | undefined) {
  return id ? MUSE_LINUX.boards.find((b) => b.id === id) : undefined;
}

/** Every board id the SDK runs a given target on, for fix text and validation. */
export function museBoardIds(sdk: 'esp32' | 'linux'): string[] {
  return sdk === 'esp32' ? Object.keys(MUSE_BOARDS) : MUSE_LINUX.boards.map((b) => b.id);
}

/** A board that has a capability, for "use this instead" fix text. */
export function museBoardWithCapability(capability: MuseCapability): MuseBoard | undefined {
  return Object.values(MUSE_BOARDS).find((b) => b.capabilities.includes(capability));
}

export { ESP32_DOC, LINUX_DOC, DEVICES_DOC };
