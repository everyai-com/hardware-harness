/**
 * The DFM rule engine.
 *
 * Takes a ProductSpec, returns findings. Every finding names the rule, why it
 * matters, how to fix it, and which real-world failure it corresponds to.
 */

import { MATERIALS, RULES } from '../knowledge/dfm.ts';
import type { RuleId, Severity } from '../knowledge/dfm.ts';
import { PROCESSES, SURFACE_QUALITY } from '../knowledge/processes.ts';
import { SOURCING_RULES, CERTIFICATIONS } from '../knowledge/compliance.ts';
import { failuresForRule } from '../knowledge/taxonomy.ts';
import type { Part, ProductSpec } from './types.ts';
import { partVolumeCm3, totalPartCount } from './types.ts';

export interface Finding {
  ruleId: RuleId;
  severity: Severity;
  /** Part id, feature id, interface id, or 'product'. */
  subject: string;
  message: string;
  fix: string;
  evidence: string;
  /** Real-world failures this rule has already caught, if known. */
  observed?: string[];
}

const HIGH_RISK_PART_TYPES = new Set(['mcu', 'regulator', 'analog_ic', 'sensor']);

export const PART_COUNT_BUDGET = 15;
export const ASSEMBLY_MINUTE_BUDGET = 20;

/**
 * Material minimum wall thickness is a moulding constraint - resin printing a
 * 1.2mm PMMA part is fine, injection moulding it is not. Only tooled processes
 * inherit the material limit.
 */
export function minWallFor(process: ProcessLike, material?: { minWallMm: number }): number {
  const tooled = process.id === 'soft_tool' || process.id === 'injection_molding' || process.id === 'injection_molding_multicavity';
  return tooled ? Math.max(process.minWallMm, material?.minWallMm ?? 0) : process.minWallMm;
}

interface ProcessLike {
  id: string;
  minWallMm: number;
}

