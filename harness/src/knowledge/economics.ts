/**
 * Cost, tariff, labour and inspection economics for 2026.
 * These are the lines that appear in nobody's AI-generated BOM.
 */

export const TARIFF_2026 = {
  /** US de minimis ($800 duty-free exemption) ended for China/HK on 2025-05-02 (EO 14256). */
  deMinimisEndedChinaHk: '2025-05-02',
  /** Globally suspended 2025-08-29. Ends by law in 2027. */
  deMinimisGloballySuspended: '2025-08-29',
  /** Reported per-parcel duty cost increase for postal shipments after the change. */
  postalParcelCostIncreasePct: [35, 50] as [number, number],
  /** Section 301 range on Chinese goods, plus the effect of the Nov 2025 truce adjustments. */
  section301Pct: [7.5, 25] as [number, number],
  /** Realistic all-in duty for most consumer categories. */
  effectiveDutyPctConsumer: [20, 30] as [number, number],
  notes: [
    'Every small parcel from China is now taxed. "Ships in days" and "duty free" are no longer compatible.',
    'If you are the importer of record, you owe this - not the factory, not the customer.',
    'Tooling supplied free to a foreign manufacturer counts as an assist and must be declared in customs value.',
  ],
  source: 'tariffschart 2026 importer guide; unicargo FBA tariffs guide; exfreight EO 14256 analysis',
};

export const LABOR_AND_QC = {
  /** Third-party pre-shipment inspection, per man-day. QIMA from ~$229, SGS/BV $300-400. */
  inspectionPerManDayUsd: [120, 400] as [number, number],
  inspectionTypicalUsd: [250, 400] as [number, number],
  /** Factory/supplier audit. */
  factoryAuditUsd: [350, 500] as [number, number],
  /** Standard acceptable quality limit for consumer goods. */
  aqlPct: 2.5,
  /** China sourcing agent commission on order value. */
  sourcingAgentCommissionPct: [3, 10] as [number, number],
  /** Undisclosed markup some agents add on top of unit price. */
  sourcingAgentHiddenMarkupPct: [0, 30] as [number, number],
  /** Typical factory payment terms: half up front, half after T1 approval. */
  factoryPaymentTerms: '50% deposit, 50% after T1 approval',
  source: 'QIMA/SGS/BV published pricing 2026; repasourcing commission survey; woosourcing tooling guide',
};

export const HIDDEN_COSTS = {
  /** Signed drivers for USB audio/HID. Exceeds the BOM on small-batch audio hardware. */
  signedDriverUsd: [500, 1000] as [number, number],
  /** Payment processing plus chargeback reserve. */
  paymentProcessingPct: 3,
  /** Reserve for replacements and returns - custom goods rarely come back, they get remade. */
  defectReservePct: 3,
  /** Air express, small parcels. */
  airFreightPerKgUsd: [8, 15] as [number, number],
  airFreightDays: [3, 7] as [number, number],
  /** Sea freight, per cubic metre, for volume runs. */
  seaFreightPerCbmUsd: [120, 260] as [number, number],
  seaFreightDays: [25, 45] as [number, number],
  /** Packaging, per unit, for a small consumer product. */
  packagingPerUnitUsd: [0.8, 3] as [number, number],
  source: 'alexflorias BOM breakdown (driver signing); OPERATIONS.md per-order model',
};

export function dutyMultiplier(origin: 'china' | 'domestic' | 'other'): number {
  if (origin === 'domestic') return 1;
  if (origin === 'china') return 1 + midpoint(TARIFF_2026.effectiveDutyPctConsumer) / 100;
  return 1.05;
}

export function midpoint(range: [number, number]): number {
  return (range[0] + range[1]) / 2;
}

/** Blend two numbers as a polite estimate when only a range is known. */
export function estimate(range: [number, number]): number {
  return midpoint(range);
}
