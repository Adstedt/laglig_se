/**
 * Seed script to create additional templates with overlapping documents
 * for manual testing of Story 12.7c (Cross-List Overlap Viewer).
 *
 * Prerequisites: Run `pnpm tsx prisma/seed-template-items.ts` first
 * to create the base "Arbetsmiljö — Testmall" template and its documents.
 *
 * Creates:
 *  - "Miljö — Testmall" (2 sections, 4 items — shares 3 docs with Arbetsmiljö)
 *  - "Fastighet & Bygg — Testmall" (1 section, 3 items — shares 2 docs with Arbetsmiljö, 1 with Miljö)
 *
 * Overlap matrix (after seeding):
 *   Arbetsmiljölag (SFS 1977:1160)  → Arbetsmiljö + Miljö           (INCONSISTENT — different summaries)
 *   Miljöbalk (SFS 1998:808)        → Arbetsmiljö + Miljö + Fastighet (INCONSISTENT — 3 different summaries)
 *   Diskrimineringslag (SFS 2008:567) → Arbetsmiljö + Fastighet      (CONSISTENT — same summary)
 *   AFS 2001:1 (SAM)                → Arbetsmiljö + Miljö           (CONSISTENT — same summary)
 *
 * Run with: pnpm tsx prisma/seed-overlap-test.ts
 * Cleanup:  pnpm tsx prisma/seed-overlap-test.ts --cleanup
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'alexander.adstedt+10@kontorab.se'
const BASE_TEMPLATE_SLUG = 'seed-arbetsmiljo-test'
const MILJO_SLUG = 'seed-miljo-test'
const FASTIGHET_SLUG = 'seed-fastighet-bygg-test'

// Documents reused from the base seed (looked up by document_number)
const SHARED_DOCS = {
  arbetsmiljolag: 'SFS 1977:1160',
  sam: 'AFS 2001:1',
  diskriminering: 'SFS 2008:567',
  miljobalk: 'SFS 1998:808',
}

// A unique document only in Miljö template
const MILJO_UNIQUE_DOC = {
  document_number: 'SFS 1999:381',
  title: 'Förordning om egenkontroll (1998:901)',
  slug: 'sfs-1998-901',
  source_url:
    'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/forordning-1998901-om-verksamhetsutovares_sfs-1998-901/',
}

async function seed() {
  console.log('Seeding overlap test data...\n')

  // 1. Find admin user
  const adminUser = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true },
  })
  if (!adminUser) {
    console.error(`Admin user not found: ${ADMIN_EMAIL}`)
    process.exit(1)
  }
  console.log(`Found admin user: ${adminUser.email}`)

  // 2. Verify base template exists
  const baseTemplate = await prisma.lawListTemplate.findUnique({
    where: { slug: BASE_TEMPLATE_SLUG },
    select: { id: true, name: true },
  })
  if (!baseTemplate) {
    console.error(
      `Base template "${BASE_TEMPLATE_SLUG}" not found. Run seed-template-items.ts first.`
    )
    process.exit(1)
  }
  console.log(`Found base template: ${baseTemplate.name} (${baseTemplate.id})`)

  // 3. Look up shared documents
  const docMap = new Map<string, string>()
  for (const [key, docNum] of Object.entries(SHARED_DOCS)) {
    const doc = await prisma.legalDocument.findUnique({
      where: { document_number: docNum },
      select: { id: true },
    })
    if (!doc) {
      console.error(
        `Document not found: ${docNum}. Run seed-template-items.ts first.`
      )
      process.exit(1)
    }
    docMap.set(key, doc.id)
    console.log(`  Found document: ${docNum} (${doc.id})`)
  }

  // 4. Create unique Miljö document
  let miljoUniqueDocId: string
  const existingMiljoDoc = await prisma.legalDocument.findUnique({
    where: { document_number: MILJO_UNIQUE_DOC.document_number },
    select: { id: true },
  })
  if (existingMiljoDoc) {
    miljoUniqueDocId = existingMiljoDoc.id
    console.log(`  Reusing document: ${MILJO_UNIQUE_DOC.document_number}`)
  } else {
    const created = await prisma.legalDocument.create({
      data: {
        content_type: 'SFS_LAW',
        document_number: MILJO_UNIQUE_DOC.document_number,
        title: MILJO_UNIQUE_DOC.title,
        slug: MILJO_UNIQUE_DOC.slug,
        source_url: MILJO_UNIQUE_DOC.source_url,
        status: 'ACTIVE',
      },
    })
    miljoUniqueDocId = created.id
    console.log(`  Created document: ${MILJO_UNIQUE_DOC.document_number}`)
  }

  // 5. Check for existing templates
  for (const slug of [MILJO_SLUG, FASTIGHET_SLUG]) {
    const existing = await prisma.lawListTemplate.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (existing) {
      console.error(`\nTemplate "${slug}" already exists. Run --cleanup first.`)
      await prisma.$disconnect()
      return
    }
  }

  // ======================================================================
  // Miljö — Testmall (shares 3 docs with Arbetsmiljö)
  // ======================================================================
  const miljoTemplate = await prisma.lawListTemplate.create({
    data: {
      name: 'Miljö — Testmall',
      slug: MILJO_SLUG,
      description:
        'Testmall för overlap viewer. Delar 3 dokument med Arbetsmiljö-mallen.',
      domain: 'miljo',
      target_audience: 'Miljöansvariga',
      status: 'DRAFT',
      version: 1,
      document_count: 4,
      section_count: 2,
      primary_regulatory_bodies: ['Naturvårdsverket', 'Riksdagen'],
      created_by: adminUser.id,
    },
  })
  console.log(`\nCreated template: ${miljoTemplate.name} (${miljoTemplate.id})`)

  const miljoSec1 = await prisma.templateSection.create({
    data: {
      template_id: miljoTemplate.id,
      section_number: '01',
      name: 'Miljölagstiftning',
      description: 'Centrala miljölagar',
      position: 1,
      item_count: 3,
    },
  })
  const miljoSec2 = await prisma.templateSection.create({
    data: {
      template_id: miljoTemplate.id,
      section_number: '02',
      name: 'Egenkontroll',
      description: 'Krav på egenkontroll och systematiskt miljöarbete',
      position: 2,
      item_count: 1,
    },
  })

  // Miljöbalk — DIFFERENT summary from Arbetsmiljö (INCONSISTENT)
  await prisma.templateItem.create({
    data: {
      template_id: miljoTemplate.id,
      section_id: miljoSec1.id,
      document_id: docMap.get('miljobalk')!,
      index: '0100',
      position: 1,
      content_status: 'AI_GENERATED',
      source_type: 'lag',
      regulatory_body: 'Riksdagen',
      compliance_summary:
        'Miljöbalken är Sveriges grundläggande miljölag. Den omfattar hänsynsregler, miljökvalitetsnormer, miljökonsekvensbeskrivningar och tillsyn. Verksamhetsutövare ska tillämpa bästa möjliga teknik och försiktighetsprincipen.',
      expert_commentary:
        'Notera att miljöbalken har ett bredare tillämpningsområde än vad många tror — den gäller även kontor och tjänsteverksamheter, inte bara industri.',
      generated_by: 'claude-opus-4-6',
      is_service_company_relevant: true,
    },
  })
  console.log(
    '  Created item: Miljöbalk in Miljö (INCONSISTENT with Arbetsmiljö)'
  )

  // Arbetsmiljölag — DIFFERENT summary from Arbetsmiljö (INCONSISTENT, since base has null/STUB)
  await prisma.templateItem.create({
    data: {
      template_id: miljoTemplate.id,
      section_id: miljoSec1.id,
      document_id: docMap.get('arbetsmiljolag')!,
      index: '0110',
      position: 2,
      content_status: 'AI_GENERATED',
      source_type: 'lag',
      regulatory_body: 'Riksdagen',
      compliance_summary:
        'Ur miljöperspektiv reglerar arbetsmiljölagen krav på kemikaliehantering, ventilation och buller i arbetsplatsmiljön. Relevant för samspelet mellan yttre miljö och arbetsmiljö.',
      expert_commentary: null,
      generated_by: 'claude-opus-4-6',
      is_service_company_relevant: true,
    },
  })
  console.log(
    '  Created item: Arbetsmiljölag in Miljö (INCONSISTENT — base is STUB/null)'
  )

  // SAM — SAME summary as Arbetsmiljö (CONSISTENT)
  await prisma.templateItem.create({
    data: {
      template_id: miljoTemplate.id,
      section_id: miljoSec1.id,
      document_id: docMap.get('sam')!,
      index: '0120',
      position: 3,
      content_status: 'AI_GENERATED',
      source_type: 'foreskrift',
      regulatory_body: 'Arbetsmiljöverket',
      compliance_summary:
        'Arbetsgivaren ska bedriva ett systematiskt arbetsmiljöarbete genom att undersöka, riskbedöma, åtgärda och följa upp arbetsförhållandena. SAM ska vara en naturlig del av verksamheten och omfatta alla fysiska, psykologiska och sociala arbetsförhållanden.',
      expert_commentary:
        'SAM-föreskriften är grundbulten i svenskt arbetsmiljöarbete. Viktigt att dokumentera hela processen — från riskbedömning till uppföljning. Företag med fler än 10 anställda måste ha skriftlig arbetsmiljöpolicy och rutiner.',
      generated_by: 'claude-opus-4-6',
      is_service_company_relevant: true,
    },
  })
  console.log('  Created item: SAM in Miljö (CONSISTENT with Arbetsmiljö)')

  // Unique to Miljö
  await prisma.templateItem.create({
    data: {
      template_id: miljoTemplate.id,
      section_id: miljoSec2.id,
      document_id: miljoUniqueDocId,
      index: '0200',
      position: 1,
      content_status: 'STUB',
      source_type: 'forordning',
      regulatory_body: 'Riksdagen',
      compliance_summary: null,
      expert_commentary: null,
      is_service_company_relevant: true,
    },
  })
  console.log(
    '  Created item: Egenkontrollförordning in Miljö (unique, no overlap)'
  )

  // ======================================================================
  // Fastighet & Bygg — Testmall (shares 2 docs with Arbetsmiljö, 1 with Miljö)
  // ======================================================================
  const fastighetTemplate = await prisma.lawListTemplate.create({
    data: {
      name: 'Fastighet & Bygg — Testmall',
      slug: FASTIGHET_SLUG,
      description:
        'Testmall för overlap viewer. Delar dokument med både Arbetsmiljö och Miljö.',
      domain: 'fastighet',
      target_audience: 'Fastighetsförvaltare och byggherrar',
      status: 'DRAFT',
      version: 1,
      document_count: 3,
      section_count: 1,
      primary_regulatory_bodies: ['Boverket', 'Riksdagen'],
      created_by: adminUser.id,
    },
  })
  console.log(
    `\nCreated template: ${fastighetTemplate.name} (${fastighetTemplate.id})`
  )

  const fastighetSec = await prisma.templateSection.create({
    data: {
      template_id: fastighetTemplate.id,
      section_number: '01',
      name: 'Grundläggande regelverk',
      description: 'Lagar och föreskrifter relevanta för fastighet och bygg',
      position: 1,
      item_count: 3,
    },
  })

  // Miljöbalk — yet ANOTHER different summary (3-way INCONSISTENT)
  await prisma.templateItem.create({
    data: {
      template_id: fastighetTemplate.id,
      section_id: fastighetSec.id,
      document_id: docMap.get('miljobalk')!,
      index: '0100',
      position: 1,
      content_status: 'HUMAN_REVIEWED',
      source_type: 'lag',
      regulatory_body: 'Riksdagen',
      compliance_summary:
        'För fastighetsverksamhet är miljöbalken central gällande markföroreningar, avfallshantering vid rivning/renovering, och energieffektivisering. Kapitel 9 (miljöfarlig verksamhet) och kapitel 10 (förorenade områden) är särskilt relevanta.',
      expert_commentary:
        'Vid fastighetsförvärv: gör alltid en miljödue diligence. Förvärvaren kan bli ansvarig för föroreningar enligt 10 kap. miljöbalken.',
      generated_by: 'claude-opus-4-6',
      reviewed_by: adminUser.id,
      reviewed_at: new Date(),
      is_service_company_relevant: false,
    },
  })
  console.log('  Created item: Miljöbalk in Fastighet (3-way INCONSISTENT)')

  // Diskrimineringslag — SAME summary as Arbetsmiljö (CONSISTENT)
  await prisma.templateItem.create({
    data: {
      template_id: fastighetTemplate.id,
      section_id: fastighetSec.id,
      document_id: docMap.get('diskriminering')!,
      index: '0110',
      position: 2,
      content_status: 'AI_GENERATED',
      source_type: 'lag',
      regulatory_body: 'Riksdagen',
      compliance_summary:
        'Diskrimineringslagen förbjuder diskriminering i arbetslivet på grund av kön, könsöverskridande identitet, etnisk tillhörighet, religion, funktionsnedsättning, sexuell läggning och ålder. Arbetsgivaren ska bedriva aktiva åtgärder.',
      expert_commentary:
        'Koppla diskrimineringslagens krav till SAM-arbetet. Aktiva åtgärder ska dokumenteras årligen (lönekartläggning). Särskilt viktigt vid rekrytering.',
      generated_by: 'claude-opus-4-6',
      is_service_company_relevant: true,
    },
  })
  console.log(
    '  Created item: Diskrimineringslag in Fastighet (CONSISTENT with Arbetsmiljö)'
  )

  // Arbetsmiljölag — new unique summary for Fastighet (will be INCONSISTENT if Miljö also has it)
  await prisma.templateItem.create({
    data: {
      template_id: fastighetTemplate.id,
      section_id: fastighetSec.id,
      document_id: docMap.get('arbetsmiljolag')!,
      index: '0120',
      position: 3,
      content_status: 'AI_GENERATED',
      source_type: 'lag',
      regulatory_body: 'Riksdagen',
      compliance_summary:
        'Byggarbetsplatser har särskilda krav enligt arbetsmiljölagen och tillhörande byggnads- och anläggningsföreskrifter (AFS 1999:3). Byggherren har det övergripande ansvaret för arbetsmiljön under byggskedet.',
      expert_commentary: null,
      generated_by: 'claude-opus-4-6',
      is_service_company_relevant: true,
    },
  })
  console.log(
    '  Created item: Arbetsmiljölag in Fastighet (3-way INCONSISTENT)'
  )

  console.log('\n--- Overlap seed complete ---')
  console.log('\nOverlap matrix:')
  console.log(
    '  Arbetsmiljölag (SFS 1977:1160)    → 3 templates  INCONSISTENT (null vs 2 different)'
  )
  console.log(
    '  Miljöbalk (SFS 1998:808)           → 3 templates  INCONSISTENT (3 different summaries)'
  )
  console.log(
    '  Diskrimineringslag (SFS 2008:567)  → 2 templates  CONSISTENT (identical summaries)'
  )
  console.log(
    '  SAM (AFS 2001:1)                   → 2 templates  CONSISTENT (identical summaries)'
  )
  console.log('\nTest at: /admin/templates/overlap')
  console.log(`\nTemplates:`)
  console.log(`  Arbetsmiljö:     /admin/templates/${baseTemplate.id}`)
  console.log(`  Miljö:           /admin/templates/${miljoTemplate.id}`)
  console.log(`  Fastighet & Bygg: /admin/templates/${fastighetTemplate.id}\n`)

  await prisma.$disconnect()
}

async function cleanup() {
  console.log('Cleaning up overlap test data...\n')

  for (const slug of [MILJO_SLUG, FASTIGHET_SLUG]) {
    const template = await prisma.lawListTemplate.findUnique({
      where: { slug },
      select: { id: true, name: true },
    })

    if (template) {
      await prisma.lawListTemplate.delete({ where: { id: template.id } })
      console.log(`Deleted template: ${template.name} (${template.id})`)
    }
  }

  // Clean up unique Miljö document if orphaned
  const miljoDoc = await prisma.legalDocument.findUnique({
    where: { document_number: MILJO_UNIQUE_DOC.document_number },
    select: {
      id: true,
      _count: {
        select: {
          template_items: true,
          base_amendments: true,
          amending_amendments: true,
        },
      },
    },
  })

  if (
    miljoDoc &&
    miljoDoc._count.template_items === 0 &&
    miljoDoc._count.base_amendments === 0 &&
    miljoDoc._count.amending_amendments === 0
  ) {
    await prisma.legalDocument.delete({ where: { id: miljoDoc.id } })
    console.log(`Deleted orphan document: ${MILJO_UNIQUE_DOC.document_number}`)
  }

  console.log('\nOverlap cleanup complete.\n')
  await prisma.$disconnect()
}

const isCleanup = process.argv.includes('--cleanup')

if (isCleanup) {
  cleanup().catch((e) => {
    console.error(e)
    process.exit(1)
  })
} else {
  seed().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
