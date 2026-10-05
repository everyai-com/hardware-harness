/**
 * Client for POST /api/jobs: streams staged progress over SSE, resolves with
 * the terminal event. If the stream breaks mid-run, it falls back to one
 * status poll — the run continues server-side either way.
 */

type Terminal = { slug: string; url: string } | { error: string };

async function pollOnce(jobId: string): Promise<Terminal | null> {
  try {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) return null;
    const st = (await res.json()) as {
      status?: string;
      slug?: string;
      url?: string;
      error?: string;
    };
    if (st.status === "done" && st.slug && st.url) return { slug: st.slug, url: st.url };
    if (st.status === "failed") return { error: st.error ?? "The job failed." };
    return null;
  } catch {
    return null;
  }
}

export async function runJobStream(
  body: Record<string, unknown>,
  onStage: (stage: string) => void,
): Promise<Terminal> {
  let res: Response;
  try {
    res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { error: "Could not reach the server — check your connection and try again." };
  }
  if (!res.ok || !res.body) {
    try {
      const data = (await res.json()) as { error?: string };
      return { error: typeof data.error === "string" ? data.error : `Request failed (HTTP ${res.status}).` };
    } catch {
      return { error: `Request failed (HTTP ${res.status}).` };
    }
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let jobId: string | null = null;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        let event: unknown;
        try {
          event = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        if (typeof event !== "object" || !event) continue;
        const e = event as Record<string, unknown>;
        if (typeof e.id === "string") jobId = e.id;
        if (e.done === true) {
          if (typeof e.slug === "string" && typeof e.url === "string") return { slug: e.slug, url: e.url };
          return { error: typeof e.error === "string" ? e.error : "The job failed." };
        }
        if (typeof e.stage === "string") onStage(e.stage);
      }
    }
  } catch {
    // Stream broke — the run may still complete server-side; check once.
    if (jobId) {
      const terminal = await pollOnce(jobId);
      if (terminal) return terminal;
    }
    return { error: "The connection broke mid-run — the design may still have published; check explore." };
  } finally {
    reader.releaseLock();
  }
  if (jobId) {
    const terminal = await pollOnce(jobId);
    if (terminal) return terminal;
  }
  return { error: "The connection closed before the run finished." };
}
