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
  // Story 19.8: ≥1 template per WorkspaceDocumentType + GDPR-track minimums.
  dataskyddspolicy: 'a0000000-0000-4000-a000-000000000006',
  incidenthanteringsrutin: 'a0000000-0000-4000-a000-000000000007',
  bitradespolicy: 'a0000000-0000-4000-a000-000000000008',
  arbetsinstruktion: 'a0000000-0000-4000-a000-000000000009',
  rapport: 'a0000000-0000-4000-a000-00000000000a',
  ovrigtDokument: 'a0000000-0000-4000-a000-00000000000b',
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
      heading(2, 'Kontrollpunkter'),
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
// 6. Dataskyddspolicy (POLICY / GDPR) — Story 19.8
// ---------------------------------------------------------------------------

export const DATASKYDDSPOLICY: TemplateDefinition = {
  id: TEMPLATE_IDS.dataskyddspolicy,
  name: 'Dataskyddspolicy',
  description:
    'Policy för behandling av personuppgifter enligt GDPR — principer, rättslig grund, registrerades rättigheter och ansvar.',
  documentType: 'POLICY',
  sortOrder: 6,
  content: {
    type: 'doc',
    content: [
      heading(2, 'Syfte'),
      placeholder(
        'Beskriv syftet: hur verksamheten skyddar personuppgifter och uppfyller dataskyddsförordningen (GDPR).'
      ),
      heading(2, 'Omfattning'),
      placeholder(
        'Beskriv vilka behandlingar, system och roller policyn omfattar (anställda, kunder, leverantörer).'
      ),
      heading(2, 'Principer för behandling'),
      placeholder(
        'Beskriv principerna: laglighet, ändamålsbegränsning, uppgiftsminimering, korrekthet, lagringsminimering, integritet och konfidentialitet.'
      ),
      heading(2, 'Rättslig grund'),
      placeholder(
        'Beskriv vilka rättsliga grunder verksamheten stödjer sina behandlingar på (avtal, rättslig förpliktelse, berättigat intresse, samtycke).'
      ),
      heading(2, 'Registrerades rättigheter'),
      placeholder(
        'Beskriv hur verksamheten hanterar begäran om registerutdrag, rättelse, radering och dataportabilitet — och inom vilken tid.'
      ),
      heading(2, 'Ansvar'),
      placeholder(
        'Beskriv ansvarsfördelningen: personuppgiftsansvarig, eventuellt dataskyddsombud, chefer och medarbetare.'
      ),
      heading(2, 'Uppföljning och revidering'),
      placeholder(
        'Beskriv hur efterlevnaden följs upp och hur ofta policyn revideras (minst årligen).'
      ),
    ],
  },
}

// ---------------------------------------------------------------------------
// 7. Incidenthanteringsrutin (PROCEDURE) — Story 19.8
// ---------------------------------------------------------------------------

export const INCIDENTHANTERINGSRUTIN: TemplateDefinition = {
  id: TEMPLATE_IDS.incidenthanteringsrutin,
  name: 'Incidenthanteringsrutin',
  description:
    'Rutin för att upptäcka, rapportera, hantera och följa upp incidenter — inklusive personuppgiftsincidenter med 72-timmarsfristen.',
  documentType: 'PROCEDURE',
  sortOrder: 7,
  content: {
    type: 'doc',
    content: [
      heading(2, 'Syfte och omfattning'),
      placeholder(
        'Beskriv vilka incidenter rutinen omfattar (driftstörningar, säkerhetsincidenter, personuppgiftsincidenter) och vem den gäller.'
      ),
      heading(2, 'Ansvar'),
      placeholder(
        'Beskriv roller: vem tar emot rapporter, vem leder hanteringen, vem beslutar om anmälan till myndighet.'
      ),
      heading(2, 'Rapportering'),
      placeholder(
        'Beskriv hur en incident rapporteras internt: kanal, vad rapporten ska innehålla, tidskrav (omedelbart/inom 24 timmar).'
      ),
      heading(2, 'Hantering och åtgärd'),
      placeholder(
        'Beskriv stegen: bekräfta och begränsa incidenten, bedöm allvarlighetsgrad, åtgärda, dokumentera beslut.'
      ),
      heading(2, 'Anmälan till myndighet'),
      placeholder(
        'Beskriv när och hur anmälan sker — en personuppgiftsincident anmäls till IMY inom 72 timmar om den medför risk för registrerades rättigheter.'
      ),
      heading(2, 'Uppföljning och lärdomar'),
      placeholder(
        'Beskriv hur incidenter följs upp, dokumenteras i incidentregistret och hur lärdomar återförs till verksamheten.'
      ),
    ],
  },
}

// ---------------------------------------------------------------------------
// 8. Personuppgiftsbiträdes- och leverantörspolicy (POLICY / GDPR) — Story 19.8
// ---------------------------------------------------------------------------

