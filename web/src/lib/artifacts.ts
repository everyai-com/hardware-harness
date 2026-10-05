import { getEnv } from "./cf";

/**
 * Permanent artifacts for published designs in R2: the spec and the report as
 * fixed JSON documents. D1 stays the source of truth; R2 is the permalinked
 * copy — content doesn't change after publish, so the key never needs a version.
 * Best-effort throughout: a missing bucket degrades to D1-rendered downloads.
 */

export type ArtifactFile = "spec" | "report";

function keyFor(slug: string, file: ArtifactFile): string {
  return `designs/${slug}/${file}.json`;
}

function bucket(): R2Bucket | null {
  try {
    return getEnv().R2 ?? null;
  } catch {
    return null;
  }
}

/** Store both artifacts. False when R2 is unavailable — never throws. */
export async function storeArtifacts(slug: string, specJson: string, reportJson: string): Promise<boolean> {
  const r2 = bucket();
  if (!r2) return false;
  try {
    await Promise.all([
      r2.put(keyFor(slug, "spec"), specJson, {
        httpMetadata: { contentType: "application/json" },
      }),
      r2.put(keyFor(slug, "report"), reportJson, {
        httpMetadata: { contentType: "application/json" },
      }),
    ]);
    return true;
  } catch (e) {
    console.warn("[artifacts] store failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Read one artifact. Null when missing or R2 is unavailable — never throws. */
export async function readArtifact(slug: string, file: ArtifactFile): Promise<string | null> {
  const r2 = bucket();
  if (!r2) return null;
  try {
    const obj = await r2.get(keyFor(slug, file));
    if (!obj) return null;
    return await obj.text();
  } catch (e) {
    console.warn("[artifacts] read failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
