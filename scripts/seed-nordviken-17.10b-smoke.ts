/**
 * One-off seed script for the 17.10b owner smoke (Task 9).
 *
 * Goal: populate three Nordviken DRAFTs with distinct Swedish content so the
 * adversarial smoke seeds can run end-to-end. Mirrors the 17.10 seed pattern
 * but leaves status as DRAFT (vs 17.10 which promoted them to APPROVED to
 * fit the APPROVED-only indexing rule of 17.9b). 17.10b indexes DRAFTs too,
 * which is the whole point of the smoke.
 *
 * Three DRAFTs seeded:
 *   1. Semesterpolicy — supports Smoke A (DRAFT-only retrieval) AND Smoke C
 *      (adversarial "vad är vår officiella semesterpolicy?")
 *   2. Arbetsmiljöpolicy — second DRAFT topic so the agent has variety
 *   3. Diskrimineringspolicy — Revision — NEW doc, DRAFT. Coexists with the
 *      existing APPROVED Diskrimineringspolicys from the 17.10 seed → Smoke B
 *      tests mixed-tier CITE-002 (one [Källa:] + one [Utkast:] in the same
 *      response).
 *
 * Idempotent — safe to re-run. After this seeds the content, run the backfill
 * (`scripts/backfill-workspace-document-drafts.ts --workspace=...`) to chunk
 * the new content into pgvector. The combination exercises both code paths
 * (this seed = direct DB write; backfill = the indexWorkspaceDocument helper
 * via the rollout sweep).
 *
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/seed-nordviken-17.10b-smoke.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const WORKSPACE_ID = 'e4cd55b0-8b2c-4209-bd19-0b40f50f04f1' // Nordviken Hotell & Konferens AB
const OWNER_USER_ID = 'cee3f852-5e08-46e2-be3b-bbde7d152108' // Alexander Adstedt

// --- Content fixtures (real Swedish, AML/semesterlagen/diskrimineringslagen-relevant) ---

const SEMESTERPOLICY_DRAFT = `<h1>Semesterpolicy (UTKAST)</h1>
<p>Denna policy reglerar semesterns intjänande, uttag och utbetalning för
anställda vid Nordviken Hotell & Konferens AB. Policyn är under arbete och
har ännu inte godkänts av ledningen.</p>
<h2>Semesterns längd</h2>
<p>Samtliga heltidsanställda har rätt till minst 25 semesterdagar per
semesterår enligt 4 § semesterlagen (SFS 1977:480). Anställda som omfattas
av kollektivavtal kan ha rätt till fler dagar enligt avtalet.</p>
<h2>Semesterperiod</h2>
<p>Anställda har rätt till minst fyra veckors sammanhängande semester under
perioden juni–augusti (huvudsemester) enligt 12 § semesterlagen. Arbetsgivaren
ska samråda med den anställde om förläggning senast två månader innan
semestern börjar.</p>
<h2>Anmälan och planering</h2>
<p>Anmälan om semester görs i Visma HR-systemet senast den 31 mars för
huvudsemestern. Spontansemester (kortare än 5 dagar) ska anmälas minst två
veckor i förväg och godkännas av närmaste chef.</p>
<h2>Sparad semester</h2>
<p>Anställda får spara högst 5 semesterdagar per år. Sparade dagar måste tas
ut inom fem år enligt 18 § semesterlagen.</p>`

const ARBETSMILJOPOLICY_DRAFT = `<h1>Arbetsmiljöpolicy (UTKAST)</h1>
<p>Denna policy beskriver Nordviken Hotell & Konferens AB:s arbete med
systematiskt arbetsmiljöarbete enligt arbetsmiljölagen (SFS 1977:1160) och
AFS 2001:1 (Systematiskt arbetsmiljöarbete). Policyn är under granskning
och ännu inte godkänd.</p>
<h2>Systematiskt arbetsmiljöarbete</h2>
<p>Vi bedriver ett systematiskt arbetsmiljöarbete som omfattar undersökning,
riskbedömning, åtgärder och uppföljning enligt 3 kap. 2a §
arbetsmiljölagen. Riskbedömningar genomförs minst en gång per år samt vid
förändringar i verksamheten.</p>
<h2>Tillbud och olyckor</h2>
<p>Samtliga tillbud och olyckor rapporteras i avvikelsesystemet inom 24
timmar. Allvarliga tillbud och olyckor anmäls dessutom till
Arbetsmiljöverket enligt 3 kap. 3a § arbetsmiljölagen och AFS 2014:43.</p>
<h2>Skyddsorganisation</h2>
<p>På varje arbetsplats med fler än fem anställda finns ett skyddsombud
enligt 6 kap. 2 § arbetsmiljölagen. Skyddskommitté finns på arbetsplatser
med fler än 50 anställda och sammanträder minst kvartalsvis.</p>
<h2>Företagshälsovård</h2>
<p>Bolaget har avtal med Previa AB för företagshälsovård och erbjuder
hälsoundersökningar vid behov samt obligatoriska medicinska kontroller
för exponerade yrkesgrupper enligt AFS 2019:3.</p>`

const DISKRIMINERINGSPOLICY_REVISION_DRAFT = `<h1>Diskrimineringspolicy — Revision (UTKAST)</h1>
<p>Detta är ett pågående utkast till en revidering av Nordvikens
diskrimineringspolicy. Revisionen kompletterar de gällande HR- och
gästbemötande-versionerna med ett intersektionalitetsperspektiv samt
striktare uppföljning. Utkastet är inte godkänt och utgör inte gällande
policy.</p>
<h2>Bakgrund för revisionen</h2>
<p>Den befintliga diskrimineringspolicyn (godkänd 2026) hanterar de sju
skyddade diskrimineringsgrunderna i 1 kap. 5 § diskrimineringslagen
(SFS 2008:567) som separata kategorier. Revisionen lägger till ett
intersektionalitetsperspektiv som erkänner att flera diskrimineringsgrunder
kan samverka.</p>
<h2>Nya åtgärder i revisionen</h2>
<p>Revisionen föreslår tre nya åtgärder:</p>
<p>1. Obligatorisk årlig diskrimineringsutbildning för alla chefer och
arbetsledare via Diskrimineringsombudsmannens (DO) e-learningplattform.</p>
<p>2. Anonym anmälningskanal för diskriminering via tredjepartstjänst
(WhistleB) — utöver de befintliga interna kanalerna.</p>
<p>3. Halvårsvis statistisk uppföljning av rekryterings- och
befordringsbeslut för att upptäcka strukturella mönster, i enlighet med
3 kap. diskrimineringslagen om aktiva åtgärder.</p>
<h2>Status</h2>
<p>Utkastet är under granskning av HR-chef och fackliga representanter.
Beräknad godkännandetid: Q3 2026.</p>`

async function main() {
  console.log('=== seed-nordviken-17.10b-smoke ===')
  console.log()

  // --- 1. Update existing "Semesterpolicy" DRAFT (the one without minderåriga) ---
  // The Nordviken inventory has both "Semesterpolicy" and "Semesterpolicy för
  // minderåriga anställda" — pick the plain one (most natural smoke prompt).
  const semesterpolicies = await prisma.workspaceDocument.findMany({
    where: { workspace_id: WORKSPACE_ID, title: 'Semesterpolicy' },
    select: { id: true, status: true, current_version_id: true },
  })
  if (semesterpolicies.length === 0) {
    throw new Error('Expected at least one "Semesterpolicy" DRAFT in Nordviken')
  }
  const semesterpolicy = semesterpolicies[0]! // take the first if multiple
  await upsertDraftContent(
    semesterpolicy.id,
    semesterpolicy.current_version_id,
    SEMESTERPOLICY_DRAFT,
    'Semesterpolicy'
  )

  // --- 2. Update existing "Arbetsmiljöpolicy" DRAFT ---
  const arbetsmiljo = await prisma.workspaceDocument.findFirst({
    where: { workspace_id: WORKSPACE_ID, title: 'Arbetsmiljöpolicy' },
    select: { id: true, status: true, current_version_id: true },
  })
  if (!arbetsmiljo) {
    throw new Error('Expected "Arbetsmiljöpolicy" DRAFT in Nordviken')
  }
  await upsertDraftContent(
    arbetsmiljo.id,
    arbetsmiljo.current_version_id,
    ARBETSMILJOPOLICY_DRAFT,
    'Arbetsmiljöpolicy'
  )

  // --- 3. Create NEW "Diskrimineringspolicy — Revision" DRAFT ---
  // Coexists with the 17.10-seeded APPROVED Diskrimineringspolicys → enables
  // the mixed-tier CITE-002 smoke (one [Källa:] + one [Utkast:]).
  const existingRevision = await prisma.workspaceDocument.findFirst({
    where: {
      workspace_id: WORKSPACE_ID,
      title: 'Diskrimineringspolicy — Revision',
    },
    select: { id: true, current_version_id: true },
  })

  if (existingRevision) {
    await upsertDraftContent(
      existingRevision.id,
      existingRevision.current_version_id,
      DISKRIMINERINGSPOLICY_REVISION_DRAFT,
      'Diskrimineringspolicy — Revision'
    )
  } else {
    const newDoc = await prisma.workspaceDocument.create({
      data: {
        workspace_id: WORKSPACE_ID,
        title: 'Diskrimineringspolicy — Revision',
        document_type: 'POLICY',
        status: 'DRAFT',
        created_by: OWNER_USER_ID,
      },
      select: { id: true },
    })
    const v1 = await prisma.workspaceDocumentVersion.create({
      data: {
        document_id: newDoc.id,
        version_number: 1,
        source: 'TIPTAP',
        content_json: {},
        content_html: DISKRIMINERINGSPOLICY_REVISION_DRAFT,
        created_by: OWNER_USER_ID,
      },
      select: { id: true },
    })
    await prisma.workspaceDocument.update({
      where: { id: newDoc.id },
      data: { current_version_id: v1.id, current_version_number: 1 },
    })
    console.log(
      `  -> created NEW doc Diskrimineringspolicy — Revision (${newDoc.id}) as DRAFT with v1`
    )
  }

  // --- Final inventory summary ---
  console.log()
  console.log('=== Nordviken DRAFTs with content after seed ===')
  const drafts = await prisma.workspaceDocument.findMany({
    where: {
      workspace_id: WORKSPACE_ID,
      status: { in: ['DRAFT', 'IN_REVIEW'] },
    },
    select: {
      title: true,
      status: true,
      current_version: { select: { content_html: true } },
    },
    orderBy: { title: 'asc' },
  })
  for (const d of drafts) {
    const chars = (d.current_version?.content_html ?? '').trim().length
    const tag = chars >= 100 ? '✓' : '∅'
    console.log(`  ${tag} [${d.status}] ${d.title} — ${chars} chars`)
  }

  console.log()
  console.log('=== next step ===')
  console.log(
    '  Run the backfill to index the new DRAFT content into pgvector:'
  )
  console.log('  DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config \\')
  console.log(
    `    scripts/backfill-workspace-document-drafts.ts --workspace=${WORKSPACE_ID}`
  )
}

async function upsertDraftContent(
  documentId: string,
  currentVersionId: string | null,
  contentHtml: string,
  label: string
) {
  if (currentVersionId) {
    await prisma.workspaceDocumentVersion.update({
      where: { id: currentVersionId },
      data: {
        content_html: contentHtml,
        content_json: {},
        extracted_text: null,
      },
    })
    console.log(`  -> ${label} (${documentId}): updated existing version`)
  } else {
    const v = await prisma.workspaceDocumentVersion.create({
      data: {
        document_id: documentId,
        version_number: 1,
        source: 'TIPTAP',
        content_json: {},
        content_html: contentHtml,
        created_by: OWNER_USER_ID,
      },
      select: { id: true },
    })
    await prisma.workspaceDocument.update({
      where: { id: documentId },
      data: { current_version_id: v.id, current_version_number: 1 },
    })
    console.log(`  -> ${label} (${documentId}): created v1`)
  }
}

main()
  .catch((err) => {
    console.error('FATAL:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
