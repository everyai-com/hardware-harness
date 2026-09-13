import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Exposes local D1/R2/KV/AI bindings during `next dev` (via wrangler's platform proxy).
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {};

export default nextConfig;
