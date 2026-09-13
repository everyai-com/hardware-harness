import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { listDesigns, listKits } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:8797";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const base = `${proto}://${host}`;

  const [designs, kits] = await Promise.all([listDesigns("new", 500), listKits()]);

  const statics = ["", "/generate", "/explore", "/kits", "/leaderboard", "/reference", "/api-docs"].map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
  }));

  return [
    ...statics,
    ...designs.map((d) => ({ url: `${base}/d/${d.id}`, lastModified: new Date(d.createdAt) })),
    ...kits.map((k) => ({ url: `${base}/kits/${k.id}`, lastModified: new Date(k.createdAt) })),
  ];
}
