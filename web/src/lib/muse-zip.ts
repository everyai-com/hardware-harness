import { strToU8, zipSync } from "fflate";

/** One path segment: no separators, no "..", nothing an extractor could resolve outside the kit dir. */
const SAFE_SEGMENT = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,128}$/;

/**
 * Zip the build-kit files under one directory, ready to download.
 * Pure JS (fflate), so it runs unchanged in workerd. Throws on any name that
 * is not a single safe path segment (zip-slip guard).
 */
export function zipMuseKit(files: Record<string, string>, dirName: string): Uint8Array {
  if (!SAFE_SEGMENT.test(dirName)) throw new Error(`unsafe kit directory name: ${JSON.stringify(dirName)}`);
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    if (!SAFE_SEGMENT.test(name)) throw new Error(`unsafe kit file name: ${JSON.stringify(name)}`);
    entries[`${dirName}/${name}`] = strToU8(content);
  }
  return zipSync(entries, { level: 6 });
}
