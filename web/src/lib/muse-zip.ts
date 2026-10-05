import { strToU8, zipSync } from "fflate";

/**
 * Zip the build-kit files under one directory, ready to download.
 * Pure JS (fflate), so it runs unchanged in workerd.
 */
export function zipMuseKit(files: Record<string, string>, dirName: string): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[`${dirName}/${name}`] = strToU8(content);
  }
  return zipSync(entries, { level: 6 });
}
