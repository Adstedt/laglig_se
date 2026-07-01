/**
 * Per-företagsform baseline laws.
 *
 * Replaces the old single `UNIVERSAL_AB_LAWS` list (which was pre-seeded onto
 * every workspace regardless of company form). Baselines are layered:
 *
 *   baseline(form, facts) = UNIVERSAL  +  FORM[form]  +  matched CONDITIONAL
 *
 * All documentIds are real corpus rows (LegalDocument.id), verified present.
 * Groups use the existing law-list taxonomy ("Bolagsrätt", "Skatt & Redovisning",
 * "Arbetsrätt"). Pure module — no I/O, safe to unit-test in isolation.
 *
 * Source for the company-form / registration layer: Bolagsverket's "Lagar för
 * [företagsform]" pages. Deliberately NOT a dump of those pages — event/procedural
 * and poorly-mappable statutes (Föräldrabalken, Prokuralagen, Filiallagen,
 * Kupongskattelagen, financial-sector årsredovisningslagar, ÅRL-for-large-HB) are
 * left out of the deterministic seed; the LLM build + gap-audit passes surface them
 * when genuinely relevant. See the notes at the bottom for the deferred v2 set.
 */

export interface BaselineLaw {
  documentId: string
  group: string
  businessContext: string
}

export type BaselineForm =
  | 'AB'
  | 'HB_KB'
  | 'EF'
  | 'EKONOMISK_FORENING'
  | 'STIFTELSE'
  | 'IDEELL'
  | 'OTHER'

export interface CompanyFacts {
  form: BaselineForm
  /** From CompanyProfile.employee_count. null = unknown. */
  employeeCount: number | null
}

const GROUP = {
  BOLAG: 'Bolagsrätt',
  SKATT: 'Skatt & Redovisning',
  ARBETE: 'Arbetsrätt',
} as const

// ── UNIVERSAL — applies to every form ──────────────────────────────────────
const UNIVERSAL_LAWS: BaselineLaw[] = [
  {
    documentId: '35df26f0-ffed-46ff-b9e1-9fb1d6c5841b', // Bokföringslagen 1999:1078
    group: GROUP.SKATT,
    businessContext:
      'Bokföringslagen kräver löpande bokföring, verifikationer och arkivering av räkenskapsinformation. Gäller alla som bedriver näringsverksamhet och är grundläggande för ekonomifunktionen.',
  },
  {
    documentId: 'f4cd631b-8c7c-4708-afc4-c863974f4d16', // Inkomstskattelagen 1999:1229
    group: GROUP.SKATT,
    businessContext:
      'Inkomstskattelagen reglerar beskattning av verksamhetens resultat. Berör skatteplanering, deklaration och bokslutsdispositioner.',
  },
  {
    documentId: 'b3301284-c87e-4c1f-bf69-3c642fc8249b', // Skatteförfarandelagen 2011:1244
    group: GROUP.SKATT,
    businessContext:
      'Skatteförfarandelagen reglerar deklarationsskyldighet, arbetsgivaravgifter, skatteavdrag och Skatteverkets kontroller.',
  },
  {
    documentId: '620d076d-8095-4963-92d2-43ff542513cb', // Mervärdesskattelagen 2023:200
    group: GROUP.SKATT,
    businessContext:
      'Mervärdesskattelagen reglerar moms på varor och tjänster. Berör fakturering, momsredovisning och avdragsrätt.',
  },
  {
    documentId: '53e6640b-b676-4f95-825f-c84bcf515b8a', // Lag (2018:1653) om företagsnamn
    group: GROUP.BOLAG,
    businessContext:
      'Lagen om företagsnamn skyddar och reglerar företagets namn och kännetecken. Berör registrering, ensamrätt och skydd mot intrång.',
  },
]

