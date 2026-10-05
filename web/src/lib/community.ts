import { getEnv } from "@/lib/cf";

export type CommunityBuild = {
  id: number;
  title: string;
  handle: string;
  url: string;
  description: string;
  editorsPick: boolean;
  pinned: boolean;
};

const FEED_URL = "https://musecases.netlify.app/usecases.json";
const FEED_PAGE = "https://musecases.netlify.app/hardware/";
const CACHE_KEY = "community:musecases:hardware";
const CACHE_TTL_SECONDS = 60 * 60 * 12;

export { FEED_PAGE };

/**
 * Best-effort list of real community Muse Gadgets builds, from the third-party
 * Musecases tracker (X posts labelled Hardware). Server-side only: the feed has
 * no CORS headers. Cached in KV; every failure mode degrades to [] so the page
 * renders without it.
 */
export async function listCommunityBuilds(): Promise<CommunityBuild[]> {
  try {
    const cached = await getEnv().KV.get(CACHE_KEY, "json");
    if (Array.isArray(cached)) return cached as CommunityBuild[];
  } catch {
    // KV hiccups must not block rendering
  }

  let builds: CommunityBuild[] | null = null;
  try {
    const res = await fetch(FEED_URL, {
      headers: { "user-agent": "Blinky/0.1 (open-source hardware verifier; +https://github.com/everyai-com/hardware-harness)" },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = (await res.json()) as Array<Record<string, unknown>>;
      builds = data
        .filter(
          (u) =>
            u.category === "Hardware" &&
            typeof u.sourceUrl === "string" &&
            /(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+/i.test(u.sourceUrl),
        )
        .sort(
          (a, b) =>
            (isPinned(b) ? 1 : 0) - (isPinned(a) ? 1 : 0) || (Number(b.id) || 0) - (Number(a.id) || 0),
        )
        .map((u) => ({
          id: Number(u.id) || 0,
          title: String(u.title ?? ""),
          handle: String(u.sourceHandle ?? ""),
          url: String(u.sourceUrl),
          description: String(u.description ?? ""),
          editorsPick: u.editorsPick === true,
          pinned: isPinned(u),
        }));
    }
  } catch {
    // blocked / offline / shape changed — the section simply doesn't render
  }

  if (builds) {
    // Only cache successful fetches: a transient outage must not pin an empty
    // list for the TTL.
    try {
      await getEnv().KV.put(CACHE_KEY, JSON.stringify(builds), { expirationTtl: CACHE_TTL_SECONDS });
    } catch {
      // ignore
    }
  }
  return builds ?? [];
}

function isPinned(u: Record<string, unknown>): boolean {
  return Array.isArray(u.pinnedIn) && u.pinnedIn.includes("Hardware");
}
