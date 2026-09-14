/**
 * Business model arithmetic.
 *
 * Hardware has one yardstick that software does not: gross profit per hour of human
 * labour. Per-unit labour has no economies of scale, so any model that hides labour
 * inside "COGS" is telling you a story. This makes the labour explicit and prices it.
 */

import { landedCost } from './cost.ts';
import type { UnitCost } from './cost.ts';
import { estimateAssemblyMinutes } from './dfm-check.ts';
import type { ProductSpec } from './types.ts';
import { round, usd } from './util.ts';

export interface ModelInputs {
  id: string;
  label: string;
  description: string;
  /** What the customer pays, USD. */
  unitPriceUsd: number;
  /** Either give a spec (unit cost is computed) or a direct unit cost. */
  spec?: ProductSpec;
  /** Quantity at which unit cost is computed. Defaults to the spec's smallest. */
  costAtQuantity?: number;
  unitCostOverrideUsd?: number;
  /** Minutes of YOUR hands-on time per unit. Defaults to the spec's estimate. */
  labourMinutesOverride?: number;
  /** Units per month. */
  monthlyVolume: number;
  /** Hosting, software, insurance, storage. */
  fixedMonthlyCostUsd: number;
  /**
   * Hours per month that do not scale with units - development, maintenance,
   * support engineering, marketing. Software models hide all their labour here,
   * which is why per-unit-only arithmetic flatters them.
   */
  fixedMonthlyLabourHours?: number;
}

export interface ModelOutcome {
  id: string;
  label: string;
  description: string;
  unitPriceUsd: number;
  unitCostUsd: number;
  grossProfitPerUnitUsd: number;
  grossMarginPct: number;
  labourMinutesPerUnit: number;
  monthly: {
    revenueUsd: number;
    cogsUsd: number;
    grossProfitUsd: number;
    labourHours: number;
  };
  annualGrossProfitUsd: number;
  /** The number that decides whether this is a business or a hobby. */
  grossProfitPerLabourHourUsd: number;
  verdict: 'viable' | 'marginal' | 'unviable';
  /** What has to be true for this to work. */
  requirement: string;
  blocker?: string;
}

/** The margin a hardware model has to clear, and the per-hour floor that beats contract work. */
export const TARGET_GROSS_MARGIN_PCT = 40;
export const VIABLE_PROFIT_PER_HOUR_USD = 40;
/** Prices are quoted to the nearest $5 - a $137.40 price is a spreadsheet, not a decision. */
const PRICE_ROUNDING_USD = 5;

/**
 * Costed quantity nearest to the one asked for. The quantity does not have to be one
 * of the spec's own target quantities - a caller asking for 250 on a spec priced at
 * 1/100/1000 must get a real figure back, not a crash and not zero.
 */
export function costEntry(spec: ProductSpec, qty: number): UnitCost {
  const report = landedCost(spec);
  const quantities = report.quantities.length ? report.quantities : [];
  const nearest = quantities.reduce(
    (best, q) => (Math.abs(q.quantity - qty) < Math.abs(best.quantity - qty) ? q : best),
    quantities[0],
  );
  return nearest;
}

export function costAt(spec: ProductSpec, qty: number): number {
  return costEntry(spec, qty).unitUsd;
}

export function evaluateModel(inputs: ModelInputs): ModelOutcome {
  const spec = inputs.spec;
  const qty = inputs.costAtQuantity ?? (spec ? spec.targetQuantities[0] : 1);
  const cost = inputs.unitCostOverrideUsd ?? (spec ? costAt(spec, qty) : 0);
  const labourMinutes = inputs.labourMinutesOverride ?? (spec ? estimateAssemblyMinutes(spec) : 0);

  const grossProfitPerUnit = round(inputs.unitPriceUsd - cost);
  const grossMarginPct = inputs.unitPriceUsd > 0 ? round((grossProfitPerUnit / inputs.unitPriceUsd) * 100) : 0;
  const monthlyRevenue = round(inputs.unitPriceUsd * inputs.monthlyVolume);
  const monthlyCogs = round(cost * inputs.monthlyVolume);
  const monthlyGrossProfit = round((grossProfitPerUnit * inputs.monthlyVolume) - inputs.fixedMonthlyCostUsd);
  const variableHours = (labourMinutes * inputs.monthlyVolume) / 60;
  // 1-decimal rounding: hours to one place reads better in the table than 2.
  const labourHours = Math.round((variableHours + (inputs.fixedMonthlyLabourHours ?? 0)) * 10) / 10;
  // Same base as the monthly column above: fixed monthly cost is already sunk, and
  // quoting a per-hour figure on a different base than the profit next to it made
  // every model read slightly better than its own table.
  const profitPerHour = labourHours > 0 ? round(monthlyGrossProfit / labourHours) : 0;

  let verdict: ModelOutcome['verdict'] = 'unviable';
  let blocker: string | undefined;
  if (grossMarginPct < 15) {
    verdict = 'unviable';
    blocker = `Gross margin ${grossMarginPct}% at ${usd(inputs.unitPriceUsd)}. Below 15% there is nothing left to run the business on.`;
  } else if (profitPerHour < VIABLE_PROFIT_PER_HOUR_USD) {
    verdict = 'marginal';
    blocker = `Only ${usd(profitPerHour)} of gross profit per hour of your own labour. Below ~$${VIABLE_PROFIT_PER_HOUR_USD}/hr this does not beat contract work.`;
  } else if (monthlyGrossProfit <= 0) {
    verdict = 'marginal';
    blocker = `Monthly gross profit is negative at ${inputs.monthlyVolume} units/month after fixed costs.`;
  } else {
    verdict = 'viable';
  }

  return {
    id: inputs.id,
    label: inputs.label,
    description: inputs.description,
    unitPriceUsd: inputs.unitPriceUsd,
    unitCostUsd: cost,
    grossProfitPerUnitUsd: grossProfitPerUnit,
    grossMarginPct,
    labourMinutesPerUnit: labourMinutes,
    monthly: {
      revenueUsd: monthlyRevenue,
      cogsUsd: monthlyCogs,
      grossProfitUsd: monthlyGrossProfit,
      labourHours,
    },
    annualGrossProfitUsd: round(monthlyGrossProfit * 12),
    grossProfitPerLabourHourUsd: profitPerHour,
    verdict,
    requirement: requirementFor(inputs, grossMarginPct, profitPerHour),
    blocker,
  };
}

