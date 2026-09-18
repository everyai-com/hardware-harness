import { getEnv } from "@/lib/cf";

export type PartQuote = {
  source: "lcsc";
  /** The MPN that was asked for. */
  mpn: string;
  /** The catalogue part actually matched - these differ more often than you would like. */
  matchedMpn?: string;
  priceUsd?: number;
  stock?: number;
  url?: string;
};

const CACHE_TTL_SECONDS = 60 * 60 * 24;
/** Failures are retried soon rather than cached as if the part did not exist. */
const FAILURE_TTL_SECONDS = 60 * 5;
const TIMEOUT_MS = 8000;
/**
 * Bump when the quote shape or the caching contract changes. v1 entries were
 * written while the source host was dead, and v2 cached transient upstream
 * failures as "no match" — both poison the cache, so a fresh prefix retires them.
 */
const CACHE_VERSION = "v3";
const JLCPCB_SEARCH =
  "https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList";

interface JlcComponent {
  componentModelEn?: string;
  componentCode?: string;
  stockCount?: number;
  lcscGoodsUrl?: string;
  componentPrices?: Array<{ startNumber?: number; endNumber?: number; productPrice?: number }>;
}

function normalise(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
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
    if (typeof price !== "number" || price <= 0) return false;
    if (!((c.stockCount ?? 0) > 0)) return false;
    const model = normalise(c.componentModelEn ?? "");
    return model === want || model.startsWith(want);
  });
  if (!candidates.length) return null;

  const isExact = (c: JlcComponent) => (normalise(c.componentModelEn ?? "") === want ? 1 : 0);
  return candidates.sort((a, b) => {
    const byExact = isExact(b) - isExact(a);
    if (byExact !== 0) return byExact;
    return (a.componentModelEn ?? "").length - (b.componentModelEn ?? "").length;
  })[0]!;
}

/**
 * One upstream lookup. `ok: false` means we could not ask the question — blocked,
 * offline, rate-limited, shape changed — which is very different from a real
 * "this part does not exist", and the two must not be cached the same way.
 */
async function lookup(mpn: string): Promise<{ ok: boolean; quote: PartQuote | null }> {
  try {
    const res = await fetch(JLCPCB_SEARCH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent":
          "LUXO/0.1 (open-source hardware verifier; +https://github.com/everyai-com/hardware-harness)",
      },
      body: JSON.stringify({ currentPage: 1, pageSize: 5, keyword: mpn }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, quote: null };

    const data = (await res.json()) as { data?: { componentPageInfo?: { list?: JlcComponent[] } } };
    const best = pickComponent(data.data?.componentPageInfo?.list ?? [], mpn);
    if (!best) return { ok: true, quote: null };

    const price = best.componentPrices?.[0]?.productPrice;
    return {
      ok: true,
      quote: {
        source: "lcsc",
        mpn,
        matchedMpn: best.componentModelEn,
        priceUsd: typeof price === "number" && Number.isFinite(price) ? price : undefined,
        stock: typeof best.stockCount === "number" ? best.stockCount : undefined,
        url:
          best.lcscGoodsUrl ??
          (best.componentCode ? `https://www.lcsc.com/product-detail/${best.componentCode}.html` : undefined),
      },
    };
  } catch {
    // blocked / offline / rate-limited — we did not learn anything about this part
    return { ok: false, quote: null };
  }
}

/**
 * Best-effort live part lookup against JLCPCB's parts API, which serves the LCSC
 * catalogue. Cached in KV for 24h. Anything that fails degrades to null and the
 * caller keeps the harness estimate. The estimate is the floor; a live quote is a
 * bonus, never a dependency.
 *
 * (The previous `wapi.lcsc.com` host no longer resolves, which is why this always
 * returned null.)
 */
export async function getQuote(mpn: string): Promise<PartQuote | null> {
  const key = `quote:${CACHE_VERSION}:lcsc:${mpn.trim().toLowerCase()}`;
  try {
    const cached = await getEnv().KV.get(key, "json");
    // A cached miss is cached as null, which is a legitimate answer.
    if (cached === null) return null;
    // Anything else must actually look like a quote. A malformed entry must never
    // be served, so validate rather than trusting whatever is in KV.
    if (cached && typeof cached === "object" && (cached as PartQuote).source === "lcsc" && (cached as PartQuote).mpn) {
      return cached as PartQuote;
    }
  } catch {
    // KV hiccups must not block generation or rendering
  }

  const { ok, quote } = await lookup(mpn);

  try {
    if (ok) {
      // A real answer — including a real "no match" — is worth caching for a day.
      await getEnv().KV.put(key, JSON.stringify(quote), { expirationTtl: CACHE_TTL_SECONDS });
    } else {
      // We never got an answer. Cache the miss only briefly so a rate-limit or a
      // blip does not masquerade as "this part does not exist" for 24 hours.
      await getEnv().KV.put(key, JSON.stringify(null), { expirationTtl: FAILURE_TTL_SECONDS });
    }
  } catch {
    // ignore
  }
  return quote;
}
