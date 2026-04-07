/**
 * Story 17.7: Document Template Content
 * Tiptap JSON structures for 5 initial Swedish compliance templates.
 * Placeholder text uses italic marks — users replace these with real content.
 */

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

function heading(level: number, text: string) {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

function placeholder(text: string) {
  return {
    type: 'paragraph',
    content: [{ type: 'text', marks: [{ type: 'italic' }], text }],
  }
}

function tableHeader(text: string) {
  return {
    type: 'tableHeader',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  }
}

function tableCell(text: string, italic = true) {
  const marks = italic ? [{ type: 'italic' as const }] : []
  return {
    type: 'tableCell',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', ...(marks.length > 0 ? { marks } : {}), text },
        ],
      },
    ],
  }
}

function tableRow(cells: ReturnType<typeof tableHeader | typeof tableCell>[]) {
  return { type: 'tableRow', content: cells }
}

function table(rows: ReturnType<typeof tableRow>[]) {
  return { type: 'table', content: rows }
}

// ---------------------------------------------------------------------------
// Template types
// ---------------------------------------------------------------------------

export interface TemplateDefinition {
  id: string
  name: string
  description: string
  documentType: string
  sortOrder: number
  content: { type: 'doc'; content: unknown[] }
}

// Deterministic UUIDs for idempotent seeding (RFC 4122 v4 compliant)
export const TEMPLATE_IDS = {
  arbetsmiljopolicy: 'a0000000-0000-4000-a000-000000000001',
  riskbedomning: 'a0000000-0000-4000-a000-000000000002',
  handlingsplan: 'a0000000-0000-4000-a000-000000000003',
  rutin: 'a0000000-0000-4000-a000-000000000004',
  checklista: 'a0000000-0000-4000-a000-000000000005',
} as const

// ---------------------------------------------------------------------------
// 1. Arbetsmiljöpolicy (POLICY)
// ---------------------------------------------------------------------------

export const ARBETSMILJOPOLICY: TemplateDefinition = {
  id: TEMPLATE_IDS.arbetsmiljopolicy,
  name: 'Arbetsmiljöpolicy',
  description:
    'Övergripande policy för arbetsmiljöarbetet med syfte, ansvar, mål och rutiner.',
  documentType: 'POLICY',
  sortOrder: 1,
  content: {
    type: 'doc',
    content: [
      heading(1, 'Arbetsmiljöpolicy'),
      heading(2, 'Syfte'),
      placeholder(
        'Beskriv syftet med denna policy och vilka områden den täcker.'
      ),
      heading(2, 'Ansvar'),
      placeholder(
        'Beskriv vem som ansvarar för arbetsmiljöarbetet — arbetsgivare, chefer, skyddsombud och medarbetare.'
      ),
      heading(2, 'Mål'),
      placeholder(
        'Beskriv de övergripande målen för arbetsmiljön, t.ex. noll arbetsplatsolyckor, god psykosocial arbetsmiljö.'
      ),
      heading(2, 'Rutiner'),
      placeholder(
        'Beskriv de rutiner som gäller för systematiskt arbetsmiljöarbete (SAM), t.ex. riskbedömningar, skyddsronder, incidentrapportering.'
      ),
      heading(2, 'Uppföljning'),
      placeholder(
        'Beskriv hur och när policyn följs upp, t.ex. årlig genomgång, nyckeltal, revisionsdatum.'
      ),
    ],
  },
}

// ---------------------------------------------------------------------------
// 2. Riskbedömning (RISK_ASSESSMENT)
// ---------------------------------------------------------------------------

export const RISKBEDOMNING: TemplateDefinition = {
  id: TEMPLATE_IDS.riskbedomning,
  name: 'Riskbedömning',
  description:
    'Mall för att identifiera, bedöma och hantera risker med riskmatris.',
  documentType: 'RISK_ASSESSMENT',
  sortOrder: 2,
  content: {
    type: 'doc',
    content: [
      heading(1, 'Riskbedömning'),
      heading(2, 'Bakgrund'),
      placeholder(
        'Beskriv bakgrunden till riskbedömningen — vilken verksamhet, avdelning eller process som bedöms.'
      ),
      heading(2, 'Identifierade risker'),
      table([
        tableRow([
          tableHeader('Risk'),
          tableHeader('Sannolikhet'),
          tableHeader('Konsekvens'),
          tableHeader('Riskvärde'),
          tableHeader('Åtgärd'),
        ]),
        tableRow([
          tableCell('Beskriv identifierad risk...'),
          tableCell('Låg/Medel/Hög'),
          tableCell('Låg/Medel/Hög'),
          tableCell('1–9'),
          tableCell('Beskriv planerad åtgärd...'),
        ]),
        tableRow([
          tableCell('Beskriv identifierad risk...'),
          tableCell('Låg/Medel/Hög'),
          tableCell('Låg/Medel/Hög'),
          tableCell('1–9'),
          tableCell('Beskriv planerad åtgärd...'),
        ]),
        tableRow([
          tableCell('Beskriv identifierad risk...'),
          tableCell('Låg/Medel/Hög'),
          tableCell('Låg/Medel/Hög'),
          tableCell('1–9'),
          tableCell('Beskriv planerad åtgärd...'),
        ]),
      ]),
      heading(2, 'Handlingsplan'),
      placeholder(
        'Beskriv den övergripande handlingsplanen baserad på identifierade risker.'
      ),
      heading(2, 'Uppföljning'),
      placeholder(
        'Beskriv hur och när riskbedömningen ska följas upp och revideras.'
      ),
    ],
  },
}

