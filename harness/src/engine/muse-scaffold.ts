/**
 * Muse Gadgets build kit generator.
 *
 * Turns a Muse-targeted ProductSpec into the files a builder needs: the
 * sdkconfig overlay that carries the design's config deltas, a README with the
 * exact commands for this board, design.json for agents, and a setup script.
 *
 * It does not generate firmware, and it does not touch a board. The upstream
 * SDK is the firmware; this configures it, verifies against its documented
 * board matrix, and hands over a build sheet. Compiling and flashing stay on
 * the builder's machine, where the hardware is.
 */

import type { ProductSpec } from './types.ts';
import { MUSE_SDK, MUSE_LINUX, MUSE_BOARDS, MUSE_OTA_DEFAULT_OFF, museBoard, museLinuxBoard } from '../knowledge/platforms.ts';
import type { MuseBoard } from '../knowledge/platforms.ts';

export interface MuseScaffoldBoard {
  id: string;
  label: string;
  chip?: string;
  flashMb?: number;
  psramMb?: number | null;
  display?: string | null;
  buttons?: string;
  capabilities: string[];
}

export interface MuseScaffoldCommands {
  /** Fetch the upstream SDK. */
  clone: string;
  /** Install the pinned toolchain (ESP32 only - the Linux SDK is an install). */
  espIdf?: string;
  /** Build (ESP32) or install (Linux). */
  build: string;
  /** Flash and open the serial monitor (ESP32) or open pairing (Linux). */
  flash: string;
  /** Fresh start: erase the whole flash (ESP32 only). */
  erase?: string;
}

export interface MuseScaffold {
  sdk: 'esp32' | 'linux';
  board: MuseScaffoldBoard;
  files: Record<string, string>;
  commands: MuseScaffoldCommands;
  capabilities: { asked: string[]; supported: string[]; gaps: string[] };
  notes: string[];
}

const ESP_IDF_DIR = '~/esp/esp-idf-v6';
const INSTALL_URL = `${MUSE_SDK.repo.replace('github.com', 'raw.githubusercontent.com')}/main/linux/install.sh`;

function espIdfInstall(chip: string): string {
  return [
    `git clone -b ${MUSE_SDK.espIdf} --recursive https://github.com/espressif/esp-idf.git ${ESP_IDF_DIR}`,
    `${ESP_IDF_DIR}/install.sh ${chip}`,
    `. ${ESP_IDF_DIR}/export.sh   # run this in every new terminal you build from`,
  ].join('\n');
}

/** The design's config deltas, using only config keys the SDK documents. */
function configDeltas(spec: ProductSpec, preset: MuseBoard): string[] {
  const asked = spec.target?.capabilities ?? [];
  const deltas: string[] = [];
  if (preset.id === 'sensecap-watcher' && asked.includes('camera')) deltas.push('CONFIG_MUSE_WATCHER_CAMERA=y');
  if (asked.includes('ota') && MUSE_OTA_DEFAULT_OFF.has(preset.id)) deltas.push('CONFIG_HOMEHUB_OTA_ENABLED=y');
  return deltas.sort();
}

interface BuildPlan {
  build: string;
  flash: string;
  erase: string;
}

/**
 * Build/flash commands for the board, in the SDK's documented forms:
 * tools/board.sh where the SDK ships a board script, the explicit idf.py
 * invocation (with the overlay chain) where it does not or where this design
 * adds config deltas.
 */
function esp32BuildPlan(preset: MuseBoard, hasDeltas: boolean, overlay: string): BuildPlan {
  const erase = 'idf.py -p PORT erase-flash';

  if (preset.buildCmd.startsWith('tools/')) {
    const flash = preset.buildCmd.startsWith('tools/muse/board.sh build ')
      ? `${preset.buildCmd.replace('tools/muse/board.sh build ', 'tools/muse/board.sh flash ')} PORT`
      : `${preset.buildCmd.replace(' build', ' flash-monitor')} PORT`;
    return { build: preset.buildCmd, flash, erase };
  }

  if (!hasDeltas) {
    return {
      build: preset.buildCmd,
      flash: preset.buildCmd.replace(/ build$/, ' -p PORT flash monitor'),
      erase,
    };
  }

  const dir = `build-${preset.id}`;
  const chain = ['sdkconfig.defaults', ...preset.overlays, `muse-design/${overlay}`].join(';');
  const flags = `-B ${dir} -DIDF_TARGET=${preset.chip} -DSDKCONFIG=${dir}/sdkconfig -DSDKCONFIG_DEFAULTS="${chain}"`;
  return { build: `idf.py ${flags} build`, flash: `idf.py ${flags} -p PORT flash monitor`, erase };
}

function shellBlock(command: string): string {
  return ['```sh', command, '```'].join('\n');
}

