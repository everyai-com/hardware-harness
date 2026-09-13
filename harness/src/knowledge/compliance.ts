/**
 * Certification requirements and component sourcing rules.
 *
 * Two of the four hard gates live here: certification (you cannot legally sell it)
 * and sourcing integrity (a counterfeit MCU is worse than no MCU).
 */

export interface CertRequirement {
  id: string;
  label: string;
  trigger: string;
  costUsd: [number, number] | null;
  /** null cost means: required, but no reliable public price - budget a placeholder. */
  verified: boolean;
  notes: string[];
}

export const CERTIFICATIONS: CertRequirement[] = [
  {
    id: 'fcc_unintentional',
    label: 'FCC Part 15 - unintentional radiator',
    trigger: 'Any device with electronics that does not intentionally transmit',
    costUsd: [3000, 5000],
    verified: true,
    notes: ['Published 2025/26 lab pricing.', 'Conduct ISED (Canada) simultaneously to halve the added cost.'],
  },
  {
    id: 'fcc_module',
    label: 'FCC - device using a pre-certified radio module',
    trigger: 'Uses an FCC-certified module as-is',
    costUsd: [6500, 10000],
    verified: true,
    notes: ['Streamlined versus a full radio certification, but still a filing.'],
  },
  {
    id: 'fcc_radio',
    label: 'FCC - Bluetooth / WiFi / LTE',
    trigger: 'Intentional radiator, including a module you integrate and re-antenna',
    costUsd: [9000, 12000],
    verified: true,
    notes: ['The most common certification type for consumer gadgets.', 'This single line kills most $40 connected products.'],
  },
  {
    id: 'fcc_licensed',
    label: 'FCC - licensed / non-precertified modules',
    trigger: 'Custom radio design',
    costUsd: [12000, 15000],
    verified: true,
    notes: [],
  },
  {
    id: 'ul_etl_mains',
    label: 'UL / ETL safety listing (mains)',
    trigger: 'Line voltage anywhere inside the product',
    costUsd: null,
    verified: false,
    notes: [
      'Required for plug-in electrical products, and marketplaces demand it (Amazon requires an ETL or UL listing for most).',
      'A UL test report from an ISO 17025 lab can satisfy marketplaces without a full listing.',
      'AVOIDANCE STRATEGY: keep mains outside the product. A USB-C lamp running from a pre-certified external adapter has no mains inside, which removes this line entirely.',
    ],
  },
  {
    id: 'un383',
    label: 'UN38.3 (lithium transport)',
    trigger: 'Any lithium cell',
    costUsd: [1500, 4000],
    verified: false,
    notes: [
      'Attaches to the cell, not the product, and shipping becomes a separate project.',
      'Do not put a lithium cell in a one-off build.',
    ],
  },
  {
    id: 'eu_ce',
    label: 'CE marking (LVD + EMC + RED + RoHS)',
    trigger: 'Selling into the EU',
    costUsd: [2000, 8000],
    verified: false,
    notes: ['Test simultaneously with FCC to avoid paying twice for the same setup.'],
  },
  {
    id: 'eu_battery',
    label: 'EU Battery Regulation 2023/1542',
    trigger: 'Battery in an EU-sold product',
    costUsd: null,
    verified: false,
    notes: ['Mandatory since Aug 2024. Carbon footprint declarations and digital battery passports by 2027.'],
  },
  {
    id: 'eu_gpsr',
    label: 'EU GPSR responsible person',
    trigger: 'Selling into the EU',
    costUsd: null,
    verified: false,
    notes: ['Requires an EU-based responsible party. You cannot drop-ship around this.'],
  },
  {
    id: 'cpsia',
    label: 'CPSIA / children\'s product testing',
    trigger: 'Product appeals to or is intended for children under 12',
    costUsd: [2000, 10000],
    verified: false,
    notes: ['The render-driven category has a habit of producing cute objects that legally count as toys.'],
  },
];

export interface SourcingChannel {
  id: string;
  label: string;
  role: string;
  traceability: string;
  priceIndex: number;
  rules: string[];
}

