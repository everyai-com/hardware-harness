/**
 * Opt-in live part quotes.
 *
 * The cost engine stays synchronous and offline. This resolves live prices and
 * folds them into the spec's `purchasePriceUsd` BEFORE evaluation, so the engine
 * itself never needs a network and the fixtures keep scoring identically.
 *
 * Source: JLCPCB's parts API, which serves the LCSC catalogue (the response
 * carries the LCSC code, the LCSC product URL, live stock and price tiers). The
 * old `wapi.lcsc.com` host no longer resolves, which is why quotes were silently
 * empty everywhere.
 *
 * Every failure - blocked, offline, shape change, no published price - degrades
 * to the existing estimate. A live quote is a bonus, never a dependency.
 */

import type { ProductSpec } from '../engine/types.ts';

export interface PartQuote {
  source: 'lcsc';
  /** The MPN that was asked for. */
  mpn: string;
  /** The catalogue part actually matched - these differ more often than you would like. */
  matchedMpn?: string;
  /** Unit price at the lowest tier (qty 1). */
  priceUsd?: number;
  stock?: number;
  url?: string;
}

export interface QuoteApplication {
  partId: string;
  mpn: string;
  /** The catalogue part the quote actually came from - visible so substitutions are auditable. */
  matchedMpn?: string;
  previousUsd: number;
  quotedUsd: number;
}

export interface ResolvedQuotes {
  spec: ProductSpec;
  applied: QuoteApplication[];
  missed: Array<{ partId: string; mpn: string; reason: string }>;
}

const JLCPCB_SEARCH = 'https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList';
const TIMEOUT_MS = 8000;

interface JlcComponent {
  componentModelEn?: string;
  componentCode?: string;
  componentBrandEn?: string;
  stockCount?: number;
  lcscGoodsUrl?: string;
  componentPrices?: Array<{ startNumber?: number; endNumber?: number; productPrice?: number }>;
}

function normalise(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Pick the best candidate, or none.
 *
 * Two filters matter, both learned from real responses:
 *  - Out of stock is not a quote. JLCPCB pads an unmatched search with stock-0
 *    placeholder rows at a fake uniform price, so `stockCount > 0` is required.
 *  - Only a confident match counts. Searching a generic word ("BATTERY",
 *    "MAGNET") returns unrelated parts, and a wrong price is worse than no price.
 *    The matched model must equal or start with what was asked for.
 */
function pickComponent(list: JlcComponent[], mpn: string): JlcComponent | null {
  const want = normalise(mpn);
  const candidates = list.filter((c) => {
    const price = c.componentPrices?.[0]?.productPrice;
    if (typeof price !== 'number' || price <= 0) return false;
    if (!((c.stockCount ?? 0) > 0)) return false;
    const model = normalise(c.componentModelEn ?? '');
    return model === want || model.startsWith(want);
  });
  if (!candidates.length) return null;

  const isExact = (c: JlcComponent) => (normalise(c.componentModelEn ?? '') === want ? 1 : 0);
  return candidates.sort((a, b) => {
    const byExact = isExact(b) - isExact(a);
    if (byExact !== 0) return byExact;
    return (a.componentModelEn ?? '').length - (b.componentModelEn ?? '').length;
  })[0]!;
}

/** Best-effort catalogue lookup. Null on any failure, so the caller keeps the estimate. */
export async function fetchLcscQuote(mpn: string): Promise<PartQuote | null> {
  try {
    const res = await fetch(JLCPCB_SEARCH, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent':
          'hardware-harness/0.1 (open-source hardware verifier; +https://github.com/everyai-com/hardware-harness)',
      },
      body: JSON.stringify({ currentPage: 1, pageSize: 5, keyword: mpn }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { data?: { componentPageInfo?: { list?: JlcComponent[] } } };
    const list = data.data?.componentPageInfo?.list ?? [];
    const best = pickComponent(list, mpn);
    if (!best) return null;

    const price = best.componentPrices?.[0]?.productPrice;
    return {
      source: 'lcsc',
      mpn,
      matchedMpn: best.componentModelEn,
      priceUsd: typeof price === 'number' && Number.isFinite(price) ? price : undefined,
      stock: typeof best.stockCount === 'number' ? best.stockCount : undefined,
      url:
        best.lcscGoodsUrl ??
        (best.componentCode ? `https://www.lcsc.com/product-detail/${best.componentCode}.html` : undefined),
    };
  } catch {
    return null;
  }
}

/**
 * Replace every catalog part's estimated price with a live quote.
 * Does not mutate the input spec. Pass `fetchQuote` to swap the source (or to test).
 */
export async function resolveQuotes(
  spec: ProductSpec,
  options: { fetchQuote?: (mpn: string) => Promise<PartQuote | null> } = {},
): Promise<ResolvedQuotes> {
  const lookup = options.fetchQuote ?? fetchLcscQuote;
  const next = structuredClone(spec);
  const applied: QuoteApplication[] = [];
  const missed: ResolvedQuotes['missed'] = [];

  for (const part of next.parts) {
    const mpn = part.source?.mpn;
    if (!mpn) continue;

    const quote = await lookup(mpn);
    if (quote?.priceUsd === undefined || quote.priceUsd <= 0) {
      missed.push({ partId: part.id, mpn, reason: quote ? 'no published price' : 'no catalogue match' });
      continue;
    }

    const previousUsd = part.purchasePriceUsd ?? 0;
    part.purchasePriceUsd = quote.priceUsd;
    applied.push({ partId: part.id, mpn, matchedMpn: quote.matchedMpn, previousUsd, quotedUsd: quote.priceUsd });
  }

  return { spec: next, applied, missed };
}
