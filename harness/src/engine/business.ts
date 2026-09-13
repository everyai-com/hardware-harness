/**
 * Business model arithmetic.
 *
 * Hardware has one yardstick that software does not: gross profit per hour of human
 * labour. Per-unit labour has no economies of scale, so any model that hides labour
 * inside "COGS" is telling you a story. This makes the labour explicit and prices it.
 */

import { landedCost } from './cost.ts';
import { estimateAssemblyMinutes } from './dfm-check.ts';
import type { ProductSpec } from './types.ts';

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

export function evaluateModel(inputs: ModelInputs): ModelOutcome {
  const spec = inputs.spec;
  const qty = inputs.costAtQuantity ?? (spec ? spec.targetQuantities[0] : 1);
  const cost = inputs.unitCostOverrideUsd ?? (spec ? landedCost(spec).quantities.find((q) => q.quantity === qty)!.unitUsd : 0);
  const labourMinutes = inputs.labourMinutesOverride ?? (spec ? estimateAssemblyMinutes(spec) : 0);

  const grossProfitPerUnit = round(inputs.unitPriceUsd - cost);
  const grossMarginPct = inputs.unitPriceUsd > 0 ? round((grossProfitPerUnit / inputs.unitPriceUsd) * 100) : 0;
  const monthlyRevenue = round(inputs.unitPriceUsd * inputs.monthlyVolume);
  const monthlyCogs = round(cost * inputs.monthlyVolume);
  const monthlyGrossProfit = round((grossProfitPerUnit * inputs.monthlyVolume) - inputs.fixedMonthlyCostUsd);
  const variableHours = (labourMinutes * inputs.monthlyVolume) / 60;
  const labourHours = round(variableHours + (inputs.fixedMonthlyLabourHours ?? 0), 1);
  const profitPerHour = labourHours > 0 ? round((grossProfitPerUnit * inputs.monthlyVolume) / labourHours) : 0;

  let verdict: ModelOutcome['verdict'] = 'unviable';
  let blocker: string | undefined;
  if (grossMarginPct < 15) {
    verdict = 'unviable';
    blocker = `Gross margin ${grossMarginPct}% at ${usd(inputs.unitPriceUsd)}. Below 15% there is nothing left to run the business on.`;
  } else if (profitPerHour < 40) {
    verdict = 'marginal';
    blocker = `Only ${usd(profitPerHour)} of gross profit per hour of your own labour. Below ~$40/hr this does not beat contract work.`;
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
  if (margin < 40) needs.push(`price above ${usd(Math.ceil(inputs.unitPriceUsd * (0.4 / Math.max(margin, 1)) / 5) * 5)} for a 40% margin`);
  if (perHour < 40 && inputs.monthlyVolume > 0) {
    const target = 40;
    const current = perHour;
    if (current > 0) needs.push(`about ${Math.ceil((target / current) * inputs.monthlyVolume)} units/month, or design the labour out`);
  }
  if (needs.length === 0) return 'Holds as specified. The constraint now is demand, not arithmetic.';
  return needs.join('; ');
}

/**
 * The four models, evaluated against real specs from this project.
 * Every number traces to a fixture or to a stated price.
 */
export function compareModels(specs: { lamp: ProductSpec; voiceNote: ProductSpec; voiceNoteFixed: ProductSpec }): ModelOutcome[] {
  const lampCost = landedCost(specs.lamp).quantities.find((q) => q.quantity === 1)!.personalBuildUsd;
  const voiceCost = landedCost(specs.voiceNote).quantities.find((q) => q.quantity === 100)!.unitUsd;
  const voiceFixedCost = landedCost(specs.voiceNoteFixed).quantities.find((q) => q.quantity === 1000)!.unitUsd;

  return [
    evaluateModel({
      id: 'consumer-electronics',
      label: 'Sell low-volume consumer electronics',
      description: 'The generated voice note-taker, sold at its target retail price.',
      unitPriceUsd: 79,
      unitCostOverrideUsd: voiceCost,
      labourMinutesOverride: 262,
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
      label: 'Verified builds for other people\'s designs',
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

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
