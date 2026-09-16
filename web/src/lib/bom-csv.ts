/**
 * BOM CSV export.
 *
 * A bill of materials that cannot leave the browser is a screenshot, not a
 * supply-chain artifact. This builder turns a ProductSpec into the CSV a
 * buyer pastes into a distributor cart or hands to an assembler: one row per
 * part, with process/source, quantity scaled, and live prices where known.
 *
 * Pure module on purpose: the API route streams it, and node:test covers it
 * without a database.
 */

export interface BomCsvPart {
  id: string;
  label: string;
  kind: string;
  process: string;
  material: string;
  qty: number;
  bboxMm: { x: number; y: number; z: number };
  purchasePriceUsd?: number;
  source?: {
    distributor?: string;
    mpn?: string;
    partType?: string;
    stockVerified?: boolean;
    alternates?: number;
  };
  notes?: string[];
}

export interface BomCsvQuote {
  priceUsd?: number;
  stock?: number;
  url?: string;
}

function cell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build the CSV for a spec. `quotes` maps MPN -> live distributor quote and
 * overrides the estimate column where present. `quantity` scales extended
 * prices (BOM lines, not tooling).
 */
export function buildBomCsv(
  designTitle: string,
  parts: BomCsvPart[],
  quotes?: Map<string, BomCsvQuote | null>,
  quantity = 1,
): string {
  const header = [
    "line",
    "part_id",
    "description",
    "kind",
    "process_or_mpn",
    "channel",
    "material",
    "bbox_mm",
    "qty_per_unit",
    "qty_ordered",
    "unit_usd",
    "extended_usd",
    "price_source",
    "notes",
  ];
  const lines = [header.join(",")];
  let n = 0;
  for (const p of parts) {
    n += 1;
    const mpn = p.source?.mpn;
    const live = mpn && quotes ? (quotes.get(mpn) ?? undefined) : undefined;
    const unit = live?.priceUsd ?? p.purchasePriceUsd;
    const ordered = p.qty * quantity;
    const extended = unit !== undefined ? Math.round(unit * ordered * 100) / 100 : undefined;
    lines.push(
      [
        cell(n),
        cell(p.id),
        cell(p.label),
        cell(p.kind),
        cell(p.kind === "catalog" ? (mpn ?? "no MPN") : p.process),
        cell(p.kind === "catalog" ? (p.source?.distributor ?? "unknown") : "make"),
        cell(p.material),
        cell(`${p.bboxMm.x}x${p.bboxMm.y}x${p.bboxMm.z}`),
        cell(p.qty),
        cell(ordered),
        cell(unit !== undefined ? unit.toFixed(2) : undefined),
        cell(extended !== undefined ? extended.toFixed(2) : undefined),
        cell(live?.priceUsd !== undefined ? "live LCSC" : unit !== undefined ? "estimate" : "unpriced"),
        cell(
          [
            ...(p.notes ?? []),
            p.source?.stockVerified === false ? "stock unverified" : null,
          ]
            .filter((x): x is string => typeof x === "string")
            .join(" · "),
        ),
      ].join(","),
    );
  }
  const total = parts.reduce((s, p) => {
    const live = p.source?.mpn && quotes ? (quotes.get(p.source.mpn) ?? undefined) : undefined;
    const unit = live?.priceUsd ?? p.purchasePriceUsd ?? 0;
    return s + unit * p.qty * quantity;
  }, 0);
  lines.push(
    ["", "", cell(`TOTAL for "${designTitle}" x${quantity} (BOM lines only, no tooling/duty/freight)`), "", "", "", "", "", "", "", "", cell(total.toFixed(2)), "", ""].join(
      ",",
    ),
  );
  return lines.join("\r\n") + "\r\n";
}

/** Filename-safe download name for a design's BOM. */
export function bomFilename(designId: string, quantity = 1): string {
  const safe = designId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "design";
  return quantity > 1 ? `${safe}-bom-x${quantity}.csv` : `${safe}-bom.csv`;
}