function requirementFor(inputs: ModelInputs, margin: number, perHour: number): string {
  const needs: string[] = [];
  if (margin < TARGET_GROSS_MARGIN_PCT) {
    // margin = (price - cost) / price, so cost = price * (1 - margin) and the price
    // that clears the target is cost / (1 - target).
    const unitCost = inputs.unitPriceUsd * (1 - margin / 100);
    const requiredPrice = unitCost / (1 - TARGET_GROSS_MARGIN_PCT / 100);
    const rounded = Math.ceil(requiredPrice / PRICE_ROUNDING_USD) * PRICE_ROUNDING_USD;
    needs.push(`price at ${usd(rounded)} to clear ${TARGET_GROSS_MARGIN_PCT}% margin`);
  }
  if (perHour < VIABLE_PROFIT_PER_HOUR_USD && inputs.monthlyVolume > 0 && perHour > 0) {
    const neededVolume = Math.ceil(
      (VIABLE_PROFIT_PER_HOUR_USD / perHour) * inputs.monthlyVolume,
    );
    needs.push(`about ${neededVolume} units/month, or design the labour out`);
  }
  if (needs.length === 0) return 'Holds as specified. The constraint now is demand, not arithmetic.';
  return needs.join('; ');
}

/**
 * The four models, evaluated against real specs from this project.
 * Every number traces to a fixture or to a stated price.
 */
export function compareModels(specs: { lamp: ProductSpec; voiceNote: ProductSpec; voiceNoteFixed: ProductSpec }): ModelOutcome[] {
  const lampCost = costEntry(specs.lamp, 1).personalBuildUsd;
  const voiceCost = costEntry(specs.voiceNote, 100).unitUsd;
  const voiceFixedCost = costEntry(specs.voiceNoteFixed, 1000).unitUsd;

  return [
    evaluateModel({
      id: 'consumer-electronics',
      label: 'Sell low-volume consumer electronics',
      description: 'The generated voice note-taker, sold at its target retail price.',
      unitPriceUsd: 79,
      unitCostOverrideUsd: voiceCost,
      labourMinutesOverride: estimateAssemblyMinutes(specs.voiceNote),
      monthlyVolume: 50,
      fixedMonthlyCostUsd: 200,
    }),
    evaluateModel({
      id: 'rebuilt-electronics',
      label: 'The same product rebuilt around one assembled board',
      description: 'Identical function, one PCBA instead of 18 hand-soldered wires. The labour is the difference, and it is the whole difference.',
      unitPriceUsd: 79,
      unitCostOverrideUsd: voiceFixedCost,
      labourMinutesOverride: estimateAssemblyMinutes(specs.voiceNoteFixed),
      monthlyVolume: 50,
      fixedMonthlyCostUsd: 200,
    }),
    evaluateModel({
      id: 'premium-no-electronics',
      label: 'Sell premium objects with no electronics',
      description: 'The lamp, printed and finished by hand, priced into the designer-object band. No radio, no cell, no certification.',
      unitPriceUsd: 149,
      unitCostOverrideUsd: round(lampCost + 12), // + shipping and packaging at one-off volumes
      labourMinutesOverride: 35,
      monthlyVolume: 40,
      fixedMonthlyCostUsd: 150,
    }),
    evaluateModel({
      id: 'verified-builds',
      label: "Verified builds for other people's designs",
      description: 'A design arrives, you score it, build it, time it and publish the receipt.',
      unitPriceUsd: 300,
      unitCostOverrideUsd: 60, // parts + freight for a typical small object
      labourMinutesOverride: 240, // scoring, sourcing, build, documentation
      monthlyVolume: 8,
      fixedMonthlyCostUsd: 150,
    }),
    evaluateModel({
      id: 'harness-seats-early',
      label: 'Harness seats - early (20 studios)',
      description: 'The engine sold as a seat, before anyone knows it exists. The honest starting point.',
      unitPriceUsd: 99,
      unitCostOverrideUsd: 4,
      labourMinutesOverride: 6,
      monthlyVolume: 20,
      fixedMonthlyCostUsd: 500,
      fixedMonthlyLabourHours: 40, // building the product, maintaining it, finding customers
    }),
    evaluateModel({
      id: 'harness-seats-scale',
      label: 'Harness seats - at scale (100 studios)',
      description: 'The same product once distribution exists. Software scales labour away, which is the whole appeal.',
      unitPriceUsd: 99,
      unitCostOverrideUsd: 4,
      labourMinutesOverride: 6,
      monthlyVolume: 100,
      fixedMonthlyCostUsd: 900,
      fixedMonthlyLabourHours: 40,
    }),
  ];
}
