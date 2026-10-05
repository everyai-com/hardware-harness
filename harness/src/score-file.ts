/**
 * Score your own design file.
 *
 * `node src/index.ts score my-design.json` — reads a ProductSpec JSON, applies
 * the same tolerance the web API applies (defaults, case-insensitive enums,
 * numeric strings), and reports every problem with a path before the engine
 * ever sees it.
 *
 * No dependencies. Mirrors web/src/lib/spec-schema.ts — keep the required
 * fields, defaults and enum sets in sync with that file.
 */

import { readFile } from 'node:fs/promises';
import type { ProductSpec } from './engine/types.ts';

export interface SpecIssue {
  path: string;
  message: string;
}

export type SpecResult = { ok: true; spec: ProductSpec } | { ok: false; issues: SpecIssue[] };

const FACES = ['front', 'back', 'left', 'right', 'top', 'bottom', 'internal'];
const PROCESSES = ['fdm', 'resin_sla', 'sls_mjf', 'cnc_3axis', 'sheet_metal', 'pcb_assembly', 'soft_tool', 'injection_molding'];
const PART_TYPES = ['mcu', 'regulator', 'analog_ic', 'passive', 'connector', 'led', 'motor', 'sensor', 'battery', 'mechanical', 'enclosure'];
const DISTRIBUTORS = ['lcsc', 'authorized', 'broker', 'unknown'];
const WIRELESS = ['none', 'bluetooth', 'wifi', 'lte', 'custom'];
const BATTERY = ['none', 'lithium', 'alkaline'];
const SIGNALS = ['power', 'gnd', 'i2c', 'spi', 'uart', 'usb', 'gpio', 'analog', 'rf', 'other'];
const MARKETS = ['us', 'eu', 'uk', 'ca'];
const MUSE_SDKS = ['esp32', 'linux'];
const MUSE_CAPABILITIES = [
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
];

const DEFAULT_BBOX = { x: 20, y: 20, z: 10 };
const DEFAULT_QUANTITIES = [1, 100, 1000];
const MAX_ISSUES = 20;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** "FDM" → "fdm", "resin sla" → "resin_sla". Returns undefined when not a usable string. */
function normalizeEnum(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  return v.trim().toLowerCase().replaceAll(' ', '_');
}

/** Accepts numbers and numeric strings ("1", " 2.5 "). NaN/Infinity/'' → undefined. */
function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design';
}

class Check {
  issues: SpecIssue[] = [];

  get failed(): boolean {
    return this.issues.length > 0;
  }

  bad(path: string, message: string): undefined {
    if (this.issues.length < MAX_ISSUES) this.issues.push({ path, message });
    return undefined;
  }

  str(obj: Record<string, unknown>, key: string, path: string, opts?: { min?: number }): string | undefined {
    const v = obj[key];
    if (typeof v !== 'string' || v.length < (opts?.min ?? 0)) {
      return this.bad(path, `expected a non-empty string, got ${JSON.stringify(v) ?? 'missing'}`);
    }
    return v;
  }

  optStr(obj: Record<string, unknown>, key: string, path: string): string | undefined {
    const v = obj[key];
    if (v === undefined) return undefined;
    if (typeof v !== 'string') return this.bad(path, `expected a string, got ${JSON.stringify(v)}`);
    return v;
  }

  bool(obj: Record<string, unknown>, key: string, path: string, fallback: boolean): boolean {
    const v = obj[key];
    if (v === undefined) return fallback;
    if (typeof v !== 'boolean') {
      this.bad(path, `expected true or false, got ${JSON.stringify(v)}`);
      return fallback;
    }
    return v;
  }

  optBool(obj: Record<string, unknown>, key: string, path: string): boolean | undefined {
    const v = obj[key];
    if (v === undefined) return undefined;
    if (typeof v !== 'boolean') return this.bad(path, `expected true or false, got ${JSON.stringify(v)}`);
    return v;
  }

