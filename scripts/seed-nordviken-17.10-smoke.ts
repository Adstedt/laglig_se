/**
 * One-off seed script: prepare Nordviken Hotell & Konferens AB for the 17.10
 * smoke test (search / get / list workspace_documents).
 *
 * Why this exists:
 *   1. Nordviken has 21 styrdokument but ZERO `WORKSPACE_DOCUMENT` chunks
 *      indexed — so semantic search returns empty for everything. 17.9b only
 *      indexes APPROVED docs (DEC-2), so anything we want searchable must be
 *      both APPROVED and have real content_html.
 *   2. The natural "Diskrimineringspolicy" × 2 collision pair is great for
 *      the CITE-002 smoke — but both are DRAFT with NO-CONTENT. We promote
 *      them to APPROVED + give them distinct Swedish content so the agent
 *      can actually find them AND collide.
 *   3. No existing doc has `task_links` — so Smoke A5 (linked_task_id filter)
 *      has nothing to find. We link one APPROVED doc to the existing test task.
 *   4. Finally we trigger `syncWorkspaceChunks` on every APPROVED+content doc
 *      to populate the pgvector index.
 *
 * Idempotent — safe to re-run. Touches only Nordviken's data.
 *
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/seed-nordviken-17.10-smoke.ts
 */

import { PrismaClient } from '@prisma/client'
import { syncWorkspaceChunks } from '@/lib/chunks/sync-workspace-chunks'
import { htmlToMarkdown } from '@/lib/transforms/html-to-markdown'

const prisma = new PrismaClient()

const WORKSPACE_ID = 'e4cd55b0-8b2c-4209-bd19-0b40f50f04f1' // Nordviken Hotell & Konferens AB
const OWNER_USER_ID = 'cee3f852-5e08-46e2-be3b-bbde7d152108' // Alexander Adstedt
const EXISTING_TASK_ID = 'bad549f3-ca8b-415a-8c57-b6153c755891' // "Test" task

// --- distinct content for the two Diskrimineringspolicy collision docs ---
// Each is a *different* styrdokument that happens to share the title —
// realistic CITE-002 scenario (old + re-issued, or two business units).

const DISKRIMINERINGSPOLICY_HR = `<h1>Diskrimineringspolicy — HR och rekrytering</h1>
<p>Denna policy reglerar förbudet mot diskriminering i samband med
rekrytering, anställning och anställdas arbetsförhållanden vid Nordviken
Hotell & Konferens AB.</p>
<h2>Tillämpningsområde</h2>
<p>Policyn omfattar alla rekryteringsprocesser, från annonsering och urval till
anställningsbeslut, lönesättning, befordran, kompetensutveckling och
avveckling av anställning.</p>
<h2>Diskrimineringsgrunder</h2>
<p>Det är förbjudet att direkt eller indirekt missgynna någon på grund av kön,
könsöverskridande identitet eller uttryck, etnisk tillhörighet, religion eller
annan trosuppfattning, funktionsnedsättning, sexuell läggning eller ålder
(2 kap. 1 § diskrimineringslagen, SFS 2008:567).</p>
<h2>HR-rutiner</h2>
<p>Rekryterande chef ska tillsammans med HR säkerställa att kravprofilen är
saklig och relevant, att urvalet är spårbart, och att beslut motiveras
skriftligt. Lönesättning ska följa det årliga lönekartläggningsarbetet
(3 kap. 8 § diskrimineringslagen).</p>`

const DISKRIMINERINGSPOLICY_GUEST = `<h1>Diskrimineringspolicy — Gäster och kundbemötande</h1>
<p>Denna policy reglerar Nordviken Hotell & Konferens AB:s ansvar gentemot
gäster, konferensdeltagare och övriga besökare att tillhandahålla tjänster
fria från diskriminering.</p>
<h2>Tillämpningsområde</h2>
<p>Policyn omfattar receptionsbemötande, bokning, prissättning, tillgång till
allmänna utrymmen, frukost- och konferenstjänster samt klagomålshantering.</p>
<h2>Förbudet i 2 kap. 12 § diskrimineringslagen</h2>
<p>Den som tillhandahåller varor, tjänster eller bostäder får inte
diskriminera en gäst eller kund på grund av de skyddade
diskrimineringsgrunderna. Detta gäller även marknadsföring och prissättning.</p>
<h2>Klagomålshantering</h2>
<p>Misstänkt diskriminering rapporteras omedelbart till receptionschefen, som
för incidenten i avvikelseloggen och informerar HR inom 24 timmar. Gästen
ska få en skriftlig återkoppling inom 14 dagar (servicegaranti).</p>`

