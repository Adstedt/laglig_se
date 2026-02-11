/**
 * Seed script to create a test template with sections and items
 * for manual testing of Story 12.7b (Template Item Content Editor & Review Workflow).
 *
 * Creates:
 *  - 6 LegalDocuments (reuses existing if document_number matches)
 *  - 1 LawListTemplate (DRAFT) with 2 sections
 *  - 6 TemplateItems across sections with mixed content_statuses
 *
 * Run with: pnpm tsx prisma/seed-template-items.ts
 * Cleanup:  pnpm tsx prisma/seed-template-items.ts --cleanup
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'alexander.adstedt+10@kontorab.se'
const TEMPLATE_SLUG = 'seed-arbetsmiljo-test'

const DOCUMENTS = [
  {
    document_number: 'SFS 1977:1160',
    title: 'Arbetsmiljölag (1977:1160)',
    slug: 'sfs-1977-1160',
    source_url:
      'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arbetsmiljolag-19771160_sfs-1977-1160/',
  },
  {
    document_number: 'AFS 2001:1',
    title: 'Systematiskt arbetsmiljöarbete (AFS 2001:1)',
    slug: 'afs-2001-1',
    source_url:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/systematiskt-arbetsmiljoarbete-afs-20011-foreskrifter/',
  },
  {
    document_number: 'SFS 2008:567',
    title: 'Diskrimineringslag (2008:567)',
    slug: 'sfs-2008-567',
    source_url:
      'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/diskrimineringslag-2008567_sfs-2008-567/',
  },
  {
    document_number: 'SFS 1982:673',
    title: 'Arbetstidslag (1982:673)',
    slug: 'sfs-1982-673',
    source_url:
      'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arbetstidslag-1982673_sfs-1982-673/',
  },
  {
    document_number: 'AFS 2015:4',
    title: 'Organisatorisk och social arbetsmiljö (AFS 2015:4)',
    slug: 'afs-2015-4',
    source_url:
      'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/organisatorisk-och-social-arbetsmiljo-afs-20154-foreskrifter/',
  },
  {
    document_number: 'SFS 1998:808',
    title: 'Miljöbalk (1998:808)',
    slug: 'sfs-1998-808',
    source_url:
      'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/miljobalk-1998808_sfs-1998-808/',
  },
]

const SECTIONS = [
  {
    section_number: '01',
    name: 'Allmänna skyldigheter',
    description: 'Grundläggande arbetsmiljökrav och arbetsgivarens ansvar',
    position: 1,
  },
  {
    section_number: '02',
    name: 'Organisatorisk arbetsmiljö',
    description:
      'Krav på systematiskt arbetsmiljöarbete och psykosocial arbetsmiljö',
    position: 2,
  },
]

// Items with mixed statuses for testing all UI states
const ITEMS = [
  {
    sectionIndex: 0,
    docIndex: 0,
    index: '0100',
    position: 1,
    content_status: 'STUB' as const,
    source_type: 'lag',
    regulatory_body: 'Riksdagen',
    last_amendment: 'SFS 2024:365',
    compliance_summary: null,
    expert_commentary: null,
  },
  {
    sectionIndex: 0,
    docIndex: 1,
    index: '0110',
    position: 2,
    content_status: 'AI_GENERATED' as const,
    source_type: 'foreskrift',
    regulatory_body: 'Arbetsmiljöverket',
    last_amendment: 'AFS 2023:2',
    compliance_summary:
      'Arbetsgivaren ska bedriva ett systematiskt arbetsmiljöarbete genom att undersöka, riskbedöma, åtgärda och följa upp arbetsförhållandena. SAM ska vara en naturlig del av verksamheten och omfatta alla fysiska, psykologiska och sociala arbetsförhållanden.',
    expert_commentary:
      'SAM-föreskriften är grundbulten i svenskt arbetsmiljöarbete. Viktigt att dokumentera hela processen — från riskbedömning till uppföljning. Företag med fler än 10 anställda måste ha skriftlig arbetsmiljöpolicy och rutiner.',
  },
  {
    sectionIndex: 0,
    docIndex: 2,
    index: '0120',
    position: 3,
    content_status: 'AI_GENERATED' as const,
    source_type: 'lag',
    regulatory_body: 'Riksdagen',
    last_amendment: 'SFS 2022:835',
    compliance_summary:
      'Diskrimineringslagen förbjuder diskriminering i arbetslivet på grund av kön, könsöverskridande identitet, etnisk tillhörighet, religion, funktionsnedsättning, sexuell läggning och ålder. Arbetsgivaren ska bedriva aktiva åtgärder.',
    expert_commentary:
      'Koppla diskrimineringslagens krav till SAM-arbetet. Aktiva åtgärder ska dokumenteras årligen (lönekartläggning). Särskilt viktigt vid rekrytering.',
  },
  {
    sectionIndex: 1,
    docIndex: 3,
    index: '0200',
    position: 1,
    content_status: 'HUMAN_REVIEWED' as const,
    source_type: 'lag',
    regulatory_body: 'Riksdagen',
    last_amendment: null,
    compliance_summary:
      'Arbetstidslagen reglerar ordinarie arbetstid, övertid, jourtid, mertid och vilotid. Maximal veckoarbetstid inklusive övertid är 48 timmar i genomsnitt under en beräkningsperiod.',
    expert_commentary:
      'Kontrollera avtal — arbetstidslagens regler kan avvikas genom kollektivavtal. Dokumentera all övertid. Tänk på samspelet med arbetsmiljölagens krav på arbetsbelastning.',
  },
  {
    sectionIndex: 1,
    docIndex: 4,
    index: '0210',
    position: 2,
    content_status: 'APPROVED' as const,
    source_type: 'foreskrift',
    regulatory_body: 'Arbetsmiljöverket',
    last_amendment: null,
    compliance_summary:
      'Föreskriften ställer krav på att arbetsgivaren ska ha mål för den organisatoriska och sociala arbetsmiljön, motverka ohälsosam arbetsbelastning, arbetstidens förläggning och kränkande särbehandling.',
    expert_commentary:
      'OSA-föreskriften kompletterar SAM med specifika krav på psykosocial arbetsmiljö. Kräver att chefer och arbetsledare har kunskap om förebyggande arbete. Dokumentera rutiner för kränkande särbehandling.',
  },
  {
    sectionIndex: 1,
    docIndex: 5,
    index: '0220',
    position: 3,
    content_status: 'AI_GENERATED' as const,
    source_type: 'lag',
    regulatory_body: 'Riksdagen',
    last_amendment: 'SFS 2025:180',
    compliance_summary:
      'Miljöbalken ställer krav på verksamhetsutövare att vidta försiktighetsmått, utföra egenkontroll och ha kunskap om miljöpåverkan. Kapitel 26 reglerar tillsyn och kapitel 2 de allmänna hänsynsreglerna.',
    expert_commentary:
      'Miljöbalken berör alla verksamheter, inte bara tillståndspliktiga. Koppla egenkontrollförordningen (SFS 1998:901) till er internrevision. Var uppmärksam på kemikalieförteckning och avfallshantering.',
  },
]

async function seed() {
  console.log('Seeding template test data...\n')

  // 1. Find admin user
  const adminUser = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true },
  })

  if (!adminUser) {
    console.error(`Admin user not found: ${ADMIN_EMAIL}`)
    console.error('Make sure you are logged in at least once with this email.')
    process.exit(1)
  }
  console.log(`Found admin user: ${adminUser.email} (${adminUser.id})`)

  // 2. Upsert LegalDocuments
  const documentIds: string[] = []
  for (const doc of DOCUMENTS) {
    const existing = await prisma.legalDocument.findUnique({
      where: { document_number: doc.document_number },
      select: { id: true },
    })

    if (existing) {
      documentIds.push(existing.id)
      console.log(`  Reusing document: ${doc.document_number} (${existing.id})`)
    } else {
      const created = await prisma.legalDocument.create({
        data: {
          content_type: 'SFS_LAW',
          document_number: doc.document_number,
          title: doc.title,
          slug: doc.slug,
          source_url: doc.source_url,
          status: 'ACTIVE',
        },
      })
      documentIds.push(created.id)
      console.log(`  Created document: ${doc.document_number} (${created.id})`)
    }
  }

  // 3. Check if template already exists
  const existingTemplate = await prisma.lawListTemplate.findUnique({
    where: { slug: TEMPLATE_SLUG },
    select: { id: true },
  })

  if (existingTemplate) {
    console.log(
      `\nTemplate "${TEMPLATE_SLUG}" already exists (${existingTemplate.id}).`
    )
    console.log(
      'Run with --cleanup first to remove it, or use the existing one.'
    )
    console.log(`\n  URL: /admin/templates/${existingTemplate.id}\n`)
    await prisma.$disconnect()
    return
  }

  // 4. Create template
  const template = await prisma.lawListTemplate.create({
    data: {
      name: 'Arbetsmiljö — Testmall',
      slug: TEMPLATE_SLUG,
      description:
        'Testmall för manuell QA av Story 12.7b. Innehåller blandade innehållsstatusar (STUB, AI_GENERATED, HUMAN_REVIEWED, APPROVED).',
      domain: 'arbetsmiljo',
      target_audience: 'Arbetsmiljöansvariga och HR-chefer',
      status: 'DRAFT',
      version: 1,
      document_count: ITEMS.length,
      section_count: SECTIONS.length,
      primary_regulatory_bodies: ['Arbetsmiljöverket', 'Riksdagen'],
      created_by: adminUser.id,
    },
  })
  console.log(`\nCreated template: ${template.name} (${template.id})`)

  // 5. Create sections
  const sectionIds: string[] = []
  for (const sec of SECTIONS) {
    const section = await prisma.templateSection.create({
      data: {
        template_id: template.id,
        section_number: sec.section_number,
        name: sec.name,
        description: sec.description,
        position: sec.position,
        item_count: ITEMS.filter(
          (i) => i.sectionIndex === SECTIONS.indexOf(sec)
        ).length,
      },
    })
    sectionIds.push(section.id)
    console.log(
      `  Created section: ${sec.section_number} — ${sec.name} (${section.id})`
    )
  }

  // 6. Create items
  for (const item of ITEMS) {
    const created = await prisma.templateItem.create({
      data: {
        template_id: template.id,
        section_id: sectionIds[item.sectionIndex]!,
        document_id: documentIds[item.docIndex]!,
        index: item.index,
        position: item.position,
        content_status: item.content_status,
        source_type: item.source_type,
        regulatory_body: item.regulatory_body,
        last_amendment: item.last_amendment,
        compliance_summary: item.compliance_summary,
        expert_commentary: item.expert_commentary,
        is_service_company_relevant: true,
        generated_by: item.content_status !== 'STUB' ? 'claude-opus-4-6' : null,
        reviewed_by:
          item.content_status === 'HUMAN_REVIEWED' ||
          item.content_status === 'APPROVED'
            ? adminUser.id
            : null,
        reviewed_at:
          item.content_status === 'HUMAN_REVIEWED' ||
          item.content_status === 'APPROVED'
            ? new Date()
            : null,
      },
    })
    console.log(
      `  Created item: ${item.index} [${item.content_status}] → ${DOCUMENTS[item.docIndex]!.document_number} (${created.id})`
    )
  }

  console.log('\n--- Seed complete ---')
  console.log(`\nTemplate URL: /admin/templates/${template.id}`)
  console.log('\nContent status distribution:')
  console.log('  STUB:           1 item  (section 01)')
  console.log('  AI_GENERATED:   3 items (section 01 x2, section 02 x1)')
  console.log('  HUMAN_REVIEWED: 1 item  (section 02)')
  console.log('  APPROVED:       1 item  (section 02)')
  console.log(
    '\nThis gives you all statuses to test the dashboard, editor, and workflow buttons.\n'
  )

  await prisma.$disconnect()
}

async function cleanup() {
  console.log('Cleaning up seed data...\n')

  const template = await prisma.lawListTemplate.findUnique({
    where: { slug: TEMPLATE_SLUG },
    select: { id: true },
  })

  if (!template) {
    console.log('No seed template found. Nothing to clean up.\n')
    await prisma.$disconnect()
    return
  }

  // Cascade delete handles sections and items
  await prisma.lawListTemplate.delete({
    where: { id: template.id },
  })
  console.log(`Deleted template: ${TEMPLATE_SLUG} (${template.id})`)

  // Clean up documents only if they were created by this seed (no other references)
  for (const doc of DOCUMENTS) {
    const existing = await prisma.legalDocument.findUnique({
      where: { document_number: doc.document_number },
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
      existing &&
      existing._count.template_items === 0 &&
      existing._count.base_amendments === 0 &&
      existing._count.amending_amendments === 0
    ) {
      await prisma.legalDocument.delete({ where: { id: existing.id } })
      console.log(`Deleted orphan document: ${doc.document_number}`)
    }
  }

  console.log('\nCleanup complete.\n')
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
