import { readFile } from 'node:fs/promises';

/**
 * Minimal .env loader (no dependencies): reads KEY=value lines and fills
 * process.env for keys that are not already set. Missing file = no-op, so
 * the scripts print their friendly "APIFY_TOKEN is not set" error instead
 * of crashing on `--env-file=.env` when no .env exists yet.
 */
export async function loadDotEnv(path = '.env') {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = value;
  }
}