function partsSection(spec: ProductSpec): string {
  const rows = spec.parts.map((p) => {
    const source = p.source?.mpn ?? (p.kind === 'custom' ? p.process : '-');
    return `| ${p.label} | ${p.kind} | ${p.qty} | ${source} |`;
  });
  return ['| Part | Kind | Qty | Source |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

function operationsSection(spec: ProductSpec): string {
  return spec.operations.map((o, i) => `${i + 1}. ${o.label} (${o.minutes} min)`).join('\n');
}

function capabilityTable(asked: string[], supported: string[]): string {
  const rows = asked.map((c) => `| ${c} | yes | ${supported.includes(c) ? 'yes' : '**no**'} |`);
  return ['| Capability | Design asks | Board supports |', '| --- | --- | --- |', ...rows].join('\n');
}

function overlayFile(spec: ProductSpec, preset: MuseBoard, deltas: string[]): string {
  const chain = ['sdkconfig.defaults', ...preset.overlays, `sdkconfig.${spec.id}`].join(';');
  const lines = [
    `# ${spec.name} - Muse Gadgets config overlay`,
    `# Board: ${preset.label} (${preset.chip})`,
    '#',
    '# Loaded on top of the SDK defaults and the board overlay, in this order:',
    `#   SDKCONFIG_DEFAULTS="${chain}"`,
    '#',
    '# Only documented ESP32 Device SDK keys are used here.',
  ];
  if (deltas.length === 0) {
    lines.push('#', '# This design needs no config changes: the stock board settings are the build.');
  } else {
    lines.push('', ...deltas);
  }
  lines.push(
    '',
    '# Strongly recommended for a shipped device (burns an eFuse HMAC key on first boot):',
    '# CONFIG_HOMEHUB_NVS_ENCRYPTION=y',
  );
  return lines.join('\n') + '\n';
}

function esp32Readme(spec: ProductSpec, preset: MuseBoard, scaffold: Omit<MuseScaffold, 'files'>): string {
  const { commands, capabilities } = scaffold;
  const asked = capabilities.asked;
  const extras = capabilities.supported.filter((c) => !asked.includes(c));
  const overlay = `sdkconfig.${spec.id}`;
  const hasDeltas = configDeltas(spec, preset).length > 0;
  const toolchain = spec.firmware?.toolchain ?? '(not declared)';
  const toolchainOk = /esp[-_ ]?idf/i.test(toolchain) && /6\.0\.1/.test(toolchain);

  return [
    `# ${spec.name} - Muse Gadget build kit`,
    '',
    spec.intent,
    '',
    `**Target board:** ${preset.label} · ${preset.chip} · ${preset.flashMb} MB flash${preset.psramMb ? ` / ${preset.psramMb} MB PSRAM` : ' / no PSRAM'}${preset.display ? ` · ${preset.display}` : ''}`,
    `**SDK:** Muse Gadgets ESP32 Device SDK · ESP-IDF ${MUSE_SDK.espIdf} only (${MUSE_SDK.repo}, ${MUSE_SDK.license})`,
    `**Firmware claim:** ${toolchain}${toolchainOk ? '' : ` - pin ESP-IDF ${MUSE_SDK.espIdf}; "Other versions aren't supported"`}`,
    '',
    '## 1. Get an SDK token',
    '',
    `Every gadget needs one, including one you build for yourself: ${MUSE_SDK.tokenUrl} (read the terms first: ${MUSE_SDK.termsUrl}). Treat it as an identifier, not a password - it ships inside the firmware.`,
    '',
    '## 2. Install ESP-IDF ' + MUSE_SDK.espIdf,
    '',
    shellBlock(commands.espIdf ?? ''),
    '',
    '## 3. Get the SDK',
    '',
    shellBlock(commands.clone),
    '',
    '## 4. Apply this design\'s overlay',
    '',
    hasDeltas
      ? `Copy \`${overlay}\` into \`esp32/devices/\`. It carries this design's config deltas; the build command below appends it to the board's documented overlay chain.`
      : `\`${overlay}\` documents this design's configuration. It needs no changes for ${preset.label} - the stock board settings are the build.`,
    '',
    '```sh',
    `cp ${overlay} muse-gadget-sdk/esp32/devices/`,
    '```',
    '',
    '## 5. Build',
    '',
    shellBlock(commands.build),
    '',
    `Set your token first: \`idf.py menuconfig\` → **ESP32 Device SDK > Muse Gadgets SDK token** (and delete the build directory if you change any sdkconfig file, so it takes effect).`,
    '',
    '## 6. Flash and monitor',
    '',
    shellBlock(commands.flash),
    '',
    'Replace `PORT` with your board\'s (`ls /dev/cu.usb*` on macOS, `/dev/ttyACM*` or `/dev/ttyUSB*` on Linux). To start completely fresh: `' + (commands.erase ?? '') + '`.',
    ...(preset.flashNote ? ['', `> **Before you flash:** ${preset.flashNote}`] : []),
    '',
    '## 7. Pair with Muse',
    '',
    '1. In the Muse app: **Settings > Devices > Developer mode** on.',
    '2. **Settings > Devices > Add Device** (the **+** icon) and look for `' + MUSE_SDK.devicePrefix + '-XXXXXX`.',
    '3. When the light breathes **blue**, press the board\'s talk/confirm button. The light turns **green** when Muse is connected.',
    '',
    'Light states: orange breathing = ready to set up, blue = joining Wi-Fi, yellow blinking = reconnecting, purple = not paired, red blinking = check the log. Pairing has no manufacturer verification - set it up on a network you trust.',
    '',
    '## Assembling the design',
    '',
    partsSection(spec),
    '',
    operationsSection(spec),
    '',
    '## Design capabilities vs this board',
    '',
    capabilityTable(asked, capabilities.supported),
    ...(extras.length ? ['', `Also on this board: ${extras.join(', ')}.`] : []),
    ...(capabilities.gaps.length
      ? ['', `**Gaps:** ${capabilities.gaps.join(', ')} - the harness flags these as findings; drop them or move boards.`]
      : []),
    '',
    '## Notes',
    '',
    ...scaffold.notes.map((n) => `- ${n}`),
    '',
    '---',
    '',
    `Generated by Blinky from a verified design spec. Upstream SDK: ${MUSE_SDK.repo} · community: ${MUSE_SDK.community} · builds: ${MUSE_SDK.communityBuilds}`,
  ].join('\n') + '\n';
}

function linuxReadme(spec: ProductSpec, scaffold: Omit<MuseScaffold, 'files'>): string {
  const { commands, capabilities } = scaffold;
  return [
    `# ${spec.name} - Muse Gadget build kit (Linux)`,
    '',
    spec.intent,
    '',
    `**Target:** ${capabilities.supported.join(', ')} - the Linux Device SDK turns a Linux machine into a gadget (${MUSE_SDK.repo}, ${MUSE_SDK.license}).`,
    `**Requirements:** ${MUSE_LINUX.requirements.join('; ')}.`,
    '',
    '## 1. Get an SDK token',
    '',
    `${MUSE_SDK.tokenUrl} - every gadget needs one. Read the terms: ${MUSE_SDK.termsUrl}.`,
    '',
    '## 2. Install on the machine',
    '',
    shellBlock(`${commands.clone}\ncd muse-gadget-sdk/linux\n${commands.build}`),
    '',
    'Read `install.sh` before you run it (short version: it installs into `/opt/musegadget`, starts the service, and asks before giving Muse your account).',
    '',
    '## 3. Pair with Muse',
    '',
    'Developer mode on → **Settings > Devices > Add Device** → `' + MUSE_SDK.devicePrefix + 'XXXXXX` → continue when Muse warns it is a community device. Pairing is open for 10 minutes; reopen it with `' + MUSE_LINUX.pairCmd + '`.',
    '',
    '## What Muse can do',
    '',
    ...MUSE_LINUX.commands.map((c) => `- \`${c.id}\` - ${c.label}`),
    '',
    'Programs on the machine can post into a Muse chat with `musegadget send-user-msg "..."` (no credentials of their own).',
    '',
    '## Design capabilities vs this target',
    '',
    capabilityTable(capabilities.asked, capabilities.supported),
    ...(capabilities.gaps.length ? ['', `**Gaps:** ${capabilities.gaps.join(', ')}.`] : []),
    '',
    '## Notes',
    '',
    ...scaffold.notes.map((n) => `- ${n}`),
    '',
    '---',
    '',
    `Generated by Blinky. Upstream SDK: ${MUSE_SDK.repo}`,
  ].join('\n') + '\n';
}

function setupScript(commands: MuseScaffoldCommands, overlay: string | null): string {
  const lines = [
    '#!/usr/bin/env sh',
    '# Muse Gadgets build kit - sets up the upstream SDK for this design.',
    '# No SDK token is included here: set yours in menuconfig (see README).',
    'set -eu',
    '',
    `REPO="${MUSE_SDK.repo}.git"`,
    'DEST="${1:-muse-gadget-sdk}"',
    '',
    'if [ ! -d "$DEST" ]; then',
    '  git clone --depth 1 "$REPO" "$DEST"',
    'fi',
  ];
  if (overlay) {
    lines.push(`cp "${overlay}" "$DEST/esp32/devices/"`, 'echo "SDK ready at $DEST/esp32"');
  } else {
    lines.push('echo "SDK ready at $DEST"');
  }
  lines.push('', `echo "Build:  ${commands.build}"`, `echo "Flash:  ${commands.flash}"`, '');
  return lines.join('\n');
}

function designJson(spec: ProductSpec, scaffold: Omit<MuseScaffold, 'files'>, generatedAt: string): string {
  return JSON.stringify(
    {
      generator: 'Blinky',
      generatedAt,
      sdk: { id: MUSE_SDK.id, repo: MUSE_SDK.repo, license: MUSE_SDK.license, espIdf: MUSE_SDK.espIdf },
      target: spec.target,
      board: scaffold.board,
      capabilities: scaffold.capabilities,
      commands: scaffold.commands,
      notes: scaffold.notes,
      spec,
    },
    null,
    2,
  ) + '\n';
}

const SHARED_NOTES = [
  `The SDK token ships inside the firmware - treat it as an identifier, not a password. If it leaks, revoke it at ${MUSE_SDK.tokenUrl} and rebuild.`,
  'Builds are signed with the included development key and never enable Secure Boot, so you can reflash your board as often as you like.',
  'Strongly recommended: enable NVS encryption (CONFIG_HOMEHUB_NVS_ENCRYPTION) - Wi-Fi credentials and device tokens are stored in flash, and the key derives from an eFuse HMAC key generated on first boot.',
];

/**
 * Build the kit for a Muse-targeted spec. Throws when the spec has no Muse
 * target or the board is not on the SDK's published list - the caller decides
 * how to surface that (MCP error, HTTP 400).
 */
export function buildMuseScaffold(spec: ProductSpec, opts: { generatedAt?: string } = {}): MuseScaffold {
  const target = spec.target;
  if (!target || target.platform !== 'muse-gadgets') {
    throw new Error('This design has no Muse Gadgets target. Set spec.target = { platform: "muse-gadgets", sdk, board } first.');
  }
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const asked = target.capabilities ?? [];

  if (target.sdk === 'linux') {
    const linuxBoard = museLinuxBoard(target.board);
    if (!linuxBoard) {
      throw new Error(
        `Board '${target.board}' is not on the Muse Gadgets Linux list (${MUSE_LINUX.boards.map((b) => b.id).join(', ')}).`,
      );
    }
    const supported = [...MUSE_LINUX.capabilities];
    const scaffold: Omit<MuseScaffold, 'files'> = {
      sdk: 'linux',
      board: { id: linuxBoard.id, label: linuxBoard.label, capabilities: supported },
      commands: {
        clone: `git clone --depth 1 ${MUSE_SDK.repo}.git`,
        build: `${MUSE_LINUX.installCmd} && bash install.sh --sdk-token mgst_\u2026`,
        flash: MUSE_LINUX.pairCmd,
      },
      capabilities: { asked, supported, gaps: asked.filter((c) => !supported.includes(c)) },
      notes: [
        ...SHARED_NOTES,
        'Muse gets the same access to the machine as the account you install it for - use an account without sudo if you want to limit it.',
      ],
    };
    return {
      ...scaffold,
      files: {
        'README.md': linuxReadme(spec, scaffold),
        'design.json': designJson(spec, scaffold, generatedAt),
        'setup.sh': setupScript(scaffold.commands, null),
      },
    };
  }

  const preset = museBoard(target.board);
  if (!preset) {
    throw new Error(
      `Board '${target.board}' is not on the Muse Gadgets ESP32 list (${Object.keys(MUSE_BOARDS).join(', ')}).`,
    );
  }

  const deltas = configDeltas(spec, preset);
  const overlay = `sdkconfig.${spec.id}`;
  const plan = esp32BuildPlan(preset, deltas.length > 0, overlay);
  const supported = [...preset.capabilities];
  const scaffold: Omit<MuseScaffold, 'files'> = {
    sdk: 'esp32',
    board: {
      id: preset.id,
      label: preset.label,
      chip: preset.chip,
      flashMb: preset.flashMb,
      psramMb: preset.psramMb,
      display: preset.display,
      buttons: preset.buttons,
      capabilities: supported,
    },
    commands: {
      clone: `git clone --depth 1 ${MUSE_SDK.repo}.git`,
      espIdf: espIdfInstall(preset.chip),
      build: plan.build,
      flash: plan.flash,
      erase: plan.erase,
    },
    capabilities: { asked, supported, gaps: asked.filter((c) => !supported.includes(c)) },
    notes: [...SHARED_NOTES, ...(preset.flashNote ? [preset.flashNote] : [])],
  };

  return {
    ...scaffold,
    files: {
      'README.md': esp32Readme(spec, preset, scaffold),
      'design.json': designJson(spec, scaffold, generatedAt),
      [overlay]: overlayFile(spec, preset, deltas),
      'setup.sh': setupScript(scaffold.commands, overlay),
    },
  };
}