  num(
    obj: Record<string, unknown>,
    key: string,
    path: string,
    opts: { int?: boolean; min?: number; positive?: boolean; fallback?: number },
  ): number | undefined {
    const v = obj[key];
    if (v === undefined) {
      if (opts.fallback !== undefined) return opts.fallback;
      return this.bad(path, 'is required');
    }
    const n = toNumber(v);
    if (n === undefined) return this.bad(path, `expected a number, got ${JSON.stringify(v)}`);
    if (opts.int && !Number.isInteger(n)) return this.bad(path, `expected a whole number, got ${n}`);
    if (opts.positive && !(n > 0)) return this.bad(path, `expected a positive number, got ${n}`);
    if (opts.min !== undefined && !(n >= opts.min)) return this.bad(path, `expected >= ${opts.min}, got ${n}`);
    return n;
  }

  optNum(
    obj: Record<string, unknown>,
    key: string,
    path: string,
    opts?: { int?: boolean; min?: number; positive?: boolean },
  ): number | undefined {
    if (obj[key] === undefined) return undefined;
    return this.num(obj, key, path, opts ?? {});
  }

  enum(obj: Record<string, unknown>, key: string, path: string, allowed: string[], fallback: string): string {
    const v = obj[key];
    if (v === undefined) return fallback;
    const n = normalizeEnum(v);
    if (n === undefined || !allowed.includes(n)) {
      this.bad(path, `unknown value ${JSON.stringify(v)}; expected one of: ${allowed.join(', ')}`);
      return fallback;
    }
    return n;
  }

  optEnum(obj: Record<string, unknown>, key: string, path: string, allowed: string[]): string | undefined {
    if (obj[key] === undefined) return undefined;
    const n = normalizeEnum(obj[key]);
    if (n === undefined || !allowed.includes(n)) {
      return this.bad(path, `unknown value ${JSON.stringify(obj[key])}; expected one of: ${allowed.join(', ')}`);
    }
    return n;
  }

  arr(obj: Record<string, unknown>, key: string, path: string, fallback: unknown[]): unknown[] {
    const v = obj[key];
    if (v === undefined) return fallback;
    if (!Array.isArray(v)) {
      this.bad(path, `expected an array, got ${JSON.stringify(v)}`);
      return fallback;
    }
    return v;
  }
}

/**
 * Validate unknown JSON into a ProductSpec, filling the same defaults the web
 * API fills. Returns every problem found (up to 20) instead of throwing on
 * the first, so one run fixes the whole file.
 */
