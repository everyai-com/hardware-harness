#!/usr/bin/env node
/**
 * MCP server (stdio) - the "bring your own agent" surface.
 *
 * Exposes the harness to Claude Code, Codex, Cursor or any MCP client. The client
 * supplies the model; the harness supplies the manufacturing knowledge, the cost
 * model and the gates. Swap the model without losing the rules.
 *
 * Protocol: JSON-RPC 2.0 over stdio, newline-delimited. No dependencies.
 */

import { evaluate } from '../engine/evaluate.ts';
import { checkDFM, requiredCertifications, estimateAssemblyMinutes } from '../engine/dfm-check.ts';
import { landedCost } from '../engine/cost.ts';
import { recommendProcess } from '../engine/process-select.ts';
import { renderReport } from '../engine/report.ts';
import { FAILURE_TAXONOMY } from '../knowledge/taxonomy.ts';
import { PROCESSES } from '../knowledge/processes.ts';
import { MATERIALS, RULES } from '../knowledge/dfm.ts';
import { CERTIFICATIONS, SOURCING_RULES, SOURCING_CHANNELS } from '../knowledge/compliance.ts';
import { TARIFF_2026, LABOR_AND_QC, HIDDEN_COSTS } from '../knowledge/economics.ts';
import { FIXTURES } from '../fixtures/keil-runs.ts';
import { LAMP_ACCEPTANCE_CRITERIA, LAMP_REFERENCE_FEATURES } from '../fixtures/lamp.ts';
import type { ProductSpec, Part } from '../engine/types.ts';
import { evaluateModel } from '../engine/business.ts';
import { evaluateFulfilment } from '../engine/fulfilment.ts';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'hardware-harness', version: '0.1.0' };

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => unknown;
}

const specSchema = {
  type: 'object',
  description:
    'A ProductSpec: parts, interfaces, operations, features and power. See hardware_spec_schema for the full shape.',
  additionalProperties: true,
};

function asSpec(args: Record<string, unknown>): ProductSpec {
  const spec = args.spec as ProductSpec | undefined;
  if (!spec) throw new Error('Missing "spec" argument.');
  if (!Array.isArray(spec.parts) || !Array.isArray(spec.features)) {
    throw new Error('Spec must include "parts" and "features" arrays.');
  }
  // Fill in defaults so a partially-specified design still evaluates.
  return {
    ...spec,
    targetQuantities: spec.targetQuantities?.length ? spec.targetQuantities : [1, 100, 1000],
    origin: spec.origin ?? 'china',
    operations: spec.operations ?? [],
    interfaces: spec.interfaces ?? [],
  };
}

