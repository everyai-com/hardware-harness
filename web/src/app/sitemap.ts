import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { listDesigns, listKits } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The origin comes from SITE_URL, not the request's Host header.
  const [designs, kits] = await Promise.all([listDesigns("new", 500), listKits()]);

  const now = new Date();
  const statics = ["", "/generate", "/explore", "/kits", "/leaderboard", "/reference", "/api-docs"].map((p) => ({
    url: siteUrl(p),
    lastModified: now,
  }));

  return [
    ...statics,
    ...designs.map((d) => ({ url: siteUrl(`/d/${d.id}`), lastModified: new Date(d.createdAt) })),
    ...kits.map((k) => ({ url: siteUrl(`/kits/${k.id}`), lastModified: new Date(k.createdAt) })),
  ];
}
