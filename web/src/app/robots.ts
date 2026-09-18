import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:8797";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${proto}://${host}/sitemap.xml`,
  };
}
