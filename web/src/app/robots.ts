import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // JSON endpoints are for agents, not for the index.
        disallow: ["/api/"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
  };
}
