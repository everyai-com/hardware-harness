import { getEnv } from "@/lib/cf";

export type PartQuote = {
  source: "lcsc";
  mpn: string;
  priceUsd?: number;
  stock?: number;
  url?: string;
};

const CACHE_TTL_SECONDS = 60 * 60 * 24;

/**
 * Best-effort live part lookup against LCSC's public search endpoint.
 * Cached in KV for 24h. Every failure mode — blocked, offline, shape change —
 * degrades to null, and the caller keeps the harness estimate. The estimate is
 * the floor; a live quote is a bonus, never a dependency.
 */
export async function getQuote(mpn: string): Promise<PartQuote | null> {
  const key = `quote:lcsc:${mpn.trim().toLowerCase()}`;
  try {
    // The cached value is a wrapper, not the quote itself: a cached *miss* has to be
    // distinguishable from "nothing in the cache", or every failed lookup re-fetches
    // the upstream API on every single page render.
    const cached = await getEnv().KV.get<{ q: PartQuote | null }>(key, "json");
    if (cached && typeof cached === "object" && "q" in cached) return cached.q;
  } catch {
    // KV hiccups must not block generation or rendering
  }

  let quote: PartQuote | null = null;
  try {
    const res = await fetch(
      `https://wapi.lcsc.com/production/search/v2/global?keyword=${encodeURIComponent(mpn)}`,
      {
        headers: { "user-agent": "LUXO/0.1 (open-source hardware verifier; +https://github.com/everyai-com/hardware-harness)" },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (res.ok) {
      const data = (await res.json()) as {
        result?: { product?: LcscProduct };
        product?: LcscProduct;
      };
      const p = data.result?.product ?? data.product ?? null;
      if (p?.productCode) {
        const raw = p.priceList?.[0]?.l1Price ?? p.priceList?.[0]?.l1_price;
        const price = raw === undefined ? undefined : Number(raw);
        quote = {
          source: "lcsc",
          mpn,
          // A non-numeric price must not render as $NaN in the BOM.
          priceUsd: price !== undefined && Number.isFinite(price) ? price : undefined,
          stock: typeof p.stockNumber === "number" ? p.stockNumber : undefined,
          url: `https://www.lcsc.com/product-detail/${p.productCode}.html`,
        };
      }
    }
  } catch {
    // blocked / offline / shape changed — the estimate stands
  }

  try {
    // Negative results are cached too, for less time: a distributor that does not
    // know the part today may know it tomorrow, and hammering them helps nobody.
    await getEnv().KV.put(key, JSON.stringify({ q: quote }), {
      expirationTtl: quote ? CACHE_TTL_SECONDS : CACHE_TTL_SECONDS / 4,
    });
  } catch {
    // ignore
  }
  return quote;
}

interface LcscProduct {
  productCode?: string;
  stockNumber?: number;
  priceList?: Array<{ l1Price?: number | string; l1_price?: number | string }>;
}
