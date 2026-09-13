/** Stable per-browser hash (IP+UA) so votes are one-per-visitor without accounts. */
export async function voterHashFromHeaders(h: Headers): Promise<string> {
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "local";
  const ua = h.get("user-agent") ?? "";
  const data = new TextEncoder().encode(`${ip}:${ua}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