export function checkDFM(spec: ProductSpec): Finding[] {
  const findings: Finding[] = [];
  const push = (
    ruleId: RuleId,
    subject: string,
    message: string,
    fix: string,
    severityOverride?: Severity,
  ) => {
    const rule = RULES[ruleId];
    const observed = failuresForRule(ruleId).map((f) => `${f.label} - ${f.evidence}`);
    findings.push({
      ruleId,
      severity: severityOverride ?? rule.severity,
      subject,
      message,
      fix,
      evidence: rule.evidence,
      observed: observed.length ? observed : undefined,
    });
  };

  // ---- per part ------------------------------------------------------------
  for (const part of spec.parts) {
    const proc = PROCESSES[part.process];
    if (!proc) continue;
    // A bought part is not made by a process, so process-capability limits do not
    // apply to it. Only sourcing rules do.
    const bought = part.kind === 'catalog' || part.purchasePriceUsd !== undefined;
    const material = MATERIALS[part.material];
    const minWall = minWallFor(proc, material);

    if (!bought && part.wallMm !== undefined && part.wallMm < minWall) {
      push(
        'WALL_TOO_THIN',
        part.id,
        `${part.label}: wall ${part.wallMm}mm is below the ${minWall}mm minimum for ${proc.label}${material ? ` in ${material.label}` : ''}.`,
        `Thicken to >= ${minWall}mm, or switch process (SLS holds 0.8mm, CNC 0.8mm).`,
      );
    }

    if (!bought && proc.minDraftDeg > 0) {
      const draft = part.draftDeg ?? 0;
      if (draft < proc.minDraftDeg) {
        push(
          'DRAFT_MISSING',
          part.id,
          `${part.label}: ${draft}deg draft on a ${proc.label} tool (needs >= ${proc.minDraftDeg}deg).`,
          'Add draft, or move to a tool-less process (SLS/CNC) if the volume does not justify a tool.',
        );
      }
    }

    if (!bought && part.supportsTouchVisibleFace && proc.supportsOnVisibleSurfaces) {
      push(
        'SUPPORT_ON_VISIBLE_SURFACE',
        part.id,
        `${part.label}: support material lands on a cosmetic face.`,
        'Reorient the part, split it, or move to SLS/MJF (no supports, clean finish).',
      );
    } else if (!bought && part.maxOverhangDeg !== undefined && part.maxOverhangDeg > proc.maxOverhangDeg && proc.supportsOnVisibleSurfaces) {
      push(
        'OVERHANG_NEEDS_SUPPORT',
        part.id,
        `${part.label}: overhang ${part.maxOverhangDeg}deg exceeds the ${proc.maxOverhangDeg}deg limit for ${proc.label}.`,
        'Add a chamfer, reorient, or use SLS/MJF.',
      );
    }

    for (const feat of bought ? [] : part.features ?? []) {
      if (feat.sizeMm < proc.minFeatureMm) {
        push(
          'FEATURE_BELOW_MINIMUM',
          part.id,
          `${part.label}/${feat.label}: ${feat.sizeMm}mm ${feat.kind} is below the ${proc.minFeatureMm}mm minimum for ${proc.label}.`,
          `Increase to >= ${proc.minFeatureMm}mm or pick a tighter process.`,
        );
      }
    }

    if (!bought && part.toleranceMm !== undefined && part.toleranceMm < proc.toleranceMm) {
      push(
        'TOLERANCE_UNACHIEVABLE',
        part.id,
        `${part.label}: calls for +/-${part.toleranceMm}mm but ${proc.label} holds +/-${proc.toleranceMm}mm.`,
        `Relax to +/-${proc.toleranceMm}mm, or move to CNC (+/-${PROCESSES.cnc_3axis.toleranceMm}mm) / resin (+/-${PROCESSES.resin_sla.toleranceMm}mm).`,
      );
    }

    if (!bought && part.process === 'cnc_3axis' && part.internalCornerRadiusMm !== undefined && part.internalCornerRadiusMm < 1.5) {
      push(
        'SHARP_INTERNAL_CORNER',
        part.id,
        `${part.label}: internal corner radius ${part.internalCornerRadiusMm}mm is smaller than a practical cutter.`,
        'Model the corner at >= the cutter radius (typically 1.5-3mm) and let the mating part absorb the difference.',
      );
    }

    if (!bought && part.process === 'sheet_metal' && part.holeToBendMm !== undefined && part.holeToBendMm < (part.wallMm ?? 1) * 1.5) {
      push(
        'HOLE_TOO_CLOSE_TO_BEND',
        part.id,
        `${part.label}: hole is ${part.holeToBendMm}mm from a bend (needs >= 1.5x material thickness).`,
        'Move the hole further from the bend or add a relief notch.',
      );
    }

    // Cosmetic surface vs process finish quality
    const cosmeticFace = !bought && (part.visibleFaces?.length ?? 0) > 0;
    if (cosmeticFace && SURFACE_QUALITY[part.process] <= 2) {
      push(
        'SURFACE_QUALITY_MISMATCH',
        part.id,
        `${part.label}: visible face finished by ${proc.label} (surface quality ${SURFACE_QUALITY[part.process]}/5).`,
        'Resin, SLS with dye, CNC or a moulded part for anything the customer looks at directly.',
      );
    }

    // Catalog part sourcing integrity
    if (part.kind === 'catalog' && part.source) {
      const src = part.source;
      const highRisk = src.partType !== undefined && HIGH_RISK_PART_TYPES.has(src.partType);
      if (highRisk && src.distributor !== 'authorized' && src.distributor !== 'lcsc') {
        push(
          'COUNTERFEIT_RISK',
          part.id,
          `${part.label}: ${src.partType} sourced from ${src.distributor === 'broker' ? 'a marketplace/broker channel (AliExpress, eBay)' : `'${src.distributor}'`}. This part class is among the most counterfeited: ${SOURCING_RULES.highRiskPartTypes.join(', ')}.`,
          'Source programmable, analog and precision parts from an authorised distributor (DigiKey/Mouser/Arrow/Avnet). The 5-15% premium is the price of not shipping a fake.',
        );
      } else if (highRisk && src.distributor === 'lcsc') {
        push(
          'COUNTERFEIT_RISK',
          part.id,
          `${part.label}: ${src.partType} via LCSC. Acceptable for passives and Asia-specific parts, risky for MCUs and analog ICs.`,
          'Move MCU/regulator/analog lines to an authorised distributor; keep passives on LCSC.',
          'warn',
        );
      }
      if (!src.inStock || src.stockVerified === false) {
        push(
          'MOQ_MISMATCH',
          part.id,
          `${part.label}: stock not verified. The order cannot be placed as specified.`,
          'Verify live stock and lead time before quoting the customer.',
        );
      }
      if ((src.alternates ?? 0) < 1 && highRisk) {
        push(
          'NO_SECOND_SOURCE',
          part.id,
          `${part.label}: no verified drop-in alternate.`,
          'Add a second source or accept that one stock-out stalls the build.',
        );
      }
    }
  }

  // ---- interfaces ----------------------------------------------------------
  for (const iface of spec.interfaces) {
    const contributors = iface.contributors
      .map((id) => spec.parts.find((p) => p.id === id))
      .filter((p): p is Part => Boolean(p));
    const stack = contributors.reduce((sum, p) => sum + (p.toleranceMm ?? PROCESSES[p.process].toleranceMm / 2), 0);
    // Worst case: every contributor deviates in the direction that closes the gap.
    if (stack > iface.clearanceMm) {
      push(
        'TOLERANCE_STACK',
        iface.id,
        `${iface.id}: contributors stack to +/-${stack.toFixed(2)}mm against a ${iface.clearanceMm}mm clearance. Worst case is an interference fit.`,
        'Increase clearance, tighten the tightest contributor, or add an adjustment feature (slot, shim, oversized hole).',
      );
    }
  }

  // ---- whole product -------------------------------------------------------
  const partCount = totalPartCount(spec);
  if (partCount > PART_COUNT_BUDGET) {
    push(
      'PART_COUNT_HIGH',
      'product',
      `${partCount} parts against a budget of ${PART_COUNT_BUDGET}.`,
      'Consolidate: combine brackets into the housing, use captive features instead of separate clips, cut fasteners.',
    );
  }

  for (const op of spec.operations) {
    if (op.improvised) {
      push(
        'IMPROVISED_OPERATION',
        op.id,
        `"${op.label}" is an improvised operation, not a build step.`,
        'Design the part so the operation is unnecessary - file-to-fit and structural epoxy are design failures.',
      );
    }
  }

  const assemblyMinutes = estimateAssemblyMinutes(spec);
  if (assemblyMinutes > ASSEMBLY_MINUTE_BUDGET) {
    push(
      'ASSEMBLY_TIME_HIGH',
      'product',
      `Estimated assembly ${assemblyMinutes} min against a budget of ${ASSEMBLY_MINUTE_BUDGET} min.`,
      'Reduce part count and fasteners; snap-fit where serviceability allows (and note the repairability cost).',
    );
  }

  // Mains, lithium, certification
  if (spec.power.mainsInside) {
    push(
      'MAINS_INSIDE_PRODUCT',
      'product',
      'Mains voltage inside the product.',
      'Move mains outside: run from a certified external USB-C adapter. That removes a per-product safety listing.',
    );
  }
  if (spec.power.battery === 'lithium') {
    push(
      'LITHIUM_CELL',
      'product',
      'Lithium cell in the build.',
      'Drop the battery; UN38.3 attaches to the cell and shipping becomes its own project.',
    );
  }

  const requiredCerts = requiredCertifications(spec);
  const budgeted = new Set(spec.certificationsBudgeted ?? []);
  const unbudgeted = requiredCerts.filter((id) => !budgeted.has(id));
  if (unbudgeted.length) {
    // Only the unbudgeted certifications count towards the gap.
    const costs = unbudgeted
      .map((id) => CERTIFICATIONS.find((c) => c.id === id))
      .filter(Boolean)
      .map((c) => c!.costUsd)
      .filter((c): c is [number, number] => Boolean(c));
    const low = costs.reduce((s, c) => s + c[0], 0);
    const high = costs.reduce((s, c) => s + c[1], 0);
    push(
      'CERT_GAP',
      'product',
      `Required but not budgeted: ${unbudgeted.join(', ')}${costs.length ? ` (published cost ${usd(low)}-${usd(high)})` : ''}.`,
      'Budget it, or remove the trigger (external certified adapter for mains, pre-certified module for radio).',
    );
  }

  if (spec.cad?.requiresManualRepair) {
    push(
      'RENDER_CAD_DIVERGENCE',
      'product',
      'The CAD requires manual repair before it can be manufactured.',
      'The design is not finished. Re-export clean, watertight, parametric geometry.',
    );
  }

  // Feature intent - the face-on-the-back class of failure
  for (const feat of spec.features) {
    if (!feat.present) {
      push(
        'RENDER_CAD_DIVERGENCE',
        feat.id,
        `Feature "${feat.label}" from the reference is missing from the design.`,
        'Add the feature or record explicitly that it was dropped, with the reason.',
      );
      continue;
    }
    if (feat.actualFace && feat.actualFace !== feat.expectedFace) {
      push(
        'FEATURE_MISPLACED',
        feat.id,
        `"${feat.label}" is on the ${feat.actualFace} face; the reference puts it on the ${feat.expectedFace}.`,
        `Move it to the ${feat.expectedFace}. Geometry can be perfect and the design still wrong.`,
      );
    }
  }

  // Electronics need a board, and a described battery needs to exist in the BOM.
  const electronicParts = spec.parts.filter((p) => {
    const t = p.source?.partType;
    return t !== undefined && ['mcu', 'regulator', 'analog_ic', 'sensor', 'led', 'connector', 'battery'].includes(t);
  });
  const hasBoard = spec.parts.some(
    (p) => p.kind === 'custom' && /pcb|board/i.test(`${p.id} ${p.label} ${(p.notes ?? []).join(' ')}`),
  );
  if (electronicParts.length >= 3 && !hasBoard) {
    push(
      'ELECTRONICS_WITHOUT_PCB',
      'product',
      `${electronicParts.length} electronic parts with interconnections described, but no board in the bill of materials.`,
      'Add the board: 2-layer at JLCPCB/PCBWay is ~$2-6 for 5 pieces with 2-day production, and they can place the parts. Route the module onto it instead of hand-wiring.',
    );
  }
  if (spec.power.battery === 'lithium' && !spec.parts.some((p) => p.source?.partType === 'battery')) {
    push(
      'MISSING_POWER_SOURCE',
      'product',
      'A lithium battery is referenced but no cell is listed in the bill of materials.',
      'Add the cell (capacity, dimensions, connector) and check it fits the enclosure volume before ordering anything else.',
    );
  }

  // ---- firmware ------------------------------------------------------------
  const fw = spec.firmware;
  if (electronicParts.length >= 2) {
    if (!fw || fw.provided === false) {
      push(
        'FIRMWARE_MISSING',
        'firmware',
        `${electronicParts.length} electronic parts and no firmware shipped with the design.`,
        'Ship the firmware with the board. "Flash the firmware" is not an instruction if no firmware exists.',
      );
    } else {
      if (fw.builds === false) {
        push(
          'FIRMWARE_DOES_NOT_BUILD',
          'firmware',
          'The firmware has never compiled.',
          'Compile it before anyone orders parts. A build error is the cheapest failure there is and it is being skipped.',
        );
      }
      if (fw.pinMapMatchesFootprints === false) {
        push(
          'PINMAP_MISMATCH',
          'firmware',
          'The firmware pin map contradicts the board footprints.',
          'Reconcile the two. This is the most common reason a first article powers on and does nothing.',
        );
      }
      if (fw.dependenciesPinned === false) {
        push(
          'LIBRARIES_UNPINNED',
          'firmware',
          'Library or SDK versions are not pinned.',
          'Pin them. Otherwise the build that worked last month will not build today.',
          'warn',
        );
      }
      if (fw.pinMapMatchesFootprints !== false && fw.testedOnHardware !== true) {
        push(
          'FIRMWARE_UNTESTED',
          'firmware',
          'The firmware has never run on real hardware.',
          'This is the last unverifiable claim before the build. It resolves only when the parts arrive and someone flashes it.',
          'warn',
        );
      }
    }
  }

  if (spec.costDisclosed === false) {
    push(
      'COST_NOT_DISCLOSED',
      'product',
      'No landed cost was published with this design.',
      'Publish cost at qty 1 / 100 / 1000. It is the first question every buyer asks.',
    );
  }

  return findings;
}

