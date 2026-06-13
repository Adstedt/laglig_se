/* eslint-disable no-console */
/**
 * Story 26.6 Task 2 — stage demo data for the five funktioner-page screenshot
 * sessions. Targets the EXISTING demo workspaces only (no new workspaces, no
 * new auth logins — QA-26.4-M):
 *
 *  - Nordviken (laglista/uppgifter/styrdokument shots): Almåsa scrub of
 *    workspace documents (titles + version content), tasks topped up to 12 in
 *    mixed states, the brief's 4 styrdokument incl. a dual-state doc, and an
 *    agent-draft PendingAgentAction (DRAFT_DOCUMENT, IN_EDITOR) for the
 *    AI-utkast shot.
 *  - Vitnäset (kravpunkter shots): PSL SFS 2010:659 kravpunkter extended to
 *    9 (6 uppfyllda), assignees per persona, bevis_required + evidence links
 *    (1 file + 1 styrdokument), compliance_narrative.
 *  - Tärnudden (lagandringar shots): 7 workspace-scoped ChangeAssessments on
 *    existing REAL ChangeEvents + ONE synthetic ChangeEvent (REPEAL of
 *    SFS 2018:1174 by cybersäkerhetslagen SFS 2025:1506 — factually true, so
 *    other workspaces in this DB that see it see correct information).
 *    Synthetic-event id is printed for the cleanup script
 *    (scripts/cleanup-26-6-synthetic-events.ts).
 *
 * Deliberate deviation from the brief's shot spec: NO synthetic
 * METADATA_UPDATE / NEW_RULING events — ChangeEvents are global and this DB
 * contains real workspaces; fabricated rulings would surface as false
 * information outside the demo workspaces.
 *
 * Idempotent: looks up by title/unique keys before creating.
 *
 * Run: pnpm tsx scripts/seed-26-6-feature-staging.ts
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

// eslint-disable-next-line import/first
import { PrismaClient, Prisma } from '@prisma/client'
// eslint-disable-next-line import/first
import { tiptapDocToHtml } from '@/lib/documents/tiptap-to-html'

const prisma = new PrismaClient()

const NORDVIKEN = 'e4cd55b0-8b2c-4209-bd19-0b40f50f04f1'
const VITNASET = '35b08947-57ec-4773-ac53-b138edded1e8'
const TARNUDDEN = '673fbcaa-bc0c-4bf8-b45e-33e9ce73ea3e'

// Personas (existing users — verified 2026-06-12)
const ANNA = '1389c227-6143-4ccb-b630-7d2b9f7b69b2' // ADMIN everywhere (demo login)
const SOFIA = '54611138-8ef9-40ed-83da-1708e7d4bad0' // Nordviken HR
const ERIK = 'cb98cac2-5cf1-4ed3-9988-5eded193765e' // Nordviken
const JOHAN = '89458ad7-dbfa-4b36-9596-0f5e84182d44' // Nordviken
const MARIA = 'a0bc2eeb-5570-4b6f-9d99-efa7d5bbace1' // Nordviken
const KARIN = '4868ade5-352e-4f0c-aba9-1bd76a485d61' // Vitnäset
const MIKAEL = 'b82bcc75-ebfa-491f-97cf-cc5fcdb22df6' // Vitnäset
const EVA = 'a9cfc698-8fd3-4bbb-bec1-a49d30c97ffe' // Vitnäset
const DAVID = '261f5e0c-9842-411c-bac7-2ead861073a7' // Tärnudden ADMIN
const SARA = 'e75baf7a-9b4d-4011-af10-6329a48616ef' // Tärnudden
const JONAS = 'e176571a-75d7-4921-a13b-343929e05a51' // Tärnudden
const LINA = '53821bc1-95a3-4909-a115-14511faf5ef9' // Tärnudden HR

function extractPlaintext(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type TiptapNode = Record<string, unknown>
function h(level: number, text: string): TiptapNode {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}
function p(text: string): TiptapNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}
function doc(...content: TiptapNode[]): Prisma.InputJsonValue {
  return { type: 'doc', content } as Prisma.InputJsonValue
}

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(10, 0, 0, 0)
  return d
}

// ---------------------------------------------------------------------------
// 1. Almåsa scrub (standing constraint — Almåsa is never referenceable)
// ---------------------------------------------------------------------------
async function scrubAlmasa() {
  console.log('\n--- Almåsa scrub (Nordviken workspace documents) ---')
  const docs = await prisma.workspaceDocument.findMany({
    where: { title: { contains: 'Almåsa', mode: 'insensitive' } },
    select: { id: true, title: true },
  })
  for (const d of docs) {
    const title = d.title.replace(
      /Almåsa Havshotell AB|Almåsa Havshotell|Almåsa/gi,
      'Nordviken Hotell & Konferens AB'
    )
    await prisma.workspaceDocument.update({
      where: { id: d.id },
      data: { title },
    })
    console.log(`retitled: "${d.title}" → "${title}"`)
  }
  const versions = await prisma.workspaceDocumentVersion.findMany({
    where: {
      OR: [
        { content_html: { contains: 'Almåsa', mode: 'insensitive' } },
        { extracted_text: { contains: 'Almåsa', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      content_json: true,
      content_html: true,
      extracted_text: true,
    },
  })
  for (const v of versions) {
    const fix = (s: string) =>
      s.replace(
        /Almåsa Havshotell AB|Almåsa Havshotell|Almåsa/gi,
        'Nordviken Hotell & Konferens AB'
      )
    await prisma.workspaceDocumentVersion.update({
      where: { id: v.id },
      data: {
        content_json: JSON.parse(
          fix(JSON.stringify(v.content_json))
        ) as Prisma.InputJsonValue,
        content_html: fix(v.content_html),
        extracted_text: v.extracted_text ? fix(v.extracted_text) : null,
      },
    })
  }
  console.log(`scrubbed content in ${versions.length} document versions`)
}

// ---------------------------------------------------------------------------
// 2. Nordviken tasks → 12 total, mixed states (uppgifter shots)
// ---------------------------------------------------------------------------
async function stageNordvikenTasks() {
  console.log('\n--- Nordviken tasks (uppgifter shots) ---')
  const cols = await prisma.taskColumn.findMany({
    where: { workspace_id: NORDVIKEN },
  })
  const col = (name: string) => {
    const c = cols.find((c) => c.name === name)
    if (!c) throw new Error(`TaskColumn "${name}" missing in Nordviken`)
    return c.id
  }

  // Drop obvious test junk so it can't wander into a screenshot
  const junk = await prisma.task.deleteMany({
    where: { workspace_id: NORDVIKEN, title: 'Test' },
  })
  if (junk.count) console.log(`deleted ${junk.count} junk task(s) ("Test")`)

  // Give the four existing seeded tasks assignees + due dates (all were
  // unassigned/no-due — the lista shot needs named ansvariga + date mix)
  const fixups: Array<{ title: string; assignee: string; due: Date | null }> = [
    {
      title: 'Upprätta systematiskt arbetsmiljöarbete (SAM)',
      assignee: ANNA,
      due: daysFromNow(14),
    },
    {
      title: 'Implementera rutin för MBL 38 §-förhandlingar',
      assignee: SOFIA,
      due: daysFromNow(-6), // overdue
    },
    {
      title: 'Granska diskrimineringspolicyn',
      assignee: MARIA,
      due: daysFromNow(21),
    },
    {
      title: 'Genomför och dokumentera årlig riskbedömning (MBL)',
      assignee: ERIK,
      due: daysFromNow(-2), // overdue
    },
  ]
  for (const f of fixups) {
    await prisma.task.updateMany({
      where: { workspace_id: NORDVIKEN, title: f.title },
      data: { assignee_id: f.assignee, due_date: f.due },
    })
  }
  console.log('updated 4 existing tasks (assignees + due dates)')

  // Hotel-flavored new tasks (brief: mixed columns/priorities, 1 CRITICAL,
  // ≥2 overdue, descriptions on ~half, comments on 2)
  const newTasks: Array<{
    title: string
    column: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    assignee: string | null
    due: Date | null
    description?: string
    completed?: boolean
    comments?: Array<{ author: string; content: string }>
  }> = [
    {
      title: 'Åtgärda brandskyddsanmärkning i konferensflygeln',
      column: 'Pågående',
      priority: 'CRITICAL',
      assignee: JOHAN,
      due: daysFromNow(-3),
      description:
        'Anmärkning från egenkontrollen: blockerad utrymningsväg vid lastkajen och två armaturer i nödbelysningen som inte fungerar. Åtgärdas och dokumenteras innan nästa kontroll.',
      comments: [
        {
          author: ANNA,
          content:
            'Utrymningsvägen är rensad sedan i fredags — väntar på elektrikern för nödbelysningen.',
        },
        {
          author: JOHAN,
          content:
            'Elektrikern bokad till på torsdag, uppdaterar efter besöket.',
        },
      ],
    },
    {
      title: 'Genomför säkerhetskontroll av hotellrum våning 3–5',
      column: 'Att göra',
      priority: 'MEDIUM',
      assignee: ERIK,
      due: daysFromNow(7),
      description:
        'Kontrollera brandvarnare, utrymningsplaner på dörrarnas insida och fönsterspärrar enligt rutinen för rumssäkerhet.',
    },
    {
      title: 'Uppdatera kemikalieförteckningen för housekeeping',
      column: 'Pågående',
      priority: 'MEDIUM',
      assignee: MARIA,
      due: daysFromNow(10),
      description:
        'Två nya rengöringsprodukter har tagits in — säkerhetsdatablad ska läggas till och riskbedömningen uppdateras.',
    },
    {
      title: 'Planera utrymningsövning för kvällspersonalen',
      column: 'Att göra',
      priority: 'HIGH',
      assignee: SOFIA,
      due: daysFromNow(30),
      description:
        'Kvällsskiftet har inte deltagit i någon övning i år. Samordna med restaurangchefen så att övningen täcker både reception och kök.',
      comments: [
        {
          author: SOFIA,
          content: 'Förslag: vecka 27, tisdag efter frukostserveringen.',
        },
      ],
    },
    {
      title: 'Införskaffa hörselskydd till diskrummet',
      column: 'Klar',
      priority: 'LOW',
      assignee: JOHAN,
      due: daysFromNow(-14),
      completed: true,
    },
    {
      title: 'Dokumentera introduktionsutbildning för sommarvikarier',
      column: 'Att göra',
      priority: 'MEDIUM',
      assignee: SOFIA,
      due: null,
    },
    {
      title: 'Se över rutin för hantering av gästers personuppgifter',
      column: 'Att göra',
      priority: 'MEDIUM',
      assignee: ANNA,
      due: daysFromNow(45),
      description:
        'Bokningssystemets gallringstider ska stämma mot dataskyddsbeskrivningen — kontrollera även samtyckestexterna på webben.',
    },
    {
      title: 'Kalibrera kyltemperaturloggarna i frukostköket',
      column: 'Klar',
      priority: 'MEDIUM',
      assignee: MARIA,
      due: null,
      completed: true,
    },
  ]

  let created = 0
  for (const t of newTasks) {
    const exists = await prisma.task.findFirst({
      where: { workspace_id: NORDVIKEN, title: t.title },
    })
    if (exists) continue
    const maxPos = await prisma.task.aggregate({
      where: { workspace_id: NORDVIKEN, column_id: col(t.column) },
      _max: { position: true },
    })
    const task = await prisma.task.create({
      data: {
        workspace_id: NORDVIKEN,
        column_id: col(t.column),
        title: t.title,
        description: t.description ?? null,
        priority: t.priority,
        assignee_id: t.assignee,
        due_date: t.due,
        created_by: ANNA,
        position: (maxPos._max.position ?? 0) + 1,
        completed_at: t.completed ? daysFromNow(-1) : null,
      },
    })
    for (const c of t.comments ?? []) {
      await prisma.comment.create({
        data: {
          workspace_id: NORDVIKEN,
          author_id: c.author,
          content: c.content,
          task_id: task.id,
          mentions: [],
        },
      })
    }
    created++
  }
  console.log(`created ${created} new tasks`)

  // Link the riskbedömning task to its law (LinkedLawsBox in the modal shot)
  const riskTask = await prisma.task.findFirst({
    where: {
      workspace_id: NORDVIKEN,
      title: 'Genomför och dokumentera årlig riskbedömning (MBL)',
    },
  })
  const samItem = await prisma.lawListItem.findFirst({
    where: {
      law_list: { workspace_id: NORDVIKEN },
      document: { document_number: 'AFS 2023:1' },
    },
  })
  if (riskTask && samItem) {
    await prisma.taskListItemLink.upsert({
      where: {
        task_id_law_list_item_id: {
          task_id: riskTask.id,
          law_list_item_id: samItem.id,
        },
      },
      create: { task_id: riskTask.id, law_list_item_id: samItem.id },
      update: {},
    })
    console.log('linked riskbedömning task → AFS 2023:1 list item')
  }
}

// ---------------------------------------------------------------------------
// 3. Nordviken styrdokument (4 docs per brief) + agent IN_EDITOR action
// ---------------------------------------------------------------------------
async function createDocWithVersions(args: {
  workspaceId: string
  title: string
  type: 'POLICY' | 'PROCEDURE' | 'INSTRUCTION' | 'OTHER'
  content: Prisma.InputJsonValue
  createdBy: string
  state: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'DUAL'
  approvedBy?: string
  reviewDate?: Date
  draftV2Content?: Prisma.InputJsonValue
  draftV2By?: string
}): Promise<string> {
  const existing = await prisma.workspaceDocument.findFirst({
    where: { workspace_id: args.workspaceId, title: args.title },
  })
  if (existing) {
    console.log(`exists, skipping: ${args.title}`)
    return existing.id
  }
  const html = tiptapDocToHtml(args.content)
  const now = new Date()
  const approvedAt = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30) // ~1 month ago
  const id = await prisma.$transaction(async (tx) => {
    const d = await tx.workspaceDocument.create({
      data: {
        workspace_id: args.workspaceId,
        title: args.title,
        document_type: args.type,
        created_by: args.createdBy,
        current_version_number: 1,
        review_date: args.reviewDate ?? null,
      },
    })
    const v1 = await tx.workspaceDocumentVersion.create({
      data: {
        document_id: d.id,
        version_number: 1,
        source: 'TIPTAP',
        content_json: args.content,
        content_html: html,
        extracted_text: extractPlaintext(html),
        created_by: args.createdBy,
        ...(args.state === 'APPROVED' || args.state === 'DUAL'
          ? { approved_at: approvedAt, approved_by: args.approvedBy ?? ANNA }
          : {}),
      },
    })
    if (args.state === 'DRAFT' || args.state === 'IN_REVIEW') {
      await tx.workspaceDocument.update({
        where: { id: d.id },
        data: {
          current_version_id: v1.id,
          current_draft_version_id: v1.id,
          draft_status: args.state === 'IN_REVIEW' ? 'IN_REVIEW' : 'DRAFT',
          status: args.state === 'IN_REVIEW' ? 'IN_REVIEW' : 'DRAFT',
        },
      })
    } else {
      await tx.workspaceDocument.update({
        where: { id: d.id },
        data: {
          current_version_id: v1.id,
          current_approved_version_id: v1.id,
          status: 'APPROVED',
          approved_by: args.approvedBy ?? ANNA,
          approved_at: approvedAt,
        },
      })
    }
    if (args.state === 'DUAL') {
      const v2Content = args.draftV2Content ?? args.content
      const v2Html = tiptapDocToHtml(v2Content)
      const v2 = await tx.workspaceDocumentVersion.create({
        data: {
          document_id: d.id,
          version_number: 2,
          source: 'TIPTAP',
          content_json: v2Content,
          content_html: v2Html,
          extracted_text: extractPlaintext(v2Html),
          created_by: args.draftV2By ?? args.createdBy,
          change_summary: 'Förtydligad eskalering och nya kontaktvägar',
        },
      })
      await tx.workspaceDocument.update({
        where: { id: d.id },
        data: {
          current_draft_version_id: v2.id,
          draft_status: 'DRAFT',
          current_version_number: 2,
        },
      })
    }
    await tx.activityLog.create({
      data: {
        workspace_id: args.workspaceId,
        user_id: args.createdBy,
        entity_type: 'workspace_document',
        entity_id: d.id,
        action: 'document_created',
        new_value: { title: args.title, document_type: args.type },
      },
    })
    return d.id
  })
  console.log(`created [${args.state}] ${args.title}`)
  return id
}

async function stageNordvikenDocuments() {
  console.log('\n--- Nordviken styrdokument (4 docs + agent draft) ---')
  await createDocWithVersions({
    workspaceId: NORDVIKEN,
    title: 'Säkerhetspolicy för gäster och personal',
    type: 'POLICY',
    createdBy: ANNA,
    approvedBy: ANNA,
    state: 'APPROVED',
    reviewDate: new Date('2026-12-31'),
    content: doc(
      h(1, 'Säkerhetspolicy för gäster och personal'),
      h(2, 'Syfte'),
      p(
        'Policyn beskriver hur Nordviken Hotell & Konferens AB arbetar för att gäster och medarbetare ska vistas i en trygg och säker miljö, och hur säkerhetsarbetet hänger ihop med det systematiska arbetsmiljöarbetet.'
      ),
      h(2, 'Omfattning'),
      p(
        'Policyn gäller samtliga medarbetare, inhyrd personal och entreprenörer som arbetar i hotellets lokaler, samt alla utrymmen som gäster har tillgång till.'
      ),
      h(2, 'Ansvar'),
      p(
        'VD bär det yttersta ansvaret. Hotellchefen ansvarar för det löpande säkerhetsarbetet och varje avdelningschef för att rutinerna följs i den egna verksamheten.'
      ),
      h(2, 'Uppföljning'),
      p(
        'Policyn följs upp årligen i samband med ledningens genomgång och revideras vid behov, till exempel när lagstiftning eller verksamhet förändras.'
      )
    ),
  })
  await createDocWithVersions({
    workspaceId: NORDVIKEN,
    title: 'Rutiner för incidentrapportering',
    type: 'PROCEDURE',
    createdBy: ANNA,
    approvedBy: SOFIA,
    state: 'DUAL',
    draftV2By: ANNA,
    content: doc(
      h(1, 'Rutiner för incidentrapportering'),
      h(2, 'När ska en incident rapporteras?'),
      p(
        'Alla olyckor, tillbud och säkerhetsavvikelser som rör gäster eller medarbetare rapporteras samma dag till närmaste chef. Allvarliga olyckor och tillbud anmäls utan dröjsmål till Arbetsmiljöverket enligt 3 kap. 3 a § arbetsmiljölagen.'
      ),
      h(2, 'Hur rapporterar jag?'),
      p(
        'Incidenten dokumenteras i incidentformuläret med tid, plats, inblandade och händelseförlopp. Närmaste chef bedömer allvarlighetsgrad och beslutar om omedelbara åtgärder.'
      ),
      h(2, 'Uppföljning'),
      p(
        'Hotellchefen går igenom samtliga incidenter månadsvis, identifierar mönster och beslutar om förebyggande åtgärder.'
      )
    ),
    draftV2Content: doc(
      h(1, 'Rutiner för incidentrapportering'),
      h(2, 'När ska en incident rapporteras?'),
      p(
        'Alla olyckor, tillbud och säkerhetsavvikelser som rör gäster eller medarbetare rapporteras samma dag till närmaste chef. Allvarliga olyckor och tillbud anmäls utan dröjsmål till Arbetsmiljöverket enligt 3 kap. 3 a § arbetsmiljölagen.'
      ),
      h(2, 'Hur rapporterar jag?'),
      p(
        'Incidenten dokumenteras i incidentformuläret med tid, plats, inblandade och händelseförlopp. Närmaste chef bedömer allvarlighetsgrad och beslutar om omedelbara åtgärder.'
      ),
      h(2, 'Eskalering'),
      p(
        'Vid allvarliga personskador, brand eller utrymning kontaktas hotellchefen omedelbart på journumret. Hotellchefen ansvarar för kontakt med myndigheter och anhöriga samt för att händelsen dokumenteras fullständigt.'
      ),
      h(2, 'Uppföljning'),
      p(
        'Hotellchefen går igenom samtliga incidenter månadsvis, identifierar mönster och beslutar om förebyggande åtgärder. Statistiken redovisas kvartalsvis för ledningsgruppen.'
      )
    ),
  })
  await createDocWithVersions({
    workspaceId: NORDVIKEN,
    title: 'Instruktion för datasäkerhet',
    type: 'INSTRUCTION',
    createdBy: ANNA,
    state: 'IN_REVIEW',
    content: doc(
      h(1, 'Instruktion för datasäkerhet'),
      h(2, 'Lösenord och inloggning'),
      p(
        'Alla system med gästuppgifter kräver individuella inloggningar och tvåfaktorsautentisering. Lösenord delas aldrig mellan medarbetare.'
      ),
      h(2, 'Hantering av gästuppgifter'),
      p(
        'Bokningsuppgifter får endast hanteras i bokningssystemet. Listor med gästnamn skrivs inte ut annat än när utrymningsrutinen kräver det, och förstörs direkt efter användning.'
      ),
      h(2, 'Incidenter'),
      p(
        'Misstänkt dataintrång eller förlorad utrustning rapporteras omedelbart till hotellchefen enligt rutinen för incidentrapportering.'
      )
    ),
  })
  await createDocWithVersions({
    workspaceId: NORDVIKEN,
    title: 'Dataskyddsbeskrivning',
    type: 'OTHER',
    createdBy: ANNA,
    state: 'DRAFT',
    content: doc(
      h(1, 'Dataskyddsbeskrivning'),
      h(2, 'Personuppgifter vi behandlar'),
      p(
        'Vi behandlar gästers namn, kontaktuppgifter och bokningshistorik för att fullgöra avtalet om logi, samt medarbetares uppgifter för anställningsförhållandet.'
      ),
      h(2, 'Lagringstider'),
      p(
        'Bokningsuppgifter gallras 24 månader efter avslutad vistelse om inte bokföringslagen kräver längre lagring. Ansökningshandlingar gallras efter avslutad rekrytering.'
      ),
      h(2, 'Rättigheter'),
      p(
        'Registrerade kan begära registerutdrag, rättelse och radering via receptionen eller dataskydd@-adressen. Begäran besvaras inom en månad.'
      )
    ),
  })

  // Agent draft → IN_EDITOR pending action (the AI-utkast screenshot)
  console.log('\n--- Agent IN_EDITOR pending action ---')
  const draftTitle = 'Rutin för hantering av personuppgiftsincidenter'
  const existing = await prisma.pendingAgentAction.findFirst({
    where: {
      workspace_id: NORDVIKEN,
      action_type: 'DRAFT_DOCUMENT',
      status: 'IN_EDITOR',
    },
  })
  if (existing) {
    console.log(
      `IN_EDITOR action exists: ${existing.id} (doc ${(existing.result_ref as { documentId?: string })?.documentId})`
    )
    return
  }
  const draftContent = doc(
    h(1, 'Rutin för hantering av personuppgiftsincidenter'),
    h(2, 'Vad är en personuppgiftsincident?'),
    p(
      'En händelse som leder till oavsiktlig eller olaglig förstöring, förlust, ändring eller obehörigt röjande av personuppgifter — till exempel ett felskickat mejl med gästlistor eller ett intrång i bokningssystemet.'
    ),
    h(2, 'Omedelbara åtgärder'),
    p(
      'Den som upptäcker incidenten kontaktar omedelbart hotellchefen. Berörda system isoleras och händelsen dokumenteras med tidpunkt, omfattning och vilka uppgifter som berörs.'
    ),
    h(2, 'Anmälan till IMY'),
    p(
      'Hotellchefen bedömer om incidenten ska anmälas till Integritetsskyddsmyndigheten. Anmälan görs inom 72 timmar från upptäckt om incidenten medför risk för de registrerades rättigheter.'
    ),
    h(2, 'Information till de registrerade'),
    p(
      'Vid hög risk informeras berörda gäster eller medarbetare utan onödigt dröjsmål om vad som hänt och vilka åtgärder som vidtagits.'
    )
  )
  const draftHtml = tiptapDocToHtml(draftContent)
  await prisma.$transaction(async (tx) => {
    const d = await tx.workspaceDocument.create({
      data: {
        workspace_id: NORDVIKEN,
        title: draftTitle,
        document_type: 'PROCEDURE',
        created_by: ANNA,
        current_version_number: 1,
      },
    })
    const v1 = await tx.workspaceDocumentVersion.create({
      data: {
        document_id: d.id,
        version_number: 1,
        source: 'AGENT',
        content_json: draftContent,
        content_html: draftHtml,
        extracted_text: extractPlaintext(draftHtml),
        created_by: 'agent',
      },
    })
    await tx.workspaceDocument.update({
      where: { id: d.id },
      data: {
        current_version_id: v1.id,
        current_draft_version_id: v1.id,
        draft_status: 'DRAFT',
      },
    })
    const msg = await tx.chatMessage.create({
      data: {
        workspace_id: NORDVIKEN,
        user_id: ANNA,
        role: 'ASSISTANT',
        content:
          'Jag har skrivit ett utkast till "Rutin för hantering av personuppgiftsincidenter" utifrån era krav enligt GDPR. Öppna utkastet i editorn för att granska och slutföra godkännandet.',
        context_type: 'GLOBAL',
      },
    })
    const action = await tx.pendingAgentAction.create({
      data: {
        workspace_id: NORDVIKEN,
        user_id: ANNA,
        chat_message_id: msg.id,
        context_type: 'GLOBAL',
        action_type: 'DRAFT_DOCUMENT',
        status: 'IN_EDITOR',
        params: {
          title: draftTitle,
          docType: 'PROCEDURE',
          contentJson: draftContent,
        } as Prisma.InputJsonValue,
        result_ref: { documentId: d.id } as Prisma.InputJsonValue,
        expires_at: daysFromNow(7),
      },
    })
    console.log(
      `created agent draft doc ${d.id} + IN_EDITOR action ${action.id}`
    )
    console.log(
      `screenshot URL: /workspace/styrdokument/${d.id}/edit?agentApprovalId=${action.id}`
    )
  })
}

// ---------------------------------------------------------------------------
// 4. Vitnäset PSL kravpunkter (kravpunkter shots)
// ---------------------------------------------------------------------------
async function stageVitnasetKravpunkter() {
  console.log('\n--- Vitnäset PSL kravpunkter ---')
  const psl = await prisma.lawListItem.findFirst({
    where: {
      law_list: { workspace_id: VITNASET },
      document: { document_number: 'SFS 2010:659' },
    },
    include: { requirements: true },
  })
  if (!psl) throw new Error('Vitnäset PSL item missing — run the vård seed')

  // Update the three seeded requirements per the brief's modal composition
  const updates: Array<{
    match: string
    responsible: string
    fulfilled: boolean
    bevisRequired: boolean
  }> = [
    {
      match: 'Patientsäkerhetsberättelse',
      responsible: KARIN,
      fulfilled: true,
      bevisRequired: true,
    },
    {
      match: 'avvikelsehantering',
      responsible: MIKAEL,
      fulfilled: false,
      bevisRequired: true, // 0 evidence → amber "Saknar bevis"
    },
    {
      match: 'vårdgivarregister',
      responsible: EVA,
      fulfilled: true,
      bevisRequired: false,
    },
  ]
  for (const u of updates) {
    const req = psl.requirements.find((r) => r.text.includes(u.match))
    if (!req) continue
    await prisma.lawListItemRequirement.update({
      where: { id: req.id },
      data: {
        responsible_user_id: u.responsible,
        is_fulfilled: u.fulfilled,
        bevis_required: u.bevisRequired,
      },
    })
  }
  console.log('updated 3 seeded requirements (assignees/status/bevis)')

  // Add 6 more vård kravpunkter → 9 total, 6 uppfyllda
  const extra: Array<{
    text: string
    fulfilled: boolean
    responsible: string | null
    bevisRequired: boolean
  }> = [
    {
      text: 'Verksamhetschef enligt HSL är utsedd och anmäld.',
      fulfilled: true,
      responsible: EVA,
      bevisRequired: false,
    },
    {
      text: 'Rutin för klagomål och synpunkter från patienter och närstående finns och är känd.',
      fulfilled: true,
      responsible: KARIN,
      bevisRequired: false,
    },
    {
      text: 'Egenkontroll av följsamhet till basala hygienrutiner genomförs och dokumenteras.',
      fulfilled: false,
      responsible: MIKAEL,
      bevisRequired: true,
    },
    {
      text: 'Informationsskyldigheten mot patient vid vårdskada (lex Maria) är dokumenterad i rutin.',
      fulfilled: true,
      responsible: KARIN,
      bevisRequired: false,
    },
    {
      text: 'Legitimerad personals behörighet kontrolleras mot HOSP-registret vid anställning.',
      fulfilled: true,
      responsible: EVA,
      bevisRequired: false,
    },
    {
      text: 'Riskanalys genomförs inför väsentliga förändringar i verksamheten.',
      fulfilled: false,
      responsible: null, // inherited-assignee visual
      bevisRequired: false,
    },
  ]
  let pos = psl.requirements.length
  let added = 0
  for (const e of extra) {
    const exists = await prisma.lawListItemRequirement.findFirst({
      where: { list_item_id: psl.id, text: e.text },
    })
    if (exists) continue
    await prisma.lawListItemRequirement.create({
      data: {
        list_item_id: psl.id,
        text: e.text,
        is_fulfilled: e.fulfilled,
        bevis_required: e.bevisRequired,
        responsible_user_id: e.responsible,
        position: pos++,
        created_by: ANNA,
      },
    })
    added++
  }
  console.log(`added ${added} kravpunkter (target 9 total, 6 uppfyllda)`)

  // Evidence: 1 uploaded file + 1 linked styrdokument on the
  // patientsäkerhetsberättelse requirement
  const evidenceDoc = await createDocWithVersions({
    workspaceId: VITNASET,
    title: 'Rutiner för avvikelserapportering',
    type: 'PROCEDURE',
    createdBy: ANNA,
    approvedBy: KARIN,
    state: 'APPROVED',
    content: doc(
      h(1, 'Rutiner för avvikelserapportering'),
      h(2, 'Rapportering'),
      p(
        'Alla avvikelser i vården rapporteras i avvikelsesystemet samma dag. Medarbetaren beskriver händelsen, omedelbara åtgärder och bedömd risk.'
      ),
      h(2, 'Utredning och återkoppling'),
      p(
        'Verksamhetschefen utreder händelsen, beslutar om åtgärder och återkopplar till berörd personal. Allvarliga vårdskador anmäls enligt lex Maria.'
      )
    ),
  })
  let file = await prisma.workspaceFile.findFirst({
    where: {
      workspace_id: VITNASET,
      filename: 'Patientsäkerhetsberättelse-2026.pdf',
    },
  })
  if (!file) {
    file = await prisma.workspaceFile.create({
      data: {
        workspace_id: VITNASET,
        uploaded_by: ANNA,
        is_folder: false,
        filename: 'Patientsäkerhetsberättelse-2026.pdf',
        original_filename: 'Patientsäkerhetsberättelse-2026.pdf',
        file_size: 412688,
        mime_type: 'application/pdf',
        storage_path: `${VITNASET}/demo/patientsakerhetsberattelse-2026.pdf`,
        extraction_status: 'PENDING',
      },
    })
    console.log('created WorkspaceFile Patientsäkerhetsberättelse-2026.pdf')
  }
  const psbReq = await prisma.lawListItemRequirement.findFirst({
    where: {
      list_item_id: psl.id,
      text: { contains: 'Patientsäkerhetsberättelse' },
    },
  })
  if (psbReq) {
    const links = [
      { file_id: file.id, workspace_document_id: null },
      { file_id: null, workspace_document_id: evidenceDoc },
    ]
    for (const l of links) {
      const exists = await prisma.requirementEvidenceLink.findFirst({
        where: {
          requirement_id: psbReq.id,
          file_id: l.file_id,
          workspace_document_id: l.workspace_document_id,
        },
      })
      if (!exists) {
        await prisma.requirementEvidenceLink.create({
          data: {
            requirement_id: psbReq.id,
            file_id: l.file_id,
            workspace_document_id: l.workspace_document_id,
            linked_by: ANNA,
          },
        })
      }
    }
    console.log('linked file + styrdokument as evidence on PSB requirement')
  }

  // Compliance narrative + status on the law item (brief interior 3)
  await prisma.lawListItem.update({
    where: { id: psl.id },
    data: {
      compliance_status: 'PAGAENDE',
      priority: 'MEDIUM',
      compliance_narrative:
        'Patientsäkerhetsarbetet utgår från patientsäkerhetsberättelsen som upprättas årligen senast 1 mars. Avvikelser hanteras enligt vår dokumenterade rutin och allvarliga vårdskador anmäls enligt lex Maria. Två kravpunkter pågår: egenkontrollen av basala hygienrutiner ska dokumenteras systematiskt och riskanalysrutinen inför verksamhetsförändringar håller på att tas fram.',
      compliance_narrative_updated_at: new Date(),
      compliance_narrative_updated_by: ANNA,
    },
  })
  console.log('set compliance narrative + PÅGÅENDE/MEDIUM on PSL item')
}

// ---------------------------------------------------------------------------
// 5. Tärnudden change assessments + one factual REPEAL event
// ---------------------------------------------------------------------------
async function stageTarnuddenChanges() {
  console.log('\n--- Tärnudden lagändringar ---')

  // 5a. Synthetic REPEAL: SFS 2018:1174 upphävd av cybersäkerhetslagen
  // (SFS 2025:1506, i kraft 15 jan 2026) — factually true.
  const nis1 = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2018:1174' },
    select: { id: true, content_type: true },
  })
  if (!nis1) throw new Error('SFS 2018:1174 missing from catalog')
  let repeal = await prisma.changeEvent.findFirst({
    where: { document_id: nis1.id, change_type: 'REPEAL' },
  })
  if (!repeal) {
    repeal = await prisma.changeEvent.create({
      data: {
        document_id: nis1.id,
        content_type: nis1.content_type,
        change_type: 'REPEAL',
        amendment_sfs: 'SFS 2025:1506',
        ai_summary:
          'Lagen om informationssäkerhet för samhällsviktiga och digitala tjänster (NIS-lagen) har upphävts och ersatts av cybersäkerhetslagen (2025:1506), som trädde i kraft den 15 januari 2026. Den nya lagen genomför NIS2-direktivet och omfattar fler verksamheter, ställer högre krav på riskhantering och incidentrapportering samt inför ett personligt ansvar för ledningen. Verksamheter som omfattades av NIS-lagen behöver bedöma sin klassning och sina skyldigheter enligt den nya lagen.',
        ai_summary_generated_at: new Date(),
        detected_at: daysFromNow(-4),
        processed_at: daysFromNow(-4),
      },
    })
    console.log(`created SYNTHETIC REPEAL event ${repeal.id} on SFS 2018:1174`)
    console.log(
      'NOTE: factually-true repeal (NIS1 → cybersäkerhetslagen). Remove with scripts/cleanup-26-6-synthetic-events.ts after the shoot if desired.'
    )
  } else {
    console.log(`REPEAL event already exists: ${repeal.id}`)
  }

  // 5b. Seven workspace-scoped assessments on real events (+ the repeal)
  const tarnItems = await prisma.lawListItem.findMany({
    where: { law_list: { workspace_id: TARNUDDEN } },
    select: {
      id: true,
      document: { select: { id: true, document_number: true } },
    },
  })
  const itemByDoc = new Map(
    tarnItems.map((i) => [i.document.document_number, i])
  )
  const findEvent = async (docNumber: string, amendmentSfs?: string) => {
    const item = itemByDoc.get(docNumber)
    if (!item) return null
    const ev = await prisma.changeEvent.findFirst({
      where: {
        document_id: item.document.id,
        ...(amendmentSfs ? { amendment_sfs: amendmentSfs } : {}),
      },
      orderBy: { detected_at: 'desc' },
    })
    return ev ? { event: ev, item } : null
  }

  const plans: Array<{
    doc: string
    amendment?: string
    status: 'REVIEWED' | 'ACTION_REQUIRED' | 'NOT_APPLICABLE' | 'DEFERRED'
    impact: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
    by: string
    daysAgo: number
    notes: string
  }> = [
    {
      doc: 'SFS 2018:1174',
      status: 'ACTION_REQUIRED',
      impact: 'HIGH',
      by: DAVID,
      daysAgo: 2,
      notes:
        'NIS-lagen är upphävd och ersatt av cybersäkerhetslagen. Vi behöver bedöma om vi klassas som väsentlig eller viktig verksamhet enligt den nya lagen och uppdatera incidentrutinen.',
    },
    {
      doc: 'SFS 2025:1506',
      status: 'ACTION_REQUIRED',
      impact: 'HIGH',
      by: DAVID,
      daysAgo: 3,
      notes:
        'Ny lag som sannolikt omfattar vår molnplattform. Registrering hos tillsynsmyndigheten och uppdaterad riskhantering krävs — uppgifter skapade för kartläggningen.',
    },
    {
      doc: 'SFS 1977:1160',
      amendment: 'SFS 2026:731',
      status: 'REVIEWED',
      impact: 'MEDIUM',
      by: LINA,
      daysAgo: 4,
      notes:
        'Ändringen rör arbetsgivarens ansvar vid distansarbete. Vår arbetsmiljöpolicy täcker redan hemarbetsplatser — ingen rutinändring krävs nu.',
    },
    {
      doc: 'SFS 2022:482',
      amendment: 'SFS 2026:537',
      status: 'REVIEWED',
      impact: 'LOW',
      by: SARA,
      daysAgo: 5,
      notes:
        'Mindre justering av definitionerna. Påverkar inte vår tjänsteleverans — bevakar fortsatt praxis från PTS.',
    },
    {
      doc: 'SFS 1982:673',
      amendment: 'SFS 2026:198',
      status: 'REVIEWED',
      impact: 'MEDIUM',
      by: LINA,
      daysAgo: 6,
      notes:
        'Förtydligade krav på registrering av arbetstid vid flexibla upplägg. Tidrapporteringen i vårt HR-system uppfyller kraven.',
    },
    {
      doc: 'SFS 2005:59',
      amendment: 'SFS 2026:246',
      status: 'NOT_APPLICABLE',
      impact: 'NONE',
      by: JONAS,
      daysAgo: 6,
      notes:
        'Ändringen gäller ångerrätt vid hemförsäljning till konsument. Vi säljer enbart B2B — ej tillämplig.',
    },
    {
      doc: 'SFS 2018:1174',
      amendment: 'SFS 2022:508',
      status: 'DEFERRED',
      impact: 'LOW',
      by: SARA,
      daysAgo: 7,
      notes:
        'Historisk ändring som ersätts av övergången till cybersäkerhetslagen — bedömningen tas i samband med den större NIS2-genomgången.',
    },
  ]

  let createdCount = 0
  for (const plan of plans) {
    const found = await findEvent(plan.doc, plan.amendment)
    if (!found) {
      console.log(`SKIP (no event found): ${plan.doc} ${plan.amendment ?? ''}`)
      continue
    }
    const existing = await prisma.changeAssessment.findUnique({
      where: {
        change_event_id_law_list_item_id: {
          change_event_id: found.event.id,
          law_list_item_id: found.item.id,
        },
      },
    })
    if (existing) continue
    await prisma.changeAssessment.create({
      data: {
        change_event_id: found.event.id,
        law_list_item_id: found.item.id,
        workspace_id: TARNUDDEN,
        status: plan.status,
        impact_level: plan.impact,
        user_notes: plan.notes,
        assessed_by: plan.by,
        assessed_at: daysFromNow(-plan.daysAgo),
      },
    })
    createdCount++
  }
  console.log(`created ${createdCount} change assessments (target 7)`)
}

async function main() {
  await scrubAlmasa()
  await stageNordvikenTasks()
  await stageNordvikenDocuments()
  await stageVitnasetKravpunkter()
  await stageTarnuddenChanges()
  console.log('\nDONE — Story 26.6 Task 2 staging complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
