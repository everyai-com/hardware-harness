/**
 * Fulfilment arithmetic: what "deliver one unit at a time" actually costs.
 *
 * The parts are the cheap part. At qty 1 the costs that dominate are the number of
 * shipments (each with its own minimum), the duty on each, and your own coordination
 * hours. Batching changes all three, while the customer still receives one unit.
 */

import { TARIFF_2026, HIDDEN_COSTS, estimate } from '../knowledge/economics.ts';

export interface FulfilmentInputs {
  /** Parts cost per unit, USD, at the given volume. */
  partsCostUsd: number;
  /** Assembly minutes per unit, before any learning-curve benefit. */
  assemblyMinutes: number;
  /** How many different suppliers feed one finished object (board, print, hardware). */
  supplierCount: number;
  /** Orders processed together in one production session. 1 = strictly one at a time. */
  batchSize: number;
  labourRatePerHourUsd: number;
  /** Outbound parcel to the customer. */
  outboundShipUsd: number;
  /** Minimum chargeable inbound parcel from a supplier. */
  inboundParcelUsd: number;
  /** Selling price to the customer. */
  priceUsd: number;
  /** Extra minutes of coordination per order, not per batch. */
  coordinationMinutesPerOrder: number;
  /** True if parts cross a border (duty applies). */
  imported: boolean;
}

export interface FulfilmentOutcome {
  batchSize: number;
  /** Units shipped individually to customers - always 1 in the customer's eyes. */
  partsUsd: number;
  inboundFreightUsd: number;
  dutyUsd: number;
  dutyIsImported?: boolean;
  assemblyUsd: number;
  coordinationUsd: number;
  packagingUsd: number;
  outboundShipUsd: number;
  totalCostUsd: number;
  grossProfitUsd: number;
  grossMarginPct: number;
  labourMinutesPerUnit: number;
  grossProfitPerLabourHourUsd: number;
  /** Lowest price at which this batch size clears a 50% margin. */
  minPriceFor50PctMarginUsd: number;
  note: string;
}

export function evaluateFulfilment(inputs: FulfilmentInputs, batchSize: number): FulfilmentOutcome {
  // Inbound freight: every supplier ships at least one parcel per production session.
  // Batching is the only thing that amortises it.
  const inboundFreight = (inputs.supplierCount * inputs.inboundParcelUsd) / batchSize;

  const preDuty = batchSize > 0 ? inputs.partsCostUsd + inboundFreight : 0;
  const dutyPct = inputs.imported ? mid(TARIFF_2026.effectiveDutyPctConsumer) : 0;
  const duty = preDuty * (dutyPct / 100);

  // Assembly gets faster with repetition, but only within a session. Cap the benefit.
  const learningFactor = batchSize === 1 ? 1 : Math.max(0.55, 1 - Math.log10(batchSize) * 0.25);
  const assemblyMinutes = inputs.assemblyMinutes * learningFactor;
  const assembly = (assemblyMinutes / 60) * inputs.labourRatePerHourUsd;

  // Coordination - checking stock, chasing suppliers, dealing with one customer - is per order.
  const coordination = (inputs.coordinationMinutesPerOrder / 60) * inputs.labourRatePerHourUsd;

  const packaging = estimate(HIDDEN_COSTS.packagingPerUnitUsd);
  const totalCost =
    inputs.partsCostUsd + inboundFreight + duty + assembly + coordination + packaging + inputs.outboundShipUsd;

  const grossProfit = inputs.priceUsd - totalCost;
  const labourMinutes = assemblyMinutes + inputs.coordinationMinutesPerOrder;
  const labourHours = labourMinutes / 60;

  return {
    batchSize,
    partsUsd: round(inputs.partsCostUsd),
    inboundFreightUsd: round(inboundFreight),
    dutyUsd: round(duty),
    dutyIsImported: inputs.imported,
    assemblyUsd: round(assembly),
    coordinationUsd: round(coordination),
    packagingUsd: round(packaging),
    outboundShipUsd: round(inputs.outboundShipUsd),
    totalCostUsd: round(totalCost),
    grossProfitUsd: round(grossProfit),
    grossMarginPct: round((grossProfit / inputs.priceUsd) * 100),
    labourMinutesPerUnit: round(labourMinutes, 1),
    grossProfitPerLabourHourUsd: labourHours > 0 ? round(grossProfit / labourHours) : 0,
    minPriceFor50PctMarginUsd: round(totalCost * 2),
    note:
      batchSize === 1
        ? `${inputs.supplierCount} inbound parcels for one unit. Freight and coordination are charged against a single order.`
        : `One production session for ${batchSize} orders. Inbound freight amortised ${batchSize}x; assembly ${Math.round((1 - learningFactor) * 100)}% faster from repetition. The customer still receives one unit.`,
  };
}

export function compareFulfilment(inputs: FulfilmentInputs): { single: FulfilmentOutcome; batched: FulfilmentOutcome } {
  return {
    single: evaluateFulfilment(inputs, 1),
    batched: evaluateFulfilment(inputs, inputs.batchSize),
  };
}

function mid(range: [number, number]): number {
  return (range[0] + range[1]) / 2;
}

function round(n: number, places = 2): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