export function requiredCertifications(spec: ProductSpec): string[] {
  const out: string[] = [];
  const p = spec.power;
  const markets = spec.markets ?? ['us'];

  if (p.mainsInside) out.push('ul_etl_mains');
  if (p.wireless === 'bluetooth' || p.wireless === 'wifi' || p.wireless === 'lte') out.push('fcc_radio');
  else if (p.wireless === 'custom') out.push('fcc_licensed');
  else if (hasElectronics(spec)) out.push('fcc_unintentional');

  // A shipped mains adapter needs its own listing. A product that simply charges over
  // USB-C has no mains in the box, so it does not.
  if (p.usbPowered && p.includesAdapter && !p.externalAdapterCertified && !p.mainsInside) {
    out.push('ul_etl_mains');
  }
  if (p.battery === 'lithium') out.push('un383');

  // Market access follows where you sell, not where you source.
  if (markets.includes('eu') || markets.includes('uk')) {
    out.push('eu_ce');
    if (markets.includes('eu')) out.push('eu_gpsr');
  }
  return [...new Set(out)];
}

function hasElectronics(spec: ProductSpec): boolean {
  return spec.parts.some((p) => {
    const t = p.source?.partType;
    return t === 'mcu' || t === 'regulator' || t === 'analog_ic' || t === 'led' || t === 'sensor' || t === 'connector';
  });
}

/** Assembly estimate: explicit operations if given, otherwise derived from the parts list. */
export function estimateAssemblyMinutes(spec: ProductSpec): number {
  if (spec.operations.length) {
    return Math.round(spec.operations.reduce((sum, o) => sum + o.minutes, 0));
  }
  const parts = totalPartCount(spec);
  const fasteners = spec.parts.reduce((n, p) => n + (p.id.toLowerCase().includes('screw') || p.label.toLowerCase().includes('screw') ? p.qty : 0), 0);
  const wires = spec.operations.reduce((n, o) => n + (o.wireCount ?? 0), 0);
  return Math.round(parts * 0.75 + fasteners * 1.5 + wires * 2 + 5);
}

function usd(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}
