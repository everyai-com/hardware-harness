import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBomCsv, bomFilename } from "../src/lib/bom-csv.ts";

const PARTS = [
  {
    id: "base",
    label: 'Printed base, 90x90 "cube"',
    kind: "custom",
    process: "fdm",
    material: "petg",
    qty: 1,
    bboxMm: { x: 90, y: 90, z: 40 },
  },
  {
    id: "mcu",
    label: "ESP32 module",
    kind: "catalog",
    process: "pcb_assembly",
    material: "module",
    qty: 2,
    bboxMm: { x: 25, y: 18, z: 3 },
    purchasePriceUsd: 3.5,
    source: { distributor: "lcsc", mpn: "ESP32-WROOM-32E", partType: "mcu", stockVerified: true, alternates: 1 },
  },
  {
    id: "mystery",
    label: "No-price part",
    kind: "catalog",
    process: "pcb_assembly",
    material: "module",
    qty: 1,
    bboxMm: { x: 10, y: 10, z: 2 },
    source: { distributor: "unknown", stockVerified: false },
  },
];

test("BOM CSV has one row per part plus header and total", () => {
  const csv = buildBomCsv("Test lamp", PARTS);
  const rows = csv.trim().split("\r\n");
  assert.equal(rows.length, 1 + PARTS.length + 1);
  assert.ok(rows[0].startsWith("line,part_id,description"), "header first");
  assert.match(rows[rows.length - 1], /TOTAL for ""Test lamp"" x1/);
});

test("CSV cells with commas and quotes are escaped", () => {
  const csv = buildBomCsv("Test", PARTS);
  assert.match(csv, /"Printed base, 90x90 ""cube"""/);
});

test("Catalog lines show MPN and channel; made lines show process and make", () => {
  const csv = buildBomCsv("Test", PARTS);
  assert.match(csv, /ESP32-WROOM-32E/);
  assert.match(csv, /,lcsc,/);
  assert.match(csv, /base.*fdm.*make/s);
});

test("Live quotes override estimates and are labelled", () => {
  const quotes = new Map([["ESP32-WROOM-32E", { priceUsd: 2.95, stock: 1200, url: "https://example.com" }]]);
  const csv = buildBomCsv("Test", PARTS, quotes);
  assert.match(csv, /2\.95/);
  assert.match(csv, /live LCSC/);
  const plain = buildBomCsv("Test", PARTS);
  assert.match(plain, /3\.50/);
  assert.match(plain, /estimate/);
});

test("Quantity scales ordered counts and extended prices", () => {
  const csv = buildBomCsv("Test", PARTS, undefined, 100);
  // 2 per unit x 100 = 200 ordered, at $3.50 = $700 extended
  assert.match(csv, /,2,200,3\.50,700\.00,/);
  assert.match(csv, /x100/);
});

test("Unpriced lines are explicit, never $NaN", () => {
  const csv = buildBomCsv("Test", PARTS);
  assert.ok(!csv.includes("NaN"), "no NaN anywhere");
  assert.match(csv, /mystery.*unpriced/);
});

test("Filenames are safe and carry the quantity", () => {
  assert.equal(bomFilename("Lamp Astra!"), "lamp-astra-bom.csv");
  assert.equal(bomFilename("Lamp Astra!", 100), "lamp-astra-bom-x100.csv");
  assert.equal(bomFilename("!!!"), "design-bom.csv");
});
