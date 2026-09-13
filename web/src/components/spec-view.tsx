import type { ProductSpec } from "@/lib/harness/score";
import { WiringDiagram } from "./wiring-diagram";

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-line py-2 pr-4 text-left text-xs uppercase tracking-wide text-muted">{children}</th>;
}

export type BomQuote = { priceUsd?: number; stock?: number; url?: string } | null;

export function BomTable({ spec, quotes }: { spec: ProductSpec; quotes?: Map<string, BomQuote> }) {
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Bill of materials</h2>
      <p className="mt-1 text-sm text-muted">
        Live prices are best-effort lookups cached 24h; where no live quote was found the harness
        estimate stands (±40%).
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <Th>Part</Th>
              <Th>Kind</Th>
              <Th>Process / source</Th>
              <Th>Material</Th>
              <Th>BBox (mm)</Th>
              <Th>Qty</Th>
              <Th>Unit $</Th>
            </tr>
          </thead>
          <tbody>
            {spec.parts.map((p) => {
              const q = p.source?.mpn && quotes ? (quotes.get(p.source.mpn) ?? undefined) : undefined;
              return (
                <tr key={p.id} className="border-b border-line/50 align-top">
                  <td className="py-2 pr-4">
                    {p.label}
                    {p.notes?.length ? <span className="block text-xs text-muted">{p.notes.join(" · ")}</span> : null}
                    {p.wallMm ? <span className="block font-mono text-[11px] text-muted">wall {p.wallMm} mm</span> : null}
                    {p.toleranceMm ? <span className="block font-mono text-[11px] text-muted">tol ±{p.toleranceMm} mm</span> : null}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">{p.kind}</td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {p.purchasePriceUsd !== undefined && p.source ? (
                      <>
                        {p.source.mpn ?? "no MPN"}
                        <span className="block text-muted">
                          {p.source.distributor}
                          {p.source.stockVerified ? " · stock ✓" : " · stock?"}
                          {p.source.alternates ? ` · ${p.source.alternates} alt` : ""}
                        </span>
                        {q && (
                          <span className="block text-accent">
                            live: {q.stock !== undefined ? `${q.stock} in stock` : "listed"}
                            {q.url ? (
                              <>
                                {" "}
                                <a href={q.url} target="_blank" rel="noopener noreferrer" className="underline">
                                  view
                                </a>
                              </>
                            ) : null}
                          </span>
                        )}
                      </>
                    ) : (
                      p.process
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs">{p.material}</td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {p.bboxMm.x}×{p.bboxMm.y}×{p.bboxMm.z}
                  </td>
                  <td className="py-2 pr-4 font-mono">{p.qty}</td>
                  <td className="py-2 font-mono text-xs">
                    {q?.priceUsd !== undefined ? (
                      <span className="text-accent">${q.priceUsd.toFixed(2)}*</span>
                    ) : p.purchasePriceUsd !== undefined ? (
                      `$${p.purchasePriceUsd.toFixed(2)}`
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {quotes && quotes.size > 0 && (
        <p className="mt-2 font-mono text-[11px] text-muted">* live distributor price (LCSC), cached 24h</p>
      )}
    </section>
  );
}

export function AssemblyGuide({ spec }: { spec: ProductSpec }) {
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Assembly guide</h2>
      <ol className="mt-3 space-y-2">
        {spec.operations.map((o, i) => (
          <li key={o.id} className="flex gap-3 text-sm">
            <span className="font-mono text-muted">{String(i + 1).padStart(2, "0")}</span>
            <span>
              {o.label}
              <span className="ml-2 font-mono text-xs text-muted">
                {o.minutes} min{o.requiresSoldering ? " · soldering" : ""}
                {o.improvised ? <span className="text-fail"> · IMPROVISED</span> : null}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FeatureIntentTable({ spec }: { spec: ProductSpec }) {
  if (spec.features.length === 0) return null;
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Feature intent</h2>
      <p className="mt-1 text-sm text-muted">
        Where each reference feature belongs vs where the design put it — the gate that catches the
        face-on-the-back class of failure.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {spec.features.map((f) => {
          const ok = f.present && (f.actualFace === undefined || f.actualFace === f.expectedFace);
          return (
            <li key={f.id} className="flex flex-wrap items-baseline gap-2">
              <span className={`font-mono text-xs ${ok ? "text-pass" : "text-fail"}`}>{ok ? "OK" : "ERR"}</span>
              <span>{f.label}</span>
              <span className="text-xs text-muted">
                expected {f.expectedFace}
                {f.actualFace !== undefined && f.actualFace !== f.expectedFace ? ` · got ${f.actualFace}` : ""}
                {f.cosmetic ? " · cosmetic" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SpecExtras({ spec }: { spec: ProductSpec }) {
  const powerBits = [
    spec.power.mainsInside ? "MAINS INSIDE" : "low voltage",
    spec.power.battery !== "none" ? `${spec.power.battery} battery` : "no battery",
    spec.power.usbPowered ? "USB powered" : null,
    spec.power.wireless !== "none" ? `${spec.power.wireless}` : "no radio",
  ].filter(Boolean) as string[];

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Power &amp; intent</h2>
      <p className="mt-2 text-sm">{spec.intent}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {powerBits.map((b) => (
          <span key={b} className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted">
            {b}
          </span>
        ))}
        {spec.firmware?.provided ? (
          <span className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted">
            firmware: {spec.firmware.language ?? "?"}
            {spec.firmware.builds ? ", compiles" : ", never compiled"}
            {spec.firmware.testedOnHardware ? ", tested on hw" : ""}
          </span>
        ) : null}
      </div>
    </section>
  );
}

export function NetTable({ spec }: { spec: ProductSpec }) {
  const nets = spec.nets ?? [];
  if (nets.length === 0) return null;
  const labelOf = new Map(spec.parts.map((p) => [p.id, p.label]));
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Net list</h2>
      <p className="mt-1 text-sm text-muted">
        The electrical connections as declared — what a build log checks against, pin by pin.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr>
              <Th>Net</Th>
              <Th>Signal</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {nets.map((n) => (
              <tr key={n.id} className="border-b border-line/50 align-top">
                <td className="py-2 pr-4 font-mono text-xs">
                  {n.name}
                  {n.voltage !== undefined ? <span className="block text-muted">{n.voltage} V</span> : null}
                </td>
                <td className="py-2 pr-4 font-mono text-xs">{n.signal}</td>
                <td className="py-2 pr-4 text-xs">
                  {n.endpoints
                    .slice(0, -1)
                    .map((e) => `${labelOf.get(e.part) ?? e.part}${e.pin ? ` (${e.pin})` : ""}`)
                    .join(", ")}
                </td>
                <td className="py-2 pr-4 text-xs">
                  {n.endpoints[n.endpoints.length - 1]
                    ? `${labelOf.get(n.endpoints[n.endpoints.length - 1]!.part) ?? n.endpoints[n.endpoints.length - 1]!.part}${
                        n.endpoints[n.endpoints.length - 1]!.pin ? ` (${n.endpoints[n.endpoints.length - 1]!.pin})` : ""
                      }`
                    : "—"}
                </td>
                <td className="py-2 text-xs text-muted">{n.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SpecView({ spec, quotes }: { spec: ProductSpec; quotes?: Map<string, BomQuote> }) {
  return (
    <div className="space-y-6">
      <BomTable spec={spec} quotes={quotes} />
      <NetTable spec={spec} />
      <AssemblyGuide spec={spec} />
      <FeatureIntentTable spec={spec} />
      <SpecExtras spec={spec} />
      <WiringDiagram spec={spec} />
    </div>
  );
}
