import type { SpecInput } from "@/lib/spec-schema";

/**
 * Platform facts for a Muse gadget, enforced the same way the picker enforces
 * the board: an ESP32 gadget pairs over Wi-Fi, a Linux gadget over Bluetooth LE
 * — and either way the product carries an intentional radiator, so FCC radio
 * authorisation is required. The model gets these right often enough to be
 * useful and wrong often enough to be a gate failure; this makes them
 * deterministic.
 */
export function applyMuseDefaults(spec: SpecInput): void {
  const target = spec.target;
  if (!target || target.platform !== "muse-gadgets") return;
  spec.power.wireless = target.sdk === "esp32" ? "wifi" : "bluetooth";
  const budgeted = new Set(spec.certificationsBudgeted ?? []);
  budgeted.add("fcc_radio");
  spec.certificationsBudgeted = [...budgeted];
}
