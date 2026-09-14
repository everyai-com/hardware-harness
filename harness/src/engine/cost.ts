/**
 * Landed cost engine.
 *
 * The number nobody publishes. Includes the lines that appear in no AI-generated
 * BOM: tooling amortisation, duty after de minimis, inspection, signed drivers,
 * certification per unit, and the defect reserve.
 *
 * Everything is an estimate, labelled as such, with the uncertainty stated.
 */

import { PROCESSES } from '../knowledge/processes.ts';
import {
  HIDDEN_COSTS,
  LABOR_AND_QC,
  TARIFF_2026,
  dutyMultiplier,
  estimate,
} from '../knowledge/economics.ts';
import { MATERIALS } from '../knowledge/dfm.ts';
import { CERTIFICATIONS, DEFECT_RATE_REALITY, PRICING_GUIDANCE } from '../knowledge/compliance.ts';
import type { CertRequirement } from '../knowledge/compliance.ts';
import type { ProductSpec } from './types.ts';
import { partVolumeCm3, totalPartCount } from './types.ts';
import { estimateAssemblyMinutes } from './dfm-check.ts';
import { unitProcessCostUsd } from './process-select.ts';
import { round, usd, usdWhole } from './util.ts';

/**
 * Density assumed for bought modules whose material is not a moulding resin
 * (`n/a` in a BOM). Small boards and connectors land near 1.2 g/cm3.
 */
const ASSUMED_MODULE_DENSITY_G_PER_CM3 = 1.2;

/** Tooling above this share of the unit cost is called out as its own finding. */
export const TOOLING_SHARE_ALERT_PCT = 20;

export interface CostLine {
  label: string;
  usd: number;
  note?: string;
}

export interface UnitCost {
  quantity: number;
  /** Fully-loaded unit cost if you are SELLING it (includes certification amortisation). */
  unitUsd: number;
  /** Total order value at this quantity. */
  orderTotalUsd: number;
  /** What it costs to BUILD one, excluding the cost of selling it legally. */
  personalBuildUsd: number;
  /** The certification share of `unitUsd`. */
  complianceAmortizedUsd: number;
  /** Tooling amortisation as a share of the unit cost. */
  toolingSharePct: number;
  breakdown: CostLine[];
  grossMarginPct?: number;
}

export interface CostReport {
  quantities: UnitCost[];
  assumptions: string[];
  uncertaintyPct: number;
  hiddenLinesFlagged: string[];
  /** Published certification range, and the midpoint the unit cost is built on. */
  certification: {
    lowUsd: number;
    highUsd: number;
    estimateUsd: number;
    /** Required certifications with no reliable public price - budget a placeholder. */
    unpriced: string[];
  };
}

export interface CostOptions {
  laborRatePerHourUsd?: number;
  origin?: 'china' | 'domestic' | 'other';
  /**
   * Remake/return reserve. Defaults to the mature-product rate. Pass
   * DEFECT_RATE_REALITY.firstProductPct (15) for a first product - that is the
   * rate Adafruit's hardware guide warns founders to expect.
   */
  defectReservePct?: number;
}