export const SOURCING_CHANNELS: SourcingChannel[] = [
  {
    id: 'lcsc',
    label: 'LCSC / JLCPCB parts library',
    role: 'Passives and Asia-specific semiconductors; lines up with JLCPCB assembly',
    traceability: 'Good, not franchised',
    priceIndex: 0.85,
    rules: [
      'Use for resistors, capacitors, inductors, connectors and Asian-market ICs.',
      'Gives access to the JLCPCB assembly library, which removes a whole class of assembly errors.',
      'Programmatic: LCSC API for part search, JLCPCB API for orders.',
    ],
  },
  {
    id: 'authorized',
    label: 'Authorised distributor (DigiKey, Mouser, Arrow, Avnet)',
    role: 'Any programmable, analog or precision part',
    traceability: 'Franchised - manufacturer-backed',
    priceIndex: 1.0,
    rules: [
      'Mandatory for MCUs, voltage regulators, analog ICs, FPGAs and precision references.',
      'Costs 5-15% more than grey market and effectively removes counterfeit exposure on that line.',
      'This is the trade: 5-15% versus a fake chip that fails after assembly.',
    ],
  },
  {
    id: 'broker',
    label: 'Broker / grey market / marketplace',
    role: 'Never, for anything programmable',
    traceability: 'None',
    priceIndex: 0.7,
    rules: [
      'The most counterfeited part types are analog ICs, voltage regulators and popular MCUs (STM32F103 class).',
      'If an independent distributor is unavoidable: require AS6081 process and a Certificate of Conformance.',
      '"it nearly ordered me knockoffs" - a practitioner, on letting an agent source parts unsupervised.',
    ],
  },
];

export const SOURCING_RULES = {
  /** Authorised channels cost this much more and are worth it on the part types above. */
  authorizedPremiumPct: [5, 15] as [number, number],
  /** Counterfeits concentrate here - ERAI tracking data. */
  highRiskPartTypes: [
    'analog ICs',
    'voltage regulators',
    'popular microcontrollers (e.g. STM32F103 class)',
  ],
  /** PCBA houses frequently reject partial reels. */
  packagingRule: 'Confirm reel vs cut tape. Assembly houses often require full reels with 50+ leader strips.',
  /** JLCPCB/PCBWay order minimums. */
  minimums: [
    'JLCPCB API accepts programmatic PCB, stencil and 3D print orders.',
    'PCBWay order minimum as low as 5 pieces.',
    'SendCutSend has no minimum order - 1-500 parts.',
  ],
  source: 'ERAI counterfeit tracking; pcbcart authorised-vs-grey analysis; findmychip China sourcing 2026',
};

/**
 * Kits and subassemblies - the rules that decide whether you can sell parts of a
 * product instead of the product.
 *
 * The hope is usually that selling a kit dodges certification. It does not.
 * The legal path is subassemblies, and it is the one the whole maker industry uses.
 */
export const KIT_AND_SUBASSEMBLY_RULES = {
  kitDefinition: 'FCC 15.3: any number of electronic parts which, when assembled per the instructions, result in a device subject to these rules.',
  kitVerdict:
    'A marketed kit that assembles into a complete product is NOT exempt. Certification follows the completed device, kit or not.',
  fccPosition:
    'KDB 927445: an individual may construct a device for personal use without authorisation, "but it may not be marketed as a kit."',
  homeBuildExemption:
    'Section 15.23: authorisation is not required for devices that are not marketed, are not constructed from a kit, and are built in quantities of five or less for personal use.',
  subassemblyPath:
    'FCC 15.101: no authorisation is required for a peripheral device or subassembly that is sold for further fabrication - the buyer becomes the responsible manufacturer of the finished product. This is how SparkFun and Adafruit legally sell uncertified boards.',
  practicalRules: [
    'Selling a complete-product kit (a wireless gadget in pieces) does not avoid certification. Do not build a business on that assumption.',
    'Selling subassemblies - boards, modules, verified part sets - is exempt, because the buyer assembles and owns the finished device.',
    'Your customer building one device for personal use is inside the 15.23 exemption; the moment they sell it, they are a manufacturer.',
    'That boundary is a natural upsell: most makers will eventually want to sell what they built, and that is when they pay for a certification path.',
    'A finished product with no radio, no mains and no battery triggers none of this. It is the cleanest place to start.',
  ],
  source: 'FCC 15.3, 15.23, 15.101 and KDB 927445, via EMC FastPass analysis of kits and subassemblies',
};

export const DEFECT_RATE_REALITY = {
  maturePct: 3,
  firstProductPct: 15,
  note: 'Adafruit\'s hardware-startup guide: "A 2% defective rate would be amazing, but don\'t be surprised if it\'s 15% when you start." Budget the remake, the return shipping both ways, and the support time.',
  source: 'Adafruit, How To Build A Hardware Startup - Pricing Your Product',
};

export const PRICING_GUIDANCE = {
  targetGrossMarginPct: 50,
  retailMultiplierOnParts: 2.75,
  quote: 'If your gross margin is less than 50% your price is too low.',
  workedExample: '$10 of parts -> $16.50 wholesale -> $27.50 retail.',
  source: 'Adafruit, How To Build A Hardware Startup - Pricing Your Product',
};
