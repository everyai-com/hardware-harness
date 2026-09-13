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
    const cached = await getEnv().KV.get(key, "json");
    if (cached !== null && cached !== undefined) return cached as PartQuote | null;
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
        const firstPrice = p.priceList?.[0]?.l1Price ?? p.priceList?.[0]?.l1_price;
        quote = {
          source: "lcsc",
          mpn,
          priceUsd: firstPrice !== undefined ? Number(firstPrice) : undefined,
          stock: typeof p.stockNumber === "number" ? p.stockNumber : undefined,
          url: `https://www.lcsc.com/product-detail/${p.productCode}.html`,
        };
      }
    }
  } catch {
    // blocked / offline / shape changed — the estimate stands
  }

  try {
    await getEnv().KV.put(key, JSON.stringify(quote), { expirationTtl: CACHE_TTL_SECONDS });
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