// ── FORM — company-form / registration layer, keyed by resolved form ───────
const FORM_LAWS: Record<BaselineForm, BaselineLaw[]> = {
  AB: [
    {
      documentId: '3a1a8e98-2628-4282-8950-a330a3913cdb', // Aktiebolagslagen 2005:551
      group: GROUP.BOLAG,
      businessContext:
        'Aktiebolagslagen reglerar bolagets organisation, styrelseansvar, bolagsstämma, kapitalskydd och utdelning. Grundläggande för all bolagsstyrning.',
    },
    {
      documentId: '0000135a-8db8-461f-aa69-381e8845dd90', // Aktiebolagsförordningen 2005:559
      group: GROUP.BOLAG,
      businessContext:
        'Aktiebolagsförordningen kompletterar aktiebolagslagen med regler om registrering och anmälningar till Bolagsverket.',
    },
    {
      documentId: '653b9d3d-6e14-4481-a975-43f28dde5047', // Årsredovisningslagen 1995:1554
      group: GROUP.SKATT,
      businessContext:
        'Årsredovisningslagen ställer krav på bokslut, årsredovisning och förvaltningsberättelse. Gäller alla aktiebolag.',
    },
    {
      documentId: '7e4edbc4-9a35-426b-bb2f-9ea4ccc232ce', // Verkliga huvudmän 2017:631
      group: GROUP.BOLAG,
      businessContext:
        'Lagen om registrering av verkliga huvudmän kräver att bolaget anmäler och håller uppgifter om sina verkliga huvudmän aktuella hos Bolagsverket.',
    },
  ],
  HB_KB: [
    {
      documentId: 'a17cb460-2ac4-4174-ab88-6b00e50f416b', // Handelsbolagslagen 1980:1102
      group: GROUP.BOLAG,
      businessContext:
        'Lagen om handelsbolag och enkla bolag reglerar bolagsmännens inbördes förhållanden, ansvar och företrädesrätt. Grundläggande för handelsbolag och kommanditbolag.',
    },
    {
      documentId: '96d37616-b9b4-435d-af8d-5f9dc56acb8c', // Handelsregisterlagen 1974:157
      group: GROUP.BOLAG,
      businessContext:
        'Handelsregisterlagen reglerar registrering av bolaget och dess uppgifter i handelsregistret hos Bolagsverket.',
    },
    {
      documentId: '6453d902-6512-4fdb-8354-bb429d2a25e8', // Handelsregisterförordningen 1974:188
      group: GROUP.BOLAG,
      businessContext:
        'Handelsregisterförordningen kompletterar handelsregisterlagen med regler om anmälningar och registrering.',
    },
  ],
  EF: [
    {
      documentId: '96d37616-b9b4-435d-af8d-5f9dc56acb8c', // Handelsregisterlagen 1974:157
      group: GROUP.BOLAG,
      businessContext:
        'Handelsregisterlagen reglerar registrering av den enskilda näringsverksamheten och dess uppgifter i handelsregistret hos Bolagsverket.',
    },
  ],
  EKONOMISK_FORENING: [
    {
      documentId: '4fd4cf72-4e4e-4b55-a0b5-7dd678840eab', // Lag (2018:672) om ekonomiska föreningar
      group: GROUP.BOLAG,
      businessContext:
        'Lagen om ekonomiska föreningar reglerar föreningens organisation, medlemskap, stämma och styrelseansvar. Grundläggande för föreningens styrning.',
    },
  ],
  STIFTELSE: [
    {
      documentId: 'f8ff353e-ab7a-4846-bbf7-3de9a052776d', // Stiftelselagen 1994:1220
      group: GROUP.BOLAG,
      businessContext:
        'Stiftelselagen reglerar stiftelsens förvaltning, ändamål, bokföring och tillsyn. Grundläggande för stiftelsens verksamhet.',
    },
  ],
  // No dedicated corporate statute — run on the universal layer only.
  IDEELL: [],
  OTHER: [],
}

// ── CONDITIONAL — fact-gated, deduped after form layer ─────────────────────
const CONDITIONAL_LAWS: Array<{
  law: BaselineLaw
  appliesIf: (_facts: CompanyFacts) => boolean
}> = [
  {
    // MBL — was previously seeded onto every AB unconditionally. Now gated on
    // employees: applies when there is at least one employee, OR when the count
    // is unknown (preserves prior behavior). Drops only for known-solo firms.
    law: {
      documentId: '3ea0659a-282e-4669-8aa9-827bd23babc8', // Medbestämmandelagen 1976:580
      group: GROUP.ARBETE,
      businessContext:
        'Medbestämmandelagen reglerar informations- och förhandlingsskyldighet gentemot fackliga organisationer. Relevant för arbetsgivare vid större förändringar i verksamheten.',
    },
    appliesIf: ({ employeeCount }) =>
      employeeCount == null || employeeCount >= 1,
  },
  {
    // Styrelserepresentation for privatanställda — only AB with ≥25 employees.
    law: {
      documentId: 'f3dee92d-fc7b-4889-913c-33aacf257774', // Lag 1987:1245
      group: GROUP.ARBETE,
      businessContext:
        'Lagen om styrelserepresentation för de privatanställda ger anställda rätt till styrelserepresentation i företag med minst 25 anställda.',
    },
    appliesIf: ({ form, employeeCount }) =>
      form === 'AB' && employeeCount != null && employeeCount >= 25,
  },
]

/** Swedish display label for progress markers. */
const FORM_LABEL: Record<BaselineForm, string> = {
  AB: 'aktiebolag',
  HB_KB: 'handels-/kommanditbolag',
  EF: 'enskild firma',
  EKONOMISK_FORENING: 'ekonomisk förening',
  STIFTELSE: 'stiftelse',
  IDEELL: 'ideell förening',
  OTHER: 'företag',
}

export function baselineFormLabel(form: BaselineForm): string {
  return FORM_LABEL[form]
}

/**
 * Normalize a raw CompanyProfile.legal_form value to a baseline form key.
 * KB shares HB's law base (both governed by Lag 1980:1102) → HB_KB.
 * Unknown / OVRIGT → OTHER (universal-only, no wrong corporate laws).
 */
export function resolveBaselineForm(
  legalForm: string | null | undefined
): BaselineForm {
  switch ((legalForm ?? '').trim().toUpperCase()) {
    case 'AB':
      return 'AB'
    case 'HB':
    case 'KB':
      return 'HB_KB'
    case 'EF':
      return 'EF'
    case 'EKONOMISK_FORENING':
    case 'EK':
      return 'EKONOMISK_FORENING'
    case 'STIFTELSE':
      return 'STIFTELSE'
    case 'IDEELL':
      return 'IDEELL'
    default:
      return 'OTHER'
  }
}

/**
 * Resolve the deterministic baseline law set for a company:
 * UNIVERSAL + FORM[form] + matched CONDITIONAL, deduped by documentId (first wins).
 */
export function resolveBaselineLaws(facts: CompanyFacts): BaselineLaw[] {
  const candidates: BaselineLaw[] = [
    ...UNIVERSAL_LAWS,
    ...FORM_LAWS[facts.form],
    ...CONDITIONAL_LAWS.filter((c) => c.appliesIf(facts)).map((c) => c.law),
  ]

  const seen = new Set<string>()
  return candidates.filter(
    (law) => !seen.has(law.documentId) && seen.add(law.documentId)
  )
}