async function main() {
  console.log('=== seed-nordviken-17.10-smoke ===')

  // ---------------------------------------------------------------------
  // Step 1 — find the two Diskrimineringspolicy docs (collision pair)
  // ---------------------------------------------------------------------
  const polisDocs = await prisma.workspaceDocument.findMany({
    where: {
      workspace_id: WORKSPACE_ID,
      title: 'Diskrimineringspolicy',
    },
    select: {
      id: true,
      status: true,
      current_version_id: true,
      current_version_number: true,
    },
    orderBy: { created_at: 'asc' },
  })

  if (polisDocs.length !== 2) {
    throw new Error(
      `Expected 2 Diskrimineringspolicy docs, found ${polisDocs.length}`
    )
  }

  console.log(
    `\nStep 1 — found ${polisDocs.length} 'Diskrimineringspolicy' docs (collision pair):`
  )
  for (const d of polisDocs)
    console.log(`  ${d.id}  status=${d.status} v=${d.current_version_number}`)

  // ---------------------------------------------------------------------
  // Step 2 — upsert version content + promote to APPROVED for each doc
  // ---------------------------------------------------------------------
  const contents = [DISKRIMINERINGSPOLICY_HR, DISKRIMINERINGSPOLICY_GUEST]
  for (let i = 0; i < polisDocs.length; i++) {
    const doc = polisDocs[i]!
    const content_html = contents[i]!

    if (doc.current_version_id) {
      // Update the existing current version's content (idempotent on re-run).
      await prisma.workspaceDocumentVersion.update({
        where: { id: doc.current_version_id },
        data: { content_html, content_json: {}, extracted_text: null },
      })
      console.log(
        `  -> doc ${doc.id}: updated existing version v${doc.current_version_number}`
      )
    } else {
      // Create v1 with the seed content.
      const v = await prisma.workspaceDocumentVersion.create({
        data: {
          document_id: doc.id,
          version_number: 1,
          source: 'TIPTAP',
          content_json: {},
          content_html,
          created_by: OWNER_USER_ID,
        },
        select: { id: true },
      })
      await prisma.workspaceDocument.update({
        where: { id: doc.id },
        data: { current_version_id: v.id, current_version_number: 1 },
      })
      console.log(`  -> doc ${doc.id}: created v1 (${v.id})`)
    }

    // Promote to APPROVED (so 17.9b will index it).
    if (doc.status !== 'APPROVED') {
      await prisma.workspaceDocument.update({
        where: { id: doc.id },
        data: {
          status: 'APPROVED',
          approved_by: OWNER_USER_ID,
          approved_at: new Date(),
        },
      })
      console.log(`  -> doc ${doc.id}: promoted ${doc.status} → APPROVED`)
    }
  }

  // ---------------------------------------------------------------------
  // Step 3 — link one APPROVED doc to the existing test task (Smoke A5)
  // ---------------------------------------------------------------------
  // Use 'Integritetspolicy och GDPR-policy' — it's already APPROVED with
  // substantial content, so it's a good search target AND a link target.
  const linkTarget = await prisma.workspaceDocument.findFirst({
    where: {
      workspace_id: WORKSPACE_ID,
      title: 'Integritetspolicy och GDPR-policy – Almåsa Havshotell AB',
      status: 'APPROVED',
    },
    select: { id: true },
  })
  if (linkTarget) {
    await prisma.workspaceDocumentTaskLink.upsert({
      where: {
        document_id_task_id: {
          document_id: linkTarget.id,
          task_id: EXISTING_TASK_ID,
        },
      },
      update: {},
      create: {
        document_id: linkTarget.id,
        task_id: EXISTING_TASK_ID,
        linked_by: OWNER_USER_ID,
      },
    })
    console.log(
      `\nStep 3 — linked '${linkTarget.id}' ⇄ task ${EXISTING_TASK_ID}`
    )
  } else {
    console.log('\nStep 3 — Integritetspolicy doc not found, skipping link')
  }

  // ---------------------------------------------------------------------
  // Step 4 — chunk + embed every APPROVED doc that has substantive content
  // ---------------------------------------------------------------------
  const approvedDocs = await prisma.workspaceDocument.findMany({
    where: { workspace_id: WORKSPACE_ID, status: 'APPROVED' },
    select: {
      id: true,
      title: true,
      document_type: true,
      current_version: { select: { content_html: true } },
    },
  })

  console.log(`\nStep 4 — chunking ${approvedDocs.length} APPROVED docs...`)
  for (const d of approvedDocs) {
    const html = d.current_version?.content_html ?? ''
    if (html.trim().length < 100) {
      console.log(
        `  skip '${d.title}' (content too short: ${html.length} chars)`
      )
      continue
    }
    const markdown = htmlToMarkdown(html)
    const result = await syncWorkspaceChunks(
      d.id,
      'WORKSPACE_DOCUMENT',
      WORKSPACE_ID,
      markdown,
      {
        contextualHeader: `${d.title} (${d.document_type})`,
        metadata: {
          title: d.title,
          document_type: d.document_type,
          status: 'APPROVED',
        },
      }
    )
    console.log(
      `  '${d.title}' — deleted ${result.chunksDeleted}, created ${result.chunksCreated}, embedded ${result.chunksEmbedded} (${result.duration}ms)`
    )
  }

  // ---------------------------------------------------------------------
  // Final summary
  // ---------------------------------------------------------------------
  const finalChunkCount = await prisma.contentChunk.count({
    where: { workspace_id: WORKSPACE_ID, source_type: 'WORKSPACE_DOCUMENT' },
  })
  console.log(
    `\n=== final WORKSPACE_DOCUMENT chunk count for Nordviken: ${finalChunkCount} ===`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
