import { ImageResponse } from "next/og";
import { getDesign } from "@/lib/db/queries";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "LUXO design scorecard";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const design = await getDesign(slug);

  const score = design ? design.scoreTotal.toFixed(2) : "—";
  const gates = design ? (design.gatesPassed ? "GATES PASS" : "GATES FAIL") : "";
  const accent = design?.gatesPassed ? "#4ade80" : "#f87171";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0b",
          color: "#e7e7e8",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700 }}>
            LUXO<span style={{ color: "#f5b84c" }}>_</span>
          </div>
          <div style={{ display: "flex", color: "#8b8b90", fontSize: 24 }}>luxobench harness</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
            {design?.title ?? "LUXO"}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#8b8b90" }}>
            {design?.producedBy ?? ""}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: accent }}>
            {score}/5
          </div>
          <div style={{ display: "flex", fontSize: 32, color: accent }}>{gates}</div>
        </div>
      </div>
    ),
    size,
  );
}
