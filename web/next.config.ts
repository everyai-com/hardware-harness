import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Awaited so the D1/R2/KV/AI bindings are installed before the dev server accepts
// requests. Called without await, the first requests after `next dev` start throw
// "getCloudflareContext has been called without having called initOpenNextCloudflareForDev".
export default async function config(): Promise<NextConfig> {
  await initOpenNextCloudflareForDev().catch(() => {});
  return {};
}