// ---------------------------------------------------------------------------
// 3. Handlingsplan (ACTION_PLAN)
// ---------------------------------------------------------------------------

export const HANDLINGSPLAN: TemplateDefinition = {
  id: TEMPLATE_IDS.handlingsplan,
  name: 'Handlingsplan',
  description: 'Strukturerad plan med åtgärder, ansvariga och deadlines.',
  documentType: 'ACTION_PLAN',
  sortOrder: 3,
  content: {
    type: 'doc',
    content: [
      heading(1, 'Handlingsplan'),
      heading(2, 'Mål'),
      placeholder('Beskriv det övergripande målet med denna handlingsplan.'),
      heading(2, 'Åtgärder'),
      table([
        tableRow([
          tableHeader('Åtgärd'),
          tableHeader('Ansvarig'),
          tableHeader('Deadline'),
          tableHeader('Status'),
        ]),
        tableRow([
          tableCell('Beskriv åtgärden...'),
          tableCell('Ange ansvarig person...'),
          tableCell('ÅÅÅÅ-MM-DD'),
          tableCell('Ej påbörjad'),
        ]),
        tableRow([
          tableCell('Beskriv åtgärden...'),
          tableCell('Ange ansvarig person...'),
          tableCell('ÅÅÅÅ-MM-DD'),
          tableCell('Ej påbörjad'),
        ]),
        tableRow([
          tableCell('Beskriv åtgärden...'),
          tableCell('Ange ansvarig person...'),
          tableCell('ÅÅÅÅ-MM-DD'),
          tableCell('Ej påbörjad'),
        ]),
      ]),
      heading(2, 'Uppföljning'),
      placeholder('Beskriv hur och när handlingsplanen ska följas upp.'),
    ],
  },
}

// ---------------------------------------------------------------------------
// 4. Rutin (PROCEDURE)
// ---------------------------------------------------------------------------

export const RUTIN: TemplateDefinition = {
  id: TEMPLATE_IDS.rutin,
  name: 'Rutin',
  description:
    'Mall för att dokumentera en arbetsrutin med syfte, omfattning och genomförande.',
  documentType: 'PROCEDURE',
  sortOrder: 4,
  content: {
    type: 'doc',
    content: [
      heading(1, 'Rutin'),
      heading(2, 'Syfte'),
      placeholder('Beskriv syftet med denna rutin.'),
      heading(2, 'Omfattning'),
      placeholder(
        'Beskriv vilka verksamheter, avdelningar eller roller som omfattas av rutinen.'
      ),
      heading(2, 'Ansvar'),
      placeholder(
        'Beskriv vem som ansvarar för att rutinen följs och uppdateras.'
      ),
      heading(2, 'Genomförande'),
      placeholder('Beskriv steg för steg hur rutinen ska genomföras.'),
      heading(2, 'Dokumentation'),
      placeholder('Beskriv vilken dokumentation som ska upprättas och sparas.'),
    ],
  },
}

// ---------------------------------------------------------------------------
// 5. Checklista (CHECKLIST)
// ---------------------------------------------------------------------------

export const CHECKLISTA: TemplateDefinition = {
  id: TEMPLATE_IDS.checklista,
  name: 'Checklista',
  description:
    'Checklista med punkter att bocka av, anteckningar och signaturfält.',
  documentType: 'CHECKLIST',
  sortOrder: 5,
  content: {
    type: 'doc',
    content: [
      heading(1, 'Checklista'),
      heading(2, 'Checklista'),
      table([
        tableRow([
          tableHeader('Punkt'),
          tableHeader('Utförd'),
          tableHeader('Kommentar'),
        ]),
        tableRow([
          tableCell('Beskriv checklistepunkten...'),
          tableCell('Ja/Nej', false),
          tableCell('Eventuell kommentar...'),
        ]),
        tableRow([
          tableCell('Beskriv checklistepunkten...'),
          tableCell('Ja/Nej', false),
          tableCell('Eventuell kommentar...'),
        ]),
        tableRow([
          tableCell('Beskriv checklistepunkten...'),
          tableCell('Ja/Nej', false),
          tableCell('Eventuell kommentar...'),
        ]),
      ]),
      heading(2, 'Anteckningar'),
      placeholder('Skriv eventuella anteckningar här.'),
      heading(2, 'Signatur'),
      placeholder('Namn, datum och signatur.'),
    ],
  },
}

// ---------------------------------------------------------------------------
// All templates
// ---------------------------------------------------------------------------

export const TEMPLATES: TemplateDefinition[] = [
  ARBETSMILJOPOLICY,
  RISKBEDOMNING,
  HANDLINGSPLAN,
  RUTIN,
  CHECKLISTA,
]