export function normalizeSpec(input: unknown): SpecResult {
  const c = new Check();
  if (!isRecord(input)) {
    return { ok: false, issues: [{ path: '', message: 'the spec must be a JSON object' }] };
  }

  const name = c.str(input, 'name', 'name', { min: 1 }) ?? 'unnamed';
  const intent = c.str(input, 'intent', 'intent', { min: 1 }) ?? '';
  const idRaw = c.optStr(input, 'id', 'id');
  const id = idRaw && idRaw.length > 0 ? idRaw : slugify(name);

  const tqRaw = c.arr(input, 'targetQuantities', 'targetQuantities', DEFAULT_QUANTITIES);
  const targetQuantities: number[] = [];
  if (tqRaw.length === 0) c.bad('targetQuantities', 'list at least one quantity, e.g. [1, 100, 1000]');
  tqRaw.forEach((q, i) => {
    const n = toNumber(q);
    if (n === undefined || !Number.isInteger(n) || n <= 0) {
      c.bad(`targetQuantities[${i}]`, `expected a positive whole number, got ${JSON.stringify(q)}`);
    } else {
      targetQuantities.push(n);
    }
  });

  const origin = c.enum(input, 'origin', 'origin', ['china', 'domestic', 'other'], 'china');
  const marketsRaw = c.arr(input, 'markets', 'markets', []);
  const markets = marketsRaw.flatMap((m, i) => {
    const n = normalizeEnum(m);
    if (n === undefined || !MARKETS.includes(n)) {
      c.bad(`markets[${i}]`, `unknown market ${JSON.stringify(m)}; expected one of: ${MARKETS.join(', ')}`);
      return [];
    }
    return [n];
  });

  // Power — all defaults, since most small designs are USB-powered with no radio or battery.
  const powerRaw = input.power === undefined ? {} : input.power;
  if (!isRecord(powerRaw)) c.bad('power', `expected an object, got ${JSON.stringify(input.power)}`);
  const powerRec: Record<string, unknown> = isRecord(powerRaw) ? powerRaw : {};
  const power = {
    mainsInside: c.bool(powerRec, 'mainsInside', 'power.mainsInside', false),
    wireless: c.enum(powerRec, 'wireless', 'power.wireless', WIRELESS, 'none'),
    battery: c.enum(powerRec, 'battery', 'power.battery', BATTERY, 'none'),
    usbPowered: c.bool(powerRec, 'usbPowered', 'power.usbPowered', false),
    externalAdapterCertified: c.optBool(powerRec, 'externalAdapterCertified', 'power.externalAdapterCertified'),
    includesAdapter: c.optBool(powerRec, 'includesAdapter', 'power.includesAdapter'),
    maxWatts: c.optNum(powerRec, 'maxWatts', 'power.maxWatts', { positive: true }),
  };

  const features = c.arr(input, 'features', 'features', []).flatMap((f, i) => {
    const p = `features[${i}]`;
    if (!isRecord(f)) {
      c.bad(p, `expected an object, got ${JSON.stringify(f)}`);
      return [];
    }
    const fid = c.str(f, 'id', `${p}.id`, { min: 1 });
    const label = c.str(f, 'label', `${p}.label`, { min: 1 });
    const expectedFace = c.enum(f, 'expectedFace', `${p}.expectedFace`, FACES, 'front');
    if (fid === undefined || label === undefined) return [];
    return [
      {
        id: fid,
        label,
        expectedFace,
        actualFace: c.optEnum(f, 'actualFace', `${p}.actualFace`, FACES),
        present: c.bool(f, 'present', `${p}.present`, true),
        cosmetic: c.bool(f, 'cosmetic', `${p}.cosmetic`, false),
        note: c.optStr(f, 'note', `${p}.note`),
      },
    ];
  });

  const partsRaw = c.arr(input, 'parts', 'parts', []);
  if (partsRaw.length === 0) c.bad('parts', 'a design needs at least one part');
  const parts = partsRaw.flatMap((p, i) => {
    const path = `parts[${i}]`;
    if (!isRecord(p)) {
      c.bad(path, `expected an object, got ${JSON.stringify(p)}`);
      return [];
    }
    const pid = c.str(p, 'id', `${path}.id`, { min: 1 });
    const label = c.str(p, 'label', `${path}.label`, { min: 1 });
    const material = c.str(p, 'material', `${path}.material`, { min: 1 });
    const qty = c.num(p, 'qty', `${path}.qty`, { int: true, positive: true });
    if (pid === undefined || label === undefined || material === undefined || qty === undefined) return [];
    const kind = c.enum(p, 'kind', `${path}.kind`, ['custom', 'catalog'], 'custom');
    const process = c.enum(p, 'process', `${path}.process`, PROCESSES, 'fdm');

    const bboxRaw = p.bboxMm === undefined ? { ...DEFAULT_BBOX } : p.bboxMm;
    if (!isRecord(bboxRaw)) {
      c.bad(`${path}.bboxMm`, `expected {x, y, z} in mm, got ${JSON.stringify(p.bboxMm)}`);
    }
    const bboxRec: Record<string, unknown> = isRecord(bboxRaw) ? bboxRaw : {};
    const bx = c.num(bboxRec, 'x', `${path}.bboxMm.x`, { positive: true });
    const by = c.num(bboxRec, 'y', `${path}.bboxMm.y`, { positive: true });
    const bz = c.num(bboxRec, 'z', `${path}.bboxMm.z`, { positive: true });

    const sourceRaw = p.source;
    let source = undefined;
    if (sourceRaw !== undefined) {
      if (!isRecord(sourceRaw)) {
        c.bad(`${path}.source`, `expected an object, got ${JSON.stringify(sourceRaw)}`);
      } else {
        source = {
          distributor: c.enum(sourceRaw, 'distributor', `${path}.source.distributor`, DISTRIBUTORS, 'unknown'),
          mpn: c.optStr(sourceRaw, 'mpn', `${path}.source.mpn`),
          inStock: c.optBool(sourceRaw, 'inStock', `${path}.source.inStock`),
          alternates: c.optNum(sourceRaw, 'alternates', `${path}.source.alternates`, { int: true, min: 0 }),
          stockVerified: c.optBool(sourceRaw, 'stockVerified', `${path}.source.stockVerified`),
          partType: c.optEnum(sourceRaw, 'partType', `${path}.source.partType`, PART_TYPES),
        };
      }
    }

    return [
      {
        id: pid,
        label,
        kind,
        process,
        material,
        qty,
        bboxMm: { x: bx ?? DEFAULT_BBOX.x, y: by ?? DEFAULT_BBOX.y, z: bz ?? DEFAULT_BBOX.z },
        solidFraction: c.optNum(p, 'solidFraction', `${path}.solidFraction`, { min: 0.01 }),
        wallMm: c.optNum(p, 'wallMm', `${path}.wallMm`, { positive: true }),
        draftDeg: c.optNum(p, 'draftDeg', `${path}.draftDeg`),
        toleranceMm: c.optNum(p, 'toleranceMm', `${path}.toleranceMm`, { positive: true }),
        internalCornerRadiusMm: c.optNum(p, 'internalCornerRadiusMm', `${path}.internalCornerRadiusMm`, { positive: true }),
        holeToBendMm: c.optNum(p, 'holeToBendMm', `${path}.holeToBendMm`, { positive: true }),
        maxOverhangDeg: c.optNum(p, 'maxOverhangDeg', `${path}.maxOverhangDeg`),
        supportsTouchVisibleFace: c.optBool(p, 'supportsTouchVisibleFace', `${path}.supportsTouchVisibleFace`),
        source,
        purchasePriceUsd: c.optNum(p, 'purchasePriceUsd', `${path}.purchasePriceUsd`, { min: 0 }),
      },
    ];
  });

  const interfaces = c.arr(input, 'interfaces', 'interfaces', []).flatMap((v, i) => {
    const path = `interfaces[${i}]`;
    if (!isRecord(v)) {
      c.bad(path, `expected an object, got ${JSON.stringify(v)}`);
      return [];
    }
    const iid = c.str(v, 'id', `${path}.id`, { min: 1 });
    const clearanceMm = c.num(v, 'clearanceMm', `${path}.clearanceMm`, { min: 0 });
    const between = v.between;
    if (!Array.isArray(between) || between.length !== 2 || typeof between[0] !== 'string' || typeof between[1] !== 'string') {
      c.bad(`${path}.between`, 'expected exactly two part ids, e.g. ["case-top", "case-bottom"]');
    }
    const contributors = c.arr(v, 'contributors', `${path}.contributors`, []);
    if (iid === undefined || clearanceMm === undefined) return [];
    return [
      {
        id: iid,
        between: (Array.isArray(between) ? between.slice(0, 2) : ['', '']) as [string, string],
        clearanceMm,
        contributors: contributors.filter((x): x is string => typeof x === 'string'),
      },
    ];
  });

  const netsRaw = input.nets;
  let nets = undefined;
  if (netsRaw !== undefined) {
    if (!Array.isArray(netsRaw)) {
      c.bad('nets', `expected an array, got ${JSON.stringify(netsRaw)}`);
    } else {
      nets = netsRaw.flatMap((n, i) => {
        const path = `nets[${i}]`;
        if (!isRecord(n)) {
          c.bad(path, `expected an object, got ${JSON.stringify(n)}`);
          return [];
        }
        const nid = c.str(n, 'id', `${path}.id`, { min: 1 });
        const nname = c.str(n, 'name', `${path}.name`, { min: 1 });
        const endpoints = c.arr(n, 'endpoints', `${path}.endpoints`, []);
        if (endpoints.length < 2) c.bad(`${path}.endpoints`, 'a net needs at least two endpoints');
        const eps = endpoints.flatMap((e, j) => {
          if (!isRecord(e) || typeof e.part !== 'string' || e.part.length === 0) {
            c.bad(`${path}.endpoints[${j}]`, 'expected {part, pin?} with a part id');
            return [];
          }
          return [{ part: e.part, pin: typeof e.pin === 'string' ? e.pin : undefined }];
        });
        if (nid === undefined || nname === undefined) return [];
        return [
          {
            id: nid,
            name: nname,
            signal: c.enum(n, 'signal', `${path}.signal`, SIGNALS, 'other'),
            endpoints: eps,
            // 0V is a legitimate ground reference (informational only — the engine never scores it).
            voltage: c.optNum(n, 'voltage', `${path}.voltage`, { min: 0 }),
            note: c.optStr(n, 'note', `${path}.note`),
          },
        ];
      });
    }
  }

  const opsRaw = c.arr(input, 'operations', 'operations', []);
  if (opsRaw.length === 0) c.bad('operations', 'a design needs at least one assembly step');
  const operations = opsRaw.flatMap((o, i) => {
    const path = `operations[${i}]`;
    if (!isRecord(o)) {
      c.bad(path, `expected an object, got ${JSON.stringify(o)}`);
      return [];
    }
    const oid = c.str(o, 'id', `${path}.id`, { min: 1 });
    const label = c.str(o, 'label', `${path}.label`, { min: 1 });
    const minutes = c.num(o, 'minutes', `${path}.minutes`, { min: 0 });
    if (oid === undefined || label === undefined || minutes === undefined) return [];
    return [
      {
        id: oid,
        label,
        minutes,
        improvised: c.bool(o, 'improvised', `${path}.improvised`, false),
        requiresSoldering: c.optBool(o, 'requiresSoldering', `${path}.requiresSoldering`),
        wireCount: c.optNum(o, 'wireCount', `${path}.wireCount`, { int: true, min: 0 }),
      },
    ];
  });

  // Optional top-level claims — validated lightly, passed through.
  const firmwareRaw = input.firmware;
  let firmware = undefined;
  if (firmwareRaw !== undefined) {
    if (!isRecord(firmwareRaw)) {
      c.bad('firmware', `expected an object, got ${JSON.stringify(firmwareRaw)}`);
    } else {
      firmware = {
        provided: c.optBool(firmwareRaw, 'provided', 'firmware.provided'),
        language: c.optStr(firmwareRaw, 'language', 'firmware.language'),
        toolchain: c.optStr(firmwareRaw, 'toolchain', 'firmware.toolchain'),
        builds: c.optBool(firmwareRaw, 'builds', 'firmware.builds'),
        testedOnHardware: c.optBool(firmwareRaw, 'testedOnHardware', 'firmware.testedOnHardware'),
        pinMapMatchesFootprints: c.optBool(firmwareRaw, 'pinMapMatchesFootprints', 'firmware.pinMapMatchesFootprints'),
        dependenciesPinned: c.optBool(firmwareRaw, 'dependenciesPinned', 'firmware.dependenciesPinned'),
        linesApprox: c.optNum(firmwareRaw, 'linesApprox', 'firmware.linesApprox', { int: true, min: 0 }),
      };
    }
  }

  const cadRaw = input.cad;
  let cad = undefined;
  if (cadRaw !== undefined) {
    if (!isRecord(cadRaw)) {
      c.bad('cad', `expected an object, got ${JSON.stringify(cadRaw)}`);
    } else {
      cad = {
        opensClean: c.optBool(cadRaw, 'opensClean', 'cad.opensClean'),
        watertight: c.optBool(cadRaw, 'watertight', 'cad.watertight'),
        requiresManualRepair: c.optBool(cadRaw, 'requiresManualRepair', 'cad.requiresManualRepair'),
        ercClean: c.optBool(cadRaw, 'ercClean', 'cad.ercClean'),
        drcClean: c.optBool(cadRaw, 'drcClean', 'cad.drcClean'),
      };
    }
  }

  const targetRaw = input.target;
  let target = undefined;
  if (targetRaw !== undefined) {
    if (!isRecord(targetRaw)) {
      c.bad('target', `expected an object, got ${JSON.stringify(targetRaw)}`);
    } else {
      const platform = targetRaw.platform;
      if (platform !== 'muse-gadgets') c.bad('target.platform', 'the only supported platform is "muse-gadgets"');
      const sdk = c.enum(targetRaw, 'sdk', 'target.sdk', MUSE_SDKS, 'esp32');
      const board = c.str(targetRaw, 'board', 'target.board', { min: 2 });
      const capsRaw = c.arr(targetRaw, 'capabilities', 'target.capabilities', []);
      const capabilities = capsRaw.flatMap((m, i) => {
        const n = normalizeEnum(m);
        if (n === undefined || !MUSE_CAPABILITIES.includes(n)) {
          c.bad(`target.capabilities[${i}]`, `unknown capability ${JSON.stringify(m)}`);
          return [];
        }
        return [n];
      });
      if (board !== undefined) target = { platform: 'muse-gadgets', sdk, board, capabilities };
    }
  }

  const certsRaw = c.arr(input, 'certificationsBudgeted', 'certificationsBudgeted', []);
  const certificationsBudgeted = certsRaw.filter((x): x is string => typeof x === 'string');

  if (c.failed) return { ok: false, issues: c.issues };

  const spec = {
    id,
    name,
    intent,
    referenceRender: c.optStr(input, 'referenceRender', 'referenceRender'),
    targetRetailUsd: c.optNum(input, 'targetRetailUsd', 'targetRetailUsd', { positive: true }),
    targetQuantities,
    origin,
    markets: markets.length > 0 ? markets : undefined,
    target,
    power,
    features,
    parts,
    interfaces,
    nets,
    operations,
    certificationsBudgeted: certificationsBudgeted.length > 0 ? certificationsBudgeted : undefined,
    requiresSignedDrivers: c.optBool(input, 'requiresSignedDrivers', 'requiresSignedDrivers'),
    costDisclosed: c.optBool(input, 'costDisclosed', 'costDisclosed'),
    firmware,
    cad,
    producedBy: c.optStr(input, 'producedBy', 'producedBy'),
    provenance: c.optStr(input, 'provenance', 'provenance'),
  };
  if (c.failed) return { ok: false, issues: c.issues };
  return { ok: true, spec: spec as unknown as ProductSpec };
}

/** Read a spec file. File-not-found and bad-JSON come back as issues, not throws. */
export async function loadSpecFile(filePath: string): Promise<SpecResult> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch {
    return {
      ok: false,
      issues: [
        {
          path: '<file>',
          message: `cannot read "${filePath}" — run \`score --init\` to print a starter spec`,
        },
      ],
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    const detail = e instanceof Error ? e.message.replace(/^.*?position/, 'at position') : 'invalid JSON';
    return { ok: false, issues: [{ path: '<json>', message: `"${filePath}" is not valid JSON (${detail})` }] };
  }
  return normalizeSpec(json);
}

/** The starter spec text backing `score --init`. Single source: examples/minimal-spec.json. */
export async function starterSpecText(): Promise<string> {
  return readFile(new URL('../examples/minimal-spec.json', import.meta.url), 'utf8');
}
