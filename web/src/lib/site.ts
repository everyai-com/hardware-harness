/**
 * The canonical origin for absolute URLs (sitemap, Open Graph, canonical links).
 *
 * Set `SITE_URL` in the Worker environment for production. The fallback is the
 * local dev origin — never the request's Host header, which is attacker-controlled
 * and would let a request poison the sitemap and social cards.
 */
const FALLBACK_ORIGIN = "http://localhost:3000";

export function siteOrigin(): string {
  const configured = process.env.SITE_URL?.trim();
  if (!configured) return FALLBACK_ORIGIN;
  try {
    const url = new URL(configured);
    return `${url.protocol}//${url.host}`;
  } catch {
    console.warn(`SITE_URL "${configured}" is not a valid URL — falling back to ${FALLBACK_ORIGIN}`);
    return FALLBACK_ORIGIN;
  }
}

export function siteUrl(path = "/"): string {
  return new URL(path, `${siteOrigin()}/`).toString();
}