const TOOLS: ToolDef[] = [
  {
    name: 'hardware_evaluate',
    description:
      'Run a full evaluation of a hardware design: DFM findings, hard gates, weighted scorecard, landed cost at qty 1/100/1000, lead time and assembly estimate. Use this as the acceptance test before ordering anything.',
    inputSchema: {
      type: 'object',
      properties: { spec: specSchema },
      required: ['spec'],
    },
    handler: (args) => {
      const report = evaluate(asSpec(args));
      return { markdown: renderReport(report), report };
    },
  },
  {
    name: 'hardware_dfm_check',
    description:
      'Check a design against design-for-manufacturing rules (wall thickness, draft, supports on cosmetic faces, feature minimums, tolerance stacks, part count, improvised operations). Returns findings with fixes.',
    inputSchema: { type: 'object', properties: { spec: specSchema }, required: ['spec'] },
    handler: (args) => checkDFM(asSpec(args)),
  },
  {
    name: 'hardware_landed_cost',
    description:
      'Compute landed cost per unit at qty 1/100/1000 including tooling amortisation, duty after the de minimis repeal, inspection, certification and the hidden lines (signed drivers, defect reserve). This is the number nobody publishes.',
    inputSchema: { type: 'object', properties: { spec: specSchema }, required: ['spec'] },
    handler: (args) => landedCost(asSpec(args)),
  },
  {
    name: 'hardware_process_select',
    description:
      'Recommend a manufacturing process for one part and show the crossover quantity where a tooled process beats a tool-less one. Answers "can this be made at 1 / 100 / 1000 units, and with what tooling".',
    inputSchema: {
      type: 'object',
      properties: {
        part: { type: 'object', description: 'A Part object.' },
        quantities: { type: 'array', items: { type: 'number' } },
      },
      required: ['part'],
    },
    handler: (args) => recommendProcess(args.part as Part, (args.quantities as number[]) ?? [1, 100, 1000]),
  },
  {
    name: 'hardware_gates',
    description:
      'Run only the hard pass/fail gates: real orderable parts, clean CAD, ERC/DRC, no mains, no lithium, part count budget, no improvised operations, sourcing integrity, certification, and feature placement (the "face on the back" check).',
    inputSchema: { type: 'object', properties: { spec: specSchema }, required: ['spec'] },
    handler: (args) => evaluate(asSpec(args)).gates,
  },
  {
    name: 'hardware_certification',
    description:
      'List the certifications a design triggers (FCC class, UL/ETL for mains, UN38.3 for lithium, CE/GPSR for the EU) with published costs where they exist, and the avoidance strategies (external certified adapter, pre-certified module).',
    inputSchema: { type: 'object', properties: { spec: specSchema }, required: ['spec'] },
    handler: (args) => {
      const spec = asSpec(args);
      const ids = requiredCertifications(spec);
      return {
        required: ids.map((id) => CERTIFICATIONS.find((c) => c.id === id)).filter(Boolean),
        budgeted: spec.certificationsBudgeted ?? [],
        missing: ids.filter((id) => !(spec.certificationsBudgeted ?? []).includes(id)),
      };
    },
  },
  {
    name: 'hardware_sourcing_rules',
    description:
      'Where to buy each class of part: which channels are acceptable, which part types are counterfeited most, the authorised-channel premium, and the reel/cut-tape rule for assembly houses.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => ({ channels: SOURCING_CHANNELS, rules: SOURCING_RULES }),
  },
  {
    name: 'hardware_failure_taxonomy',
    description:
      'The accumulated failure library: every failure mode already observed in public AI hardware runs, its symptom, the rule that catches it, and the evidence. Use it to avoid re-learning these on your own money.',
    inputSchema: { type: 'object', properties: { ruleId: { type: 'string' } } },
    handler: (args) =>
      args.ruleId ? FAILURE_TAXONOMY.filter((f) => f.ruleId === args.ruleId) : FAILURE_TAXONOMY,
  },
  {
    name: 'hardware_process_data',
    description:
      'Raw process capability and cost data: minimum wall, draft, tolerance, overhang, tooling cost, lead time and MOQ for FDM, SLA, SLS/MJF, CNC, sheet metal, soft tool and injection moulding.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => ({ processes: PROCESSES, materials: MATERIALS, steelShotLife: undefined }),
  },
  {
    name: 'hardware_rules',
    description:
      'The rule catalogue with rationale and evidence, the 2026 tariff and QC economics, and the hidden-cost lines.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => ({ rules: RULES, tariff: TARIFF_2026, laborAndQc: LABOR_AND_QC, hiddenCosts: HIDDEN_COSTS }),
  },
  {
    name: 'hardware_fixture',
    description:
      'Get a reference fixture to design against - the cube lamp acceptance criteria and its feature-intent list, or a reconstructed design from the first public benchmark run.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'lamp-astra | lamp-fable | dj-controller, or omit for the lamp criteria' } },
    },
    handler: (args) => {
      if (!args.id) {
        return { acceptanceCriteria: LAMP_ACCEPTANCE_CRITERIA, features: LAMP_REFERENCE_FEATURES };
      }
      const found = FIXTURES.find((f) => f.id === args.id);
      if (!found) throw new Error(`Unknown fixture '${args.id}'. Options: ${FIXTURES.map((f) => f.id).join(', ')}`);
      return found;
    },
  },
  {
    name: 'hardware_business_model',
    description:
      'Price a hardware business model. Give it a unit price, a unit cost (or a spec to compute one from), minutes of your own labour per unit, monthly volume and fixed costs. Returns gross margin, monthly gross profit, and gross profit per hour of your labour - the yardstick that decides whether a hardware model is a business or a hobby.',
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        unitPriceUsd: { type: 'number' },
        unitCostOverrideUsd: { type: 'number', description: 'Skip the spec and give a unit cost directly.' },
        spec: specSchema,
        costAtQuantity: { type: 'number' },
        labourMinutesOverride: { type: 'number' },
        monthlyVolume: { type: 'number' },
        fixedMonthlyCostUsd: { type: 'number' },
      },
      required: ['unitPriceUsd', 'monthlyVolume'],
    },
    handler: (args) => {
      const inputs = args as Record<string, unknown>;
      return evaluateModel({
        id: String(inputs.label ?? 'model'),
        label: String(inputs.label ?? 'Model'),
        description: String(inputs.description ?? ''),
        unitPriceUsd: Number(inputs.unitPriceUsd),
        unitCostOverrideUsd: inputs.unitCostOverrideUsd !== undefined ? Number(inputs.unitCostOverrideUsd) : undefined,
        spec: inputs.spec ? asSpec(inputs) : undefined,
        costAtQuantity: inputs.costAtQuantity !== undefined ? Number(inputs.costAtQuantity) : undefined,
        labourMinutesOverride: inputs.labourMinutesOverride !== undefined ? Number(inputs.labourMinutesOverride) : undefined,
        monthlyVolume: Number(inputs.monthlyVolume),
        fixedMonthlyCostUsd: inputs.fixedMonthlyCostUsd !== undefined ? Number(inputs.fixedMonthlyCostUsd) : 0,
      });
    },
  },
  {
    name: 'hardware_fulfilment',
    description:
      'Price a delivery model: one unit at a time versus a batched production session. Shows what inbound freight, duty, assembly, coordination and outbound shipping actually cost per unit when the customer still receives exactly one unit.',
    inputSchema: {
      type: 'object',
      properties: {
        partsCostUsd: { type: 'number' },
        assemblyMinutes: { type: 'number' },
        supplierCount: { type: 'number', description: 'How many suppliers feed one object (board, print, hardware).' },
        batchSize: { type: 'number' },
        labourRatePerHourUsd: { type: 'number' },
        outboundShipUsd: { type: 'number' },
        inboundParcelUsd: { type: 'number' },
        priceUsd: { type: 'number' },
        coordinationMinutesPerOrder: { type: 'number' },
        imported: { type: 'boolean' },
      },
      required: ['partsCostUsd', 'assemblyMinutes', 'priceUsd'],
    },
    handler: (args) => {
      const a = args as Record<string, unknown>;
      const n = (k: string, d: number) => (a[k] !== undefined ? Number(a[k]) : d);
      const inputs = {
        partsCostUsd: n('partsCostUsd', 0),
        assemblyMinutes: n('assemblyMinutes', 0),
        supplierCount: n('supplierCount', 3),
        batchSize: n('batchSize', 20),
        labourRatePerHourUsd: n('labourRatePerHourUsd', 35),
        outboundShipUsd: n('outboundShipUsd', 9),
        inboundParcelUsd: n('inboundParcelUsd', 12),
        priceUsd: n('priceUsd', 0),
        coordinationMinutesPerOrder: n('coordinationMinutesPerOrder', 25),
        imported: a.imported !== false,
      };
      return { single: evaluateFulfilment(inputs, 1), batched: evaluateFulfilment(inputs, inputs.batchSize) };
    },
  },
  {
    name: 'hardware_spec_schema',
    description:
      'The ProductSpec JSON shape the harness expects, plus the estimate of assembly minutes for a given spec.',
    inputSchema: { type: 'object', properties: { spec: specSchema } },
    handler: (args) => {
      const shape = {
        id: 'string',
        name: 'string',
        intent: 'string - one sentence',
        referenceRender: 'string - description of the render this must conform to',
        targetRetailUsd: 'number',
        targetQuantities: ['number - e.g. 1, 100, 1000'],
        origin: "'china' | 'domestic' | 'other'",
        power: {
          mainsInside: 'boolean - must be false (keep mains outside via a certified adapter)',
          wireless: "'none' | 'bluetooth' | 'wifi' | 'lte' | 'custom'",
          battery: "'none' | 'lithium' | 'alkaline'",
          usbPowered: 'boolean',
          externalAdapterCertified: 'boolean',
          maxWatts: 'number',
        },
        features: [
          {
            id: 'string',
            label: 'string',
            expectedFace: "'front'|'back'|'left'|'right'|'top'|'bottom'|'internal'",
            actualFace: 'same union - where the design actually put it',
            present: 'boolean',
            cosmetic: 'boolean',
          },
        ],
        parts: [
          {
            id: 'string',
            label: 'string',
            kind: "'custom' | 'catalog'",
            process: `'${Object.keys(PROCESSES).join("' | '")}'`,
            material: `'${Object.keys(MATERIALS).join("' | '")}'`,
            qty: 'number',
            bboxMm: '{ x: number, y: number, z: number }',
            solidFraction: 'number 0-1 (default 0.25) - drives the cost proxy',
            wallMm: 'number',
            draftDeg: 'number',
            toleranceMm: 'number',
            visibleFaces: 'Face[]',
            source: { distributor: "'lcsc'|'authorized'|'broker'|'unknown'", mpn: 'string', inStock: 'boolean', stockVerified: 'boolean', alternates: 'number', partType: "'mcu'|'regulator'|'analog_ic'|'passive'|'connector'|'led'|'motor'|'sensor'|'mechanical'|'enclosure'" },
          },
        ],
        interfaces: [{ id: 'string', between: ['[partId, partId]'], clearanceMm: 'number', contributors: ['partId[]'] }],
        nets: [
          {
            id: 'string',
            name: 'string - e.g. "3V3_RAIL", "I2C_SDA"',
            signal: "'power'|'gnd'|'i2c'|'spi'|'uart'|'usb'|'gpio'|'analog'|'rf'|'other'",
            endpoints: [{ part: 'partId', pin: 'string - e.g. "GPIO4", "VCC", "D+"' }],
            voltage: 'number - for power nets',
          },
        ],
        operations: [{ id: 'string', label: 'string', minutes: 'number', improvised: 'boolean', wireCount: 'number' }],
        certificationsBudgeted: ['cert ids'],
        requiresSignedDrivers: 'boolean - USB audio/HID needing a signed OS driver',
        costDisclosed: 'boolean - false if no cost was published',
        cad: { opensClean: 'boolean', watertight: 'boolean', requiresManualRepair: 'boolean', ercClean: 'boolean', drcClean: 'boolean' },
        producedBy: 'string - which model or team made this',
      };
      const out: Record<string, unknown> = { schema: shape };
      if (args.spec) {
        const spec = asSpec(args);
        out.estimatedAssemblyMinutes = estimateAssemblyMinutes(spec);
      }
      return out;
    },
  },
];

