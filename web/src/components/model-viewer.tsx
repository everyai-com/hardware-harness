import type { ProductSpec } from "@/lib/harness/score";

/**
 * Model viewer — the "live preview" for hardware.
 *
 * A deterministic isometric exploded view drawn from the spec's own bounding
 * boxes: no CAD file, no render farm, no API key. Custom (made) parts stack
 * as translucent blocks in process colors; bought (catalog) parts render as
 * compact chips below. It is a schematic, not to scale — the BOM table below
 * it carries the true dimensions — but it answers the first question a buyer
 * asks: what is this thing made of, and how much of it do I make vs buy?
 */

const PROCESS_COLORS: Record<string, string> = {
  fdm: "#f5b84c",
  resin_sla: "#a78bfa",
  sls_mjf: "#38bdf8",
  cnc_3axis: "#94a3b8",
  sheet_metal: "#fb923c",
  pcb_assembly: "#4ade80",
  soft_tool: "#f472b6",
  injection_molding: "#60a5fa",
  injection_molding_multicavity: "#818cf8",
};

const COS30 = 0.866;
const SIN30 = 0.5;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

interface IsoBox {
  cx: number;
  yTop: number;
  hw: number;
  hh: number;
  h: number;
}

function boxPoints(b: IsoBox): { top: string; left: string; right: string } {
  const { cx, yTop, hw, hh, h } = b;
  const t = `${cx},${yTop}`;
  const r = `${cx + hw},${yTop + hh}`;
  const bo = `${cx},${yTop + 2 * hh}`;
  const l = `${cx - hw},${yTop + hh}`;
  const rb = `${cx + hw},${yTop + hh + h}`;
  const bb = `${cx},${yTop + 2 * hh + h}`;
  const lb = `${cx - hw},${yTop + hh + h}`;
  return {
    top: `${t} ${r} ${bo} ${l}`,
    left: `${bo} ${l} ${lb} ${bb}`,
    right: `${bo} ${r} ${rb} ${bb}`,
  };
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

const MAX_DRAWN = 10;

export function ModelViewer({ spec }: { spec: ProductSpec }) {
  const made = spec.parts.filter((p) => p.kind === "custom");
  const bought = spec.parts.filter((p) => p.kind === "catalog");
  const drawn = made.slice(0, MAX_DRAWN);
  const hiddenMade = made.length - drawn.length;

  // Per-part schematic sizing from the bounding box (log-compressed so a
  // 100mm enclosure and a 10mm spacer can share one drawing).
  const sizes = drawn.map((p) => {
    const w = clamp(26 + Math.log10(1 + p.bboxMm.x) * 42, 30, 120);
    const d = clamp(26 + Math.log10(1 + p.bboxMm.y) * 42, 30, 120);
    const h = clamp(10 + Math.log10(1 + p.bboxMm.z) * 26, 14, 64);
    return { w, d, h };
  });

  const CX = 190;
  const GAP = 30;
  let y = 16;
  const boxes: Array<{ part: (typeof drawn)[number]; box: IsoBox }> = [];
  for (let i = 0; i < drawn.length; i++) {
    const s = sizes[i]!;
    const hw = ((s.w + s.d) / 2) * COS30;
    const hh = ((s.w + s.d) / 2) * SIN30;
    boxes.push({ part: drawn[i]!, box: { cx: CX, yTop: y, hw, hh, h: s.h } });
    y += 2 * hh + s.h + GAP;
  }

  const chipY = y + 6;
  const boughtShown = bought.slice(0, 12);
  const height = chipY + (bought.length ? 46 + Math.ceil(boughtShown.length / 4) * 30 : 8);

  return (
    <section aria-label="Exploded model preview" className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Model preview</h2>
        <p className="font-mono text-[11px] text-muted">
          {made.length} made · {bought.length} bought · schematic, not to scale
        </p>
      </div>
      <svg
        viewBox={`0 0 640 ${height}`}
        className="mt-2 w-full"
        role="img"
        aria-label={`Exploded view of ${spec.name}: ${made.length} manufactured parts and ${bought.length} bought parts`}
      >
        <title>{spec.name} — exploded schematic</title>
        {/* spine */}
        {boxes.length > 1 && (
          <line
            x1={CX}
            y1={boxes[0]!.box.yTop - 8}
            x2={CX}
            y2={boxes[boxes.length - 1]!.box.yTop + boxes[boxes.length - 1]!.box.hh * 2 + boxes[boxes.length - 1]!.box.h + 8}
            stroke="#26262b"
            strokeDasharray="3 4"
          />
        )}
        {boxes.map(({ part, box }, i) => {
          const pts = boxPoints(box);
          const color = PROCESS_COLORS[part.process] ?? "#8b8b90";
          const labelY = box.yTop + box.hh + box.h / 2;
          return (
            <g key={part.id}>
              <polygon points={pts.left} fill={shade(color, 0.45)} stroke={color} strokeOpacity="0.5" />
              <polygon points={pts.right} fill={shade(color, 0.62)} stroke={color} strokeOpacity="0.5" />
              <polygon points={pts.top} fill={shade(color, 0.85)} stroke={color} />
              <line x1={box.cx + box.hw} y1={labelY} x2={box.cx + box.hw + 26} y2={labelY} stroke="#26262b" />
              <text x={box.cx + box.hw + 30} y={labelY - 2} fill="#e7e7e8" fontSize="13" fontWeight="600">
                {String(i + 1).padStart(2, "0")} {part.label}
              </text>
              <text x={box.cx + box.hw + 30} y={labelY + 14} fill="#8b8b90" fontSize="11" fontFamily="monospace">
                {part.process} · {part.material} · {part.bboxMm.x}×{part.bboxMm.y}×{part.bboxMm.z}mm
                {part.qty > 1 ? ` ×${part.qty}` : ""}
              </text>
            </g>
          );
        })}
        {hiddenMade > 0 && (
          <text x={CX} y={y - 10} fill="#8b8b90" fontSize="11" fontFamily="monospace" textAnchor="middle">
            + {hiddenMade} more made part{hiddenMade === 1 ? "" : "s"} in the BOM
          </text>
        )}
        {bought.length > 0 && (
          <g>
            <text x={16} y={chipY + 14} fill="#8b8b90" fontSize="11" fontFamily="monospace">
              BOUGHT
            </text>
            {boughtShown.map((p, i) => {
              const col = i % 4;
              const row = Math.floor(i / 4);
              const x = 16 + col * 154;
              const yy = chipY + 22 + row * 30;
              const color = p.source?.partType === "mcu" ? "#4ade80" : "#8b8b90";
              return (
                <g key={p.id}>
                  <rect x={x} y={yy} width="146" height="24" rx="6" fill="#0a0a0b" stroke="#26262b" />
                  <circle cx={x + 12} cy={yy + 12} r="3.5" fill={color} />
                  <text x={x + 21} y={yy + 16} fill="#e7e7e8" fontSize="11">
                    {(p.label.length > 20 ? p.label.slice(0, 19) + "…" : p.label) +
                      (p.qty > 1 ? ` ×${p.qty}` : "")}
                  </text>
                </g>
              );
            })}
            {bought.length > boughtShown.length && (
              <text x={16} y={chipY + 30 + Math.ceil(boughtShown.length / 4) * 30} fill="#8b8b90" fontSize="11" fontFamily="monospace">
                + {bought.length - boughtShown.length} more in the BOM
              </text>
            )}
          </g>
        )}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {[...new Set(drawn.map((p) => p.process))].map((proc) => (
          <span key={proc} className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: PROCESS_COLORS[proc] ?? "#8b8b90" }}
            />
            {proc}
          </span>
        ))}
      </div>
    </section>
  );
}
