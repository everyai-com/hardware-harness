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
import { CERTIFICATIONS, DEFECT_RATE_REALITY, PRICING_GUIDANCE } from '../knowledge/compliance.ts';
import type { ProductSpec } from './types.ts';
import { partVolumeCm3, totalPartCount } from './types.ts';
import { estimateAssemblyMinutes } from './dfm-check.ts';
import { materialCostUsd, unitProcessCostUsd } from './process-select.ts';

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
  breakdown: CostLine[];
  grossMarginPct?: number;
}

export interface CostReport {
  quantities: UnitCost[];
  assumptions: string[];
  uncertaintyPct: number;
  hiddenLinesFlagged: string[];
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

  const certCostLow = (spec.certificationsBudgeted ?? [])
    .map((id) => CERTIFICATIONS.find((c) => c.id === id))
    .filter(Boolean)
    .filter((c) => c!.costUsd)
    .reduce((s, c) => s + c!.costUsd![0], 0);

  const quantities = spec.targetQuantities.length ? spec.targetQuantities : [1, 100, 1000];

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
    // One minimum charge per process per order, however many parts that process makes.
    const processesUsed = new Set(spec.parts.filter((p) => p.purchasePriceUsd === undefined).map((p) => p.process));
    let floors = 0;
    for (const id of processesUsed) {
      const proc = PROCESSES[id];
      if (!proc) continue;
      const procPartsTotal = spec.parts
        .filter((p) => p.process === id && p.purchasePriceUsd === undefined)
        .reduce((sum, p) => sum + unitProcessCostUsd(p, proc, qty, false) * p.qty, 0);
      if (procPartsTotal < proc.floorPriceUsd) floors += proc.floorPriceUsd - procPartsTotal;
    }
    partsTotal += floors;
    const toolingAmortized = toolingTotal / qty;

    breakdown.push({
      label: 'Parts (process + material)',
      usd: round(partsTotal),
      note: `${totalPartCount(spec)} parts, qty ${qty}`,
    });
    if (toolingAmortized > 0) {
      breakdown.push({
        label: 'Tooling amortisation',
        usd: round(toolingAmortized),
        note: `${usd(toolingTotal)} of tooling spread over ${qty} units`,
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

    // Freight
    const massKg = spec.parts.reduce(
      (g, p) => g + partVolumeCm3(p) * (p.kind === 'catalog' ? 1.5 : 1) * p.qty,
      0,
    ) / 1000;
    const air = qty < 200;
    const freightPerUnit = massKg * (air ? estimate(HIDDEN_COSTS.airFreightPerKgUsd) : 1.5);
    breakdown.push({
      label: air ? 'Air freight' : 'Sea freight',
      usd: round(freightPerUnit),
      note: `${massKg.toFixed(2)} kg/unit, ${air ? 'air express' : 'sea LCL'}`,
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
    const certAmortized = certCostLow > 0 ? round(certCostLow / qty) : 0;
    if (certAmortized > 0) {
      breakdown.push({
        label: 'Certification amortisation',
        usd: certAmortized,
        note: `${usd(certCostLow)} of certification spread over ${qty} units - required to sell, not to build`,
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
  if (certCostLow > 0) hiddenLinesFlagged.push('Certification per unit - the smaller the run, the worse it looks');
  hiddenLinesFlagged.push('Per-unit assembly labour - the margin killer at qty 1');
  hiddenLinesFlagged.push('Defect/remake reserve - custom goods get remade, not returned');

  return {
    quantities: results,
    assumptions: [
      `Labour at $${laborRate}/hr.`,
      `Inspection at ~$${estimate(LABOR_AND_QC.inspectionPerManDayUsd)}/man-day, AQL ${LABOR_AND_QC.aqlPct}, batches of 50+.`,
      'Process rates are calibrated to published 2026 ranges; treat as +/-40%.',
      `Pricing floor: ${PRICING_GUIDANCE.quote} Target ${PRICING_GUIDANCE.targetGrossMarginPct}% gross margin, about ${PRICING_GUIDANCE.retailMultiplierOnParts}x parts cost at retail.`,
      `Defect reserve is set to ${options.defectReservePct ?? HIDDEN_COSTS.defectReservePct}%. First products should be modelled at ${DEFECT_RATE_REALITY.firstProductPct}%.`,
      `Origin: ${origin}. Duty applied to parts + tooling assist + freight.`,
    ],
    uncertaintyPct: 40,
    hiddenLinesFlagged,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
