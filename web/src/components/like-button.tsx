"use client";

import { useState } from "react";

export function LikeButton({ designId, initialLikes, initiallyVoted }: { designId: string; initialLikes: number; initiallyVoted: boolean }) {
  const [likes, setLikes] = useState(initialLikes);
  const [voted, setVoted] = useState(initiallyVoted);
  const [busy, setBusy] = useState(false);

  async function like() {
    if (voted || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: designId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { likes: number; voted: boolean };
        if (data.voted) {
          setLikes(data.likes);
          setVoted(true);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={like}
      disabled={voted || busy}
      className={`rounded-lg border px-3 py-1.5 font-mono text-sm transition-colors ${
        voted ? "border-accent/50 text-accent" : "border-line text-muted hover:border-accent hover:text-accent"
      } disabled:opacity-60`}
    >
      {voted ? "♥" : "♡"} {likes}
    </button>
  );
}