export const BITRADESPOLICY: TemplateDefinition = {
  id: TEMPLATE_IDS.bitradespolicy,
  name: 'Personuppgiftsbiträdes- och leverantörspolicy',
  description:
    'Policy för anlitande av personuppgiftsbiträden och leverantörer — krav på biträdesavtal, säkerhetskrav och uppföljning.',
  documentType: 'POLICY',
  sortOrder: 8,
  content: {
    type: 'doc',
    content: [
      heading(2, 'Syfte'),
      placeholder(
        'Beskriv syftet: säkerställa att personuppgifter som behandlas av biträden och leverantörer skyddas enligt GDPR.'
      ),
      heading(2, 'Omfattning'),
      placeholder(
        'Beskriv vilka leverantörsrelationer policyn omfattar (molntjänster, lönehantering, IT-drift m.m.).'
      ),
      heading(2, 'Krav på biträdesavtal'),
      placeholder(
        'Beskriv kravet: personuppgiftsbiträdesavtal (PUB-avtal) tecknas innan behandling påbörjas, med instruktioner, säkerhetskrav och underbiträdesregler.'
      ),
      heading(2, 'Säkerhets- och lokaliseringskrav'),
      placeholder(
        'Beskriv kraven på tekniska och organisatoriska skyddsåtgärder samt var uppgifter får behandlas (tredjelandsöverföring).'
      ),
      heading(2, 'Uppföljning av leverantörer'),
      placeholder(
        'Beskriv hur efterlevnaden hos biträden följs upp: granskningar, intyg, revisionsrätt och intervall.'
      ),
      heading(2, 'Ansvar'),
      placeholder(
        'Beskriv vem som godkänner nya biträden, vem som förvaltar avtalsregistret och vem som beslutar vid avvikelser.'
      ),
    ],
  },
}

// ---------------------------------------------------------------------------
// 9. Arbetsinstruktion (INSTRUCTION) — Story 19.8
// ---------------------------------------------------------------------------

export const ARBETSINSTRUKTION: TemplateDefinition = {
  id: TEMPLATE_IDS.arbetsinstruktion,
  name: 'Arbetsinstruktion',
  description:
    'Steg-för-steg-instruktion för en enskild arbetsuppgift: förberedelser, utförande, återställning och agerande vid fel.',
  documentType: 'INSTRUCTION',
  sortOrder: 9,
  content: {
    type: 'doc',
    content: [
      heading(2, 'Uppgift och giltighet'),
      placeholder(
        'Beskriv arbetsuppgiften, var/vilken utrustning instruktionen gäller och vem som får utföra den (behörighet/utbildning).'
      ),
      heading(2, 'Före arbetet'),
      placeholder(
        'Lista förberedelser och säkerhetskontroller: skyddsutrustning, avspärrning, frånkoppling.'
      ),
      heading(2, 'Utförande'),
      placeholder(
        'Lista stegen i strikt ordning, ett moment per steg. Lägg varningar före det steg de gäller.'
      ),
      heading(2, 'Efter arbetet'),
      placeholder(
        'Beskriv återställning, kontroll och eventuell rapportering.'
      ),
      heading(2, 'Vid fel eller tillbud'),
      placeholder('Beskriv när arbetet ska avbrytas och vem som kontaktas.'),
    ],
  },
}

// ---------------------------------------------------------------------------
// 10. Rapport (REPORT) — Story 19.8
// ---------------------------------------------------------------------------

export const RAPPORT: TemplateDefinition = {
  id: TEMPLATE_IDS.rapport,
  name: 'Rapport',
  description:
    'Mall för utrednings-, revisions- eller uppföljningsrapport: sammanfattning, underlag, iakttagelser och rekommendationer.',
  documentType: 'REPORT',
  sortOrder: 10,
  content: {
    type: 'doc',
    content: [
      heading(2, 'Sammanfattning'),
      placeholder(
        'Sammanfatta slutsatserna i 3–5 meningar så att de kan läsas fristående.'
      ),
      heading(2, 'Bakgrund och syfte'),
      placeholder(
        'Beskriv vad som föranlett rapporten, vilken fråga den besvarar och vilken period/omfattning den täcker.'
      ),
      heading(2, 'Underlag och metod'),
      placeholder(
        'Beskriv vad som granskats: dokument, intervjuer, mätningar, platsbesök.'
      ),
      heading(2, 'Iakttagelser och resultat'),
      placeholder(
        'Redovisa iakttagelserna grupperade per område. Skilj fakta från bedömningar.'
      ),
      heading(2, 'Slutsatser och rekommendationer'),
      placeholder(
        'Beskriv vad som följer av iakttagelserna. Varje rekommendation ska kunna härledas till en iakttagelse.'
      ),
    ],
  },
}

// ---------------------------------------------------------------------------
// 11. Övrigt dokument (OTHER) — Story 19.8
// ---------------------------------------------------------------------------

export const OVRIGT_DOKUMENT: TemplateDefinition = {
  id: TEMPLATE_IDS.ovrigtDokument,
  name: 'Övrigt dokument',
  description:
    'Friform-mall för dokument som inte passar någon specifik typ — med syfte, innehåll och ansvar.',
  documentType: 'OTHER',
  sortOrder: 11,
  content: {
    type: 'doc',
    content: [
      heading(2, 'Syfte'),
      placeholder('Beskriv varför dokumentet finns och vad det reglerar.'),
      heading(2, 'Innehåll'),
      placeholder(
        'Skriv dokumentets sakinnehåll med rubriker som passar materialet.'
      ),
      heading(2, 'Ansvar och uppdatering'),
      placeholder('Beskriv vem som äger dokumentet och när det ses över.'),
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
  // Story 19.8 — coverage for every WorkspaceDocumentType + GDPR-track minimums.
  DATASKYDDSPOLICY,
  INCIDENTHANTERINGSRUTIN,
  BITRADESPOLICY,
  ARBETSINSTRUKTION,
  RAPPORT,
  OVRIGT_DOKUMENT,
]
