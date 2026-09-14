/**
 * The failure taxonomy.
 *
 * Every entry is a failure that has already happened in public, with the evidence
 * attached. This is the accumulated asset: models change every few weeks, these
 * observations do not. The taxonomy explains a failure to a human; `ruleId` names
 * the rule that catches it from a spec, where one exists. Two entries deliberately
 * have none - they are what only a physical build can find.
 */

export interface FailureMode {
  id: string;
  label: string;
  /** What actually goes wrong. */
  symptom: string;
  /** The rule that catches it, if one exists. */
  ruleId?: string;
  evidence: string;
  /** Which runs surfaced it. */
  observedIn: string[];
}

export const FAILURE_TAXONOMY: FailureMode[] = [
  {
    id: 'feature-misplacement',
    label: 'Feature on the wrong face',
    symptom: 'Geometry matches the silhouette, but a named feature faces the wrong way - the "face" ends up on the back of the base.',
    ruleId: 'FEATURE_MISPLACED',
    evidence: 'Astra scores 95.9% on BenchCAD (geometric overlap) and still placed the face on the back.',
    observedIn: ['Keil lamp run, Astra design'],
  },
  {
    id: 'render-cad-divergence',
    label: 'The CAD disagrees with the render it came from',
    symptom: 'The delivered model looks nothing like the concept image that was approved.',
    ruleId: 'RENDER_CAD_DIVERGENCE',
    evidence: '"it assembled you a 3d model that looks completely different from the concept"',
    observedIn: ['DJ controller thread'],
  },
  {
    id: 'dfm-violation',
    label: 'Unmouldable / unprintable geometry',
    symptom: 'The hero shape violates wall, draft and undercut rules. Only SLS can make it, and it costs multiples of the budget.',
    ruleId: 'DRAFT_MISSING',
    evidence: '"violating every DFM principle... impossible for injection molding and a nightmare for FDM and SLA. Only viable tech for that shape is SLS in nylon, $50 for part this big."',
    observedIn: ['DJ controller thread (independent engineer review)'],
  },
  {
    id: 'tolerance-stack',
    label: 'Nominal CAD fits, the batch does not',
    symptom: 'Every dimension is in spec and the assembly still will not close on the second run.',
    ruleId: 'TOLERANCE_STACK',
    evidence: '"cad can fit nominal parts, but tolerance stacks decide whether batch two assembles"',
    observedIn: ['DJ controller thread'],
  },
  {
    id: 'part-count-blowup',
    label: 'Part count explodes',
    symptom: 'Dozens of frame pieces, each with its own tolerance, fastener and instruction step.',
    ruleId: 'PART_COUNT_HIGH',
    evidence: '"HOW many frame pieces is that?"',
    observedIn: ['DJ controller thread'],
  },
  {
    id: 'knockoff-parts',
    label: 'Agent sourced counterfeit parts',
    symptom: 'The BOM looks cheap and correct. The parts are re-marked, out-of-spec or dead.',
    ruleId: 'COUNTERFEIT_RISK',
    evidence: '"sourcing is easy to mess up - last time I had it look for components, it nearly ordered me knockoffs"',
    observedIn: ['DJ controller thread'],
  },
  {
    id: 'moq-blowup',
    label: 'Agent committed to an MOQ nobody approved',
    symptom: 'A real order for 500 units against a one-off request, charged to the card.',
    ruleId: 'MOQ_MISMATCH',
    evidence: '"have your agent pay for 500 MOQ and charge your credit card without realizing"',
    observedIn: ['DJ controller thread'],
  },
  {
    id: 'wrong-part-for-constraint',
    label: 'Correct-looking part that cannot meet the real requirement',
    symptom: 'An MCU that cannot do real-time audio, chosen because it looks right on the BOM.',
    ruleId: 'TOLERANCE_UNACHIEVABLE',
    evidence: '"Probably wouldn\'t use a pi for real-time"',
    observedIn: ['DJ controller thread'],
  },
  {
    id: 'drivers-unbudgeted',
    label: 'Driver signing costs more than the hardware',
    symptom: 'A USB audio device ships and Windows will not trust it.',
    ruleId: 'DRIVER_SIGNING_UNBUDGETED',
    evidence: '$500-1,000 for signed low-latency audio drivers - absent from every AI-generated BOM',
    observedIn: ['DJ controller thread (practitioner BOM breakdown)'],
  },
  {
    id: 'pcb-errors',
    label: 'Generated PCB arrives full of errors',
    symptom: 'Boards fab correctly and do not function; the builder falls back to breadboarding.',
    evidence: '"The pcbs had a lot of errors so i ended up breadboarding it"',
    observedIn: ['DJ controller thread (first-hand builder)'],
  },
  {
    id: 'no-cost-disclosed',
    label: 'No cost disclosed',
    symptom: 'Design published, invoice withheld. Buyers cannot evaluate, so they assume the worst.',
    ruleId: 'COST_NOT_DISCLOSED',
    evidence: '23 cost questions with 0 answers on the viral thread; cost is first on Keil\'s own rubric and still unpublished',
    observedIn: ['DJ controller thread', 'Keil lamp run'],
  },
  {
    id: 'single-source',
    label: 'Part has no second source',
    symptom: 'One component goes out of stock and the entire build stops.',
    ruleId: 'NO_SECOND_SOURCE',
    evidence: '"how does it handle component substitutions when specific chips are unavailable during assembly?"',
    observedIn: ['DJ controller thread'],
  },
  {
    id: 'surface-finish-mismatch',
    label: 'Works, but looks wrong',
    symptom: 'Layer lines, support scars or a matte finish on a face that was supposed to look premium.',
    ruleId: 'SURFACE_QUALITY_MISMATCH',
    evidence: '"This looks nothing like what Teenage Engineering would build... looks like a car stereo from 1997"',
    observedIn: ['DJ controller thread'],
  },
  {
    id: 'certification-surprise',
    label: 'Certification discovered after spending',
    symptom: 'A wireless or mains product that cannot legally be sold.',
    ruleId: 'CERT_GAP',
    evidence: 'FCC $9,000-12,000 for Bluetooth/WiFi; UL/ETL required for mains',
    observedIn: ['RESEARCH.md section 4.2'],
  },
  {
    id: 'assembly-labour',
    label: 'Per-unit assembly labour eats the margin',
    symptom: 'Every unit needs human hands, and there are no economies of scale at qty 1.',
    ruleId: 'ASSEMBLY_TIME_HIGH',
    evidence: 'Contribution per order swings from +$17 to -$28 on a $150 order at a 35% take',
    observedIn: ['OPERATIONS.md per-order model'],
  },
  {
    id: 'no-physical-verification',
    label: 'Nobody ever built it',
    symptom: 'Artifacts ship, a verdict never does. The demo is indistinguishable from a render.',
    evidence: '"It\'s vibe vaporware until you\'re actually hands on"; "Post the invoice for the parts or it never happened"',
    observedIn: ['DJ controller thread (459 comments, no working device shown)'],
  },
];

export function failuresForRule(ruleId: string): FailureMode[] {
  return FAILURE_TAXONOMY.filter((f) => f.ruleId === ruleId);
}