export function landedCost(spec: ProductSpec, options: CostOptions = {}): CostReport {
  const laborRate = options.laborRatePerHourUsd ?? 35;
  const origin = options.origin ?? spec.origin;
  const duty = dutyMultiplier(origin);
  const assemblyMinutes = estimateAssemblyMinutes(spec);

  const budgetedCertifications = (spec.certificationsBudgeted ?? [])
    .map((id) => CERTIFICATIONS.find((c) => c.id === id))
    .filter((c): c is CertRequirement => Boolean(c));
  const pricedCertifications = budgetedCertifications.filter((c) => c.costUsd);
  const certCostLow = pricedCertifications.reduce((s, c) => s + c.costUsd![0], 0);
  const certCostHigh = pricedCertifications.reduce((s, c) => s + c.costUsd![1], 0);
  // Published ranges are booked at the midpoint, like every other ranged input in
  // this engine. Booking the low bound silently made every margin optimistic.
  const certCostEstimate = round((certCostLow + certCostHigh) / 2);
  const unpricedCertifications = budgetedCertifications.filter((c) => !c.costUsd).map((c) => c.label);

  const quantities = spec.targetQuantities.length ? spec.targetQuantities : [1, 100, 1000];
  const massKg = estimatedMassKg(spec);
  const volumeCbm = (totalVolumeCm3(spec) * HIDDEN_COSTS.packingVoidFactor) / 1_000_000;

  const results: UnitCost[] = quantities.map((qty) => {
    const breakdown: CostLine[] = [];

    // Parts: bought parts at their own price; made parts via the process model.
    let partsTotal = 0;
    let toolingTotal = 0;
    for (const part of spec.parts) {
      const process = PROCESSES[part.process];
      if (!process) continue;
      if (part.purchasePriceUsd !== undefined) {
        partsTotal += part.purchasePriceUsd * part.qty;
        continue; // bought parts carry no tooling and are not re-priced by volume
      }
      // Price without the per-order minimum, then apply one minimum per process below.
      partsTotal += unitProcessCostUsd(part, process, qty, false) * part.qty;
      toolingTotal += estimate(process.toolingUsd);
    }

    // A per-order minimum is charged once per order, however many parts that process
    // makes - so it is compared against the order's whole spend on that process and
    // then spread over the units. Charging the full minimum to every unit made a $5
    // print minimum add $5/unit at qty 1000.
    const processesUsed = new Set(spec.parts.filter((p) => p.purchasePriceUsd === undefined).map((p) => p.process));
    let floorsPerUnit = 0;
    for (const id of processesUsed) {
      const proc = PROCESSES[id];
      if (!proc) continue;
      const procUnitSpend = spec.parts
        .filter((p) => p.process === id && p.purchasePriceUsd === undefined)
        .reduce((sum, p) => sum + unitProcessCostUsd(p, proc, qty, false) * p.qty, 0);
      const procOrderSpend = procUnitSpend * qty;
      if (procOrderSpend < proc.floorPriceUsd) {
        floorsPerUnit += (proc.floorPriceUsd - procOrderSpend) / qty;
      }
    }
    partsTotal += floorsPerUnit;
    const toolingAmortized = toolingTotal / qty;

    breakdown.push({
      label: 'Parts (process + material)',
      usd: round(partsTotal),
      note: `${totalPartCount(spec)} parts, qty ${qty}${floorsPerUnit > 0 ? `, incl. ${usd(floorsPerUnit)}/unit of order minimum` : ''}`,
    });
    if (toolingAmortized > 0) {
      breakdown.push({
        label: 'Tooling amortisation',
        usd: round(toolingAmortized),
        note: `${usdWhole(toolingTotal)} of tooling spread over ${qty} units`,
      });
    }

    // Assembly labour
    const assembly = round((assemblyMinutes / 60) * laborRate);
    breakdown.push({
      label: 'Assembly labour',
      usd: assembly,
      note: `${assemblyMinutes} min at $${laborRate}/hr - per-unit labour has no economies of scale`,
    });

    // Inspection (third party, batches only)
    let inspection = 0;
    if (qty >= 50) {
      const manDays = Math.max(1, Math.ceil(qty / 500));
      inspection = round((estimate(LABOR_AND_QC.inspectionPerManDayUsd) * manDays) / qty);
      breakdown.push({
        label: 'Pre-shipment inspection (AQL 2.5)',
        usd: inspection,
        note: `${manDays} man-day(s) at ~$${estimate(LABOR_AND_QC.inspectionPerManDayUsd)}/day`,
      });
    }

    // Freight: air is priced per kg, sea per cubic metre. Both come from measured
    // part volume and real material density, not a volume-equals-mass proxy.
    const air = qty < 200;
    const freightPerUnit = air
      ? massKg * estimate(HIDDEN_COSTS.airFreightPerKgUsd)
      : volumeCbm * estimate(HIDDEN_COSTS.seaFreightPerCbmUsd);
    breakdown.push({
      label: air ? 'Air freight' : 'Sea freight',
      usd: round(freightPerUnit),
      note: air
        ? `${massKg.toFixed(2)} kg/unit at ~$${estimate(HIDDEN_COSTS.airFreightPerKgUsd)}/kg, air express`
        : `${volumeCbm.toFixed(4)} m3/unit at ~$${estimate(HIDDEN_COSTS.seaFreightPerCbmUsd)}/m3, sea LCL`,
    });

    // Duty
    const preDuty = partsTotal + toolingAmortized + freightPerUnit;
    const dutyUsd = round(preDuty * (duty - 1));
    if (dutyUsd > 0) {
      breakdown.push({
        label: `Duty & tariffs (${origin})`,
        usd: dutyUsd,
        note: `De minimis ended ${TARIFF_2026.deMinimisEndedChinaHk} for China/HK; effective ${TARIFF_2026.effectiveDutyPctConsumer[0]}-${TARIFF_2026.effectiveDutyPctConsumer[1]}% all-in`,
      });
    }

    // Certification is a one-off cost of SELLING, not of building. Track it separately
    // so a personal build is not priced as if it needed an FCC filing.
    const certAmortized = certCostEstimate > 0 ? round(certCostEstimate / qty) : 0;
    if (certAmortized > 0) {
      breakdown.push({
        label: 'Certification amortisation',
        usd: certAmortized,
        note: `${usdWhole(certCostLow)}-${usdWhole(certCostHigh)} published, booked at the ${usdWhole(certCostEstimate)} midpoint, spread over ${qty} units - required to sell, not to build`,
      });
    }

    // Signed drivers - the invisible line
    const drivers = spec.requiresSignedDrivers
      ? round(estimate(HIDDEN_COSTS.signedDriverUsd) / qty)
      : 0;
    if (drivers > 0) {
      breakdown.push({
        label: 'Signed driver development',
        usd: drivers,
        note: `$${HIDDEN_COSTS.signedDriverUsd[0]}-${HIDDEN_COSTS.signedDriverUsd[1]} one-off; exceeds the BOM on small-batch audio hardware`,
      });
    }

    // Packaging
    const packaging = round(estimate(HIDDEN_COSTS.packagingPerUnitUsd));
    breakdown.push({ label: 'Packaging', usd: packaging });

    // Goods cost = what it costs to make one more unit. Risk percentages apply here,
    // not to one-off amortised costs, or the numbers compound into nonsense.
    const goodsBase =
      partsTotal + toolingAmortized + assembly + inspection + freightPerUnit + dutyUsd + drivers + packaging;
    const defectPct = options.defectReservePct ?? HIDDEN_COSTS.defectReservePct;
    const defects = round(goodsBase * (defectPct / 100));
    breakdown.push({
      label: `Defect/remake reserve (${defectPct}%)`,
      usd: defects,
      note: defectPct < DEFECT_RATE_REALITY.firstProductPct
        ? `Mature-product rate. A first product should be modelled at ${DEFECT_RATE_REALITY.firstProductPct}% - see Adafruit's guide.`
        : undefined,
    });
    const payment = round(goodsBase * (HIDDEN_COSTS.paymentProcessingPct / 100));
    breakdown.push({ label: `Payment processing (${HIDDEN_COSTS.paymentProcessingPct}%)`, usd: payment });

    const unitUsd = round(goodsBase + defects + payment + certAmortized);

    const result: UnitCost = {
      quantity: qty,
      unitUsd,
      orderTotalUsd: round(unitUsd * qty),
      personalBuildUsd: round(unitUsd - certAmortized),
      complianceAmortizedUsd: certAmortized,
      toolingSharePct: unitUsd > 0 ? round((toolingAmortized / unitUsd) * 100) : 0,
      breakdown: breakdown.filter((l) => l.usd > 0),
    };
    if (spec.targetRetailUsd) {
      result.grossMarginPct = round(((spec.targetRetailUsd - unitUsd) / spec.targetRetailUsd) * 100);
    }
    return result;
  });

  const hiddenLinesFlagged: string[] = [];
  if (spec.requiresSignedDrivers) hiddenLinesFlagged.push('Signed drivers ($500-1,000) - invisible in every generated BOM');
  if (origin === 'china') hiddenLinesFlagged.push('Duty after de minimis repeal - not in the factory quote');
  if (certCostEstimate > 0) hiddenLinesFlagged.push('Certification per unit - the smaller the run, the worse it looks');
  for (const label of unpricedCertifications) {
    hiddenLinesFlagged.push(`${label} required but has no published price - budget a placeholder`);
  }
  hiddenLinesFlagged.push('Per-unit assembly labour - the margin killer at qty 1');
  hiddenLinesFlagged.push('Defect/remake reserve - custom goods get remade, not returned');
  const overTooled = results.filter((r) => r.toolingSharePct > TOOLING_SHARE_ALERT_PCT);
  if (overTooled.length) {
    hiddenLinesFlagged.push(
      `Tooling is more than ${TOOLING_SHARE_ALERT_PCT}% of the unit cost at qty ${overTooled.map((r) => r.quantity).join(', ')} - you are subsidising the tool`,
    );
  }

  return {
    quantities: results,
    assumptions: [
      `Labour at $${laborRate}/hr.`,
      `Inspection at ~$${estimate(LABOR_AND_QC.inspectionPerManDayUsd)}/man-day, AQL ${LABOR_AND_QC.aqlPct}, batches of 50+.`,
      'Process rates are calibrated to published 2026 ranges; treat as +/-40%.',
      `Freight: air at ~$${estimate(HIDDEN_COSTS.airFreightPerKgUsd)}/kg under 200 units, sea at ~$${estimate(HIDDEN_COSTS.seaFreightPerCbmUsd)}/m3 above it, on ${massKg.toFixed(2)} kg and ${volumeCbm.toFixed(4)} m3 per unit.`,
      `Certification is booked at the midpoint of the published range, and reported as a range in the breakdown.`,
      `Pricing floor: ${PRICING_GUIDANCE.quote} Target ${PRICING_GUIDANCE.targetGrossMarginPct}% gross margin, about ${PRICING_GUIDANCE.retailMultiplierOnParts}x parts cost at retail.`,
      `Defect reserve is set to ${options.defectReservePct ?? HIDDEN_COSTS.defectReservePct}%. First products should be modelled at ${DEFECT_RATE_REALITY.firstProductPct}%.`,
      `Origin: ${origin}. Duty applied to parts + tooling assist + freight.`,
    ],
    uncertaintyPct: 40,
    hiddenLinesFlagged,
    certification: {
      lowUsd: certCostLow,
      highUsd: certCostHigh,
      estimateUsd: certCostEstimate,
      unpriced: unpricedCertifications,
    },
  };
}

/** Estimated shipping mass: measured part volume against the real material density. */
export function estimatedMassKg(spec: ProductSpec): number {
  const grams = spec.parts.reduce((g, p) => {
    const density = MATERIALS[p.material]?.densityGPerCm3 ?? ASSUMED_MODULE_DENSITY_G_PER_CM3;
    return g + partVolumeCm3(p) * density * p.qty;
  }, 0);
  return grams / 1000;
}

/** Total solid volume of one product, cm3. */
export function totalVolumeCm3(spec: ProductSpec): number {
  return spec.parts.reduce((v, p) => v + partVolumeCm3(p) * p.qty, 0);
}