function send(message: unknown): void {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function reply(id: number | string | null | undefined, result: unknown): void {
  send({ jsonrpc: '2.0', id: id ?? null, result });
}

function replyError(id: number | string | null | undefined, code: number, message: string): void {
  send({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
}

function handle(req: JsonRpcRequest): void {
  switch (req.method) {
    case 'initialize':
      reply(req.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;
    case 'notifications/initialized':
      return; // notification - no response
    case 'ping':
      reply(req.id, {});
      return;
    case 'tools/list':
      reply(req.id, {
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });
      return;
    case 'tools/call': {
      const name = req.params?.name as string;
      const args = (req.params?.arguments as Record<string, unknown>) ?? {};
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) {
        replyError(req.id, -32602, `Unknown tool '${name}'.`);
        return;
      }
      try {
        const result = tool.handler(args);
        const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        reply(req.id, { content: [{ type: 'text', text }], isError: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        reply(req.id, { content: [{ type: 'text', text: `Error: ${message}` }], isError: true });
      }
      return;
    }
    default:
      if (req.id !== undefined) replyError(req.id, -32601, `Method not found: ${req.method}`);
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
  buffer += chunk;
  let index = buffer.indexOf('\n');
  while (index !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) {
      try {
        handle(JSON.parse(line) as JsonRpcRequest);
      } catch {
        replyError(null, -32700, 'Parse error');
      }
    }
    index = buffer.indexOf('\n');
  }
});

process.stdin.on('end', () => process.exit(0));
