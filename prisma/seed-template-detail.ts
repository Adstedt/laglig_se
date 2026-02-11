/**
 * Seed script to create a PUBLISHED template for testing Story 12.9
 * (Template Detail & Preview Page).
 *
 * Creates:
 *  - 6 LegalDocuments (reuses existing if document_number matches)
 *  - 1 PUBLISHED parent template with 3 sections + 6 items
 *  - 1 PUBLISHED variant template with 2 sections (items mapped from parent)
 *
 * Run with: pnpm tsx prisma/seed-template-detail.ts
 * Cleanup:  pnpm tsx prisma/seed-template-detail.ts --cleanup
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'alexander.adstedt+10@kontorab.se'
const PARENT_SLUG = 'seed-arbetsmiljo-published'
const VARIANT_SLUG = 'seed-arbetsmiljo-tjansteforetag'

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
    document_number: 'EU 2016/425',
    title: 'Personlig skyddsutrustning (EU 2016/425)',
    slug: 'eu-2016-425',
    source_url:
      'https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32016R0425',
  },
]

const PARENT_SECTIONS = [
  {
    section_number: '01',
    name: 'Grundläggande regelverk',
    description:
      'Övergripande lagar och regler som styr arbetsmiljöarbetet i Sverige.',
    position: 1,
  },
  {
    section_number: '02',
    name: 'Organisatorisk arbetsmiljö',
    description:
      'Krav på systematiskt arbetsmiljöarbete och psykosocial arbetsmiljö.',
    position: 2,
  },
  {
    section_number: '03',
    name: 'Fysisk arbetsmiljö',
    description:
      'Krav på den fysiska arbetsmiljön inklusive arbetsplatsens utformning och skyddsutrustning.',
    position: 3,
  },
]

// Variant has 2 of the 3 sections (section 03 excluded)
const VARIANT_SECTIONS = [
  {
    section_number: '01',
    name: 'Grundläggande regelverk',
    description: 'Lagkrav som gäller alla tjänsteföretag.',
    position: 1,
  },
  {
    section_number: '02',
    name: 'Organisatorisk arbetsmiljö',
    description: 'Systematiskt arbetsmiljöarbete för tjänstesektorn.',
    position: 2,
  },
]

const ITEMS = [
  {
    sectionIndex: 0,
    docIndex: 0,
    index: '0100',
    position: 1,
    source_type: 'lag',
    regulatory_body: 'Riksdagen',
    is_service_company_relevant: true,
    // Full AI-generated Kommentar (claude-opus-4-6, Story 12.3 pipeline)
    compliance_summary:
      'Vi ska bedriva ett systematiskt arbetsmiljöarbete som förebygger ohälsa och olycksfall samt säkerställer en god arbetsmiljö för alla som utför arbete i vår verksamhet. Vi ska bland annat:\n\n- Utreda arbetsskador, fortlöpande undersöka risker och upprätta handlingsplaner för åtgärder som inte kan vidtas omedelbart.\n- Anpassa arbetsförhållandena till arbetstagarnas fysiska och psykiska förutsättningar och ge dem möjlighet att medverka i utformningen av sin arbetssituation.\n- Utan dröjsmål anmäla dödsfall, svårare personskador, olyckor som drabbat flera arbetstagare samt allvarliga tillbud till den myndighet regeringen bestämmer.\n- Utse skyddsombud på arbetsställen med minst 5 arbetstagare och inrätta skyddskommitté vid arbetsställen med minst 50 arbetstagare eller om arbetstagarna begär det.\n- Svara för att den företagshälsovård som arbetsförhållandena kräver finns tillgänglig, samt informera och utbilda arbetstagare om risker i arbetet.\n- Vid byggnads- eller anläggningsarbete utse byggarbetsmiljösamordnare för planering/projektering respektive utförande och se till att arbetsmiljösynpunkter beaktas i alla skeden.\n\nVi ska även följa de kompletterande föreskrifter som Arbetsmiljöverket meddelat med stöd av lagen. Överträdelser av meddelade föreskrifter kan medföra sanktionsavgifter på mellan 1 000 och 1 000 000 kronor.',
    // Full AI-generated Summering (claude-opus-4-6, Story 12.3 pipeline)
    expert_commentary:
      'Arbetsmiljölagen (AML, 1977:1160) är en ramlag som syftar till att förebygga ohälsa och olycksfall i arbetet samt att uppnå en god arbetsmiljö. Lagen gäller varje verksamhet där arbetstagare utför arbete för en arbetsgivares räkning och likställer även bland annat studerande och totalförsvarspliktiga med arbetstagare. Centrala bestämmelser rör arbetsgivarens skyldighet att bedriva systematiskt arbetsmiljöarbete, utreda arbetsskador, anpassa arbetsförhållandena till individuella förutsättningar, anmäla dödsfall och allvarliga tillbud utan dröjsmål samt tillhandahålla företagshälsovård. Lagen ställer krav på samverkan mellan arbetsgivare och arbetstagare — skyddsombud ska utses på arbetsställen med minst 5 arbetstagare och skyddskommitté ska finnas vid arbetsställen med minst 50 arbetstagare. Särskilda regler gäller för minderåriga, byggnads- och anläggningsarbete samt för den som tillverkar, importerar eller överlåter tekniska anordningar och kemiska ämnen. Sanktionsavgifter vid överträdelse av meddelade föreskrifter kan uppgå till mellan 1 000 och 1 000 000 kronor. Lagen kompletteras av arbetsmiljöförordningen och Arbetsmiljöverkets föreskrifter, bland annat AFS 2023:1 om systematiskt arbetsmiljöarbete.',
  },
  {
    sectionIndex: 0,
    docIndex: 1,
    index: '0110',
    position: 2,
    source_type: 'foreskrift',
    regulatory_body: 'Arbetsmiljöverket',
    is_service_company_relevant: true,
    compliance_summary:
      'Vi ska följa Arbetsmiljöverkets föreskrifter om systematiskt arbetsmiljöarbete.',
    expert_commentary: null,
  },
  {
    sectionIndex: 0,
    docIndex: 2,
    index: '0120',
    position: 3,
    source_type: 'lag',
    regulatory_body: 'Riksdagen',
    is_service_company_relevant: true,
    compliance_summary:
      'Diskrimineringslagen förbjuder diskriminering i arbetslivet. Arbetsgivaren ska bedriva aktiva åtgärder.',
    expert_commentary:
      'Koppla diskrimineringslagens krav till SAM-arbetet. Aktiva åtgärder ska dokumenteras årligen.',
  },
  {
    sectionIndex: 1,
    docIndex: 3,
    index: '0200',
    position: 1,
    source_type: 'lag',
    regulatory_body: 'Riksdagen',
    is_service_company_relevant: true,
    compliance_summary:
      'Arbetstidslagen reglerar ordinarie arbetstid, övertid, jourtid och vilotid.',
    expert_commentary:
      'Kontrollera avtal — arbetstidslagens regler kan avvikas genom kollektivavtal.',
  },
  {
    sectionIndex: 1,
    docIndex: 4,
    index: '0210',
    position: 2,
    source_type: 'foreskrift',
    regulatory_body: 'Arbetsmiljöverket',
    is_service_company_relevant: true,
    compliance_summary:
      'Föreskriften ställer krav på mål för den organisatoriska och sociala arbetsmiljön.',
    expert_commentary: null,
  },
  {
    sectionIndex: 2,
    docIndex: 5,
    index: '0300',
    position: 1,
    source_type: 'eu-forordning',
    regulatory_body: 'EU',
    is_service_company_relevant: false, // Not relevant for tjänsteföretag
    compliance_summary:
      'EU-förordningen ställer krav på personlig skyddsutrustning som tillhandahålls på marknaden.',
    expert_commentary: null,
  },
]

async function seed() {
  console.log('Seeding PUBLISHED template for Story 12.9 testing...\n')

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
  console.log(`Found admin user: ${adminUser.email}`)

  // 2. Check if templates already exist
  const existingParent = await prisma.lawListTemplate.findUnique({
    where: { slug: PARENT_SLUG },
    select: { id: true },
  })
  if (existingParent) {
    console.log(
      `\nTemplate "${PARENT_SLUG}" already exists. Run --cleanup first.\n`
    )
    await prisma.$disconnect()
    return
  }

  // 3. Upsert LegalDocuments
  const documentIds: string[] = []
  for (const doc of DOCUMENTS) {
    const existing = await prisma.legalDocument.findUnique({
      where: { document_number: doc.document_number },
      select: { id: true },
    })

    if (existing) {
      documentIds.push(existing.id)
      console.log(`  Reusing document: ${doc.document_number}`)
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
      console.log(`  Created document: ${doc.document_number}`)
    }
  }

  // 4. Create parent template (PUBLISHED)
  const parentTemplate = await prisma.lawListTemplate.create({
    data: {
      name: 'Arbetsmiljö',
      slug: PARENT_SLUG,
      description:
        'Omfattande lagkrav för alla svenska arbetsgivare inom arbetsmiljöområdet. Täcker grundläggande regelverk, organisatorisk arbetsmiljö och fysisk arbetsmiljö.',
      domain: 'arbetsmiljo',
      target_audience: 'Alla svenska arbetsgivare oavsett bransch',
      status: 'PUBLISHED',
      published_at: new Date(),
      version: 1,
      document_count: ITEMS.length,
      section_count: PARENT_SECTIONS.length,
      primary_regulatory_bodies: ['Arbetsmiljöverket', 'Riksdagen', 'EU'],
      created_by: adminUser.id,
    },
  })
  console.log(`\nCreated parent template: ${parentTemplate.name} (PUBLISHED)`)

  // 5. Create parent sections
  const parentSectionIds: string[] = []
  for (const sec of PARENT_SECTIONS) {
    const section = await prisma.templateSection.create({
      data: {
        template_id: parentTemplate.id,
        section_number: sec.section_number,
        name: sec.name,
        description: sec.description,
        position: sec.position,
        item_count: ITEMS.filter(
          (i) => i.sectionIndex === PARENT_SECTIONS.indexOf(sec)
        ).length,
      },
    })
    parentSectionIds.push(section.id)
    console.log(`  Section ${sec.section_number}: ${sec.name}`)
  }

  // 6. Create items on parent template
  for (const item of ITEMS) {
    await prisma.templateItem.create({
      data: {
        template_id: parentTemplate.id,
        section_id: parentSectionIds[item.sectionIndex]!,
        document_id: documentIds[item.docIndex]!,
        index: item.index,
        position: item.position,
        content_status: 'APPROVED',
        source_type: item.source_type,
        regulatory_body: item.regulatory_body,
        compliance_summary: item.compliance_summary,
        expert_commentary: item.expert_commentary,
        is_service_company_relevant: item.is_service_company_relevant,
      },
    })
    console.log(
      `  Item ${item.index} → ${DOCUMENTS[item.docIndex]!.document_number} [relevant=${item.is_service_company_relevant}]`
    )
  }

  // 7. Create variant template (PUBLISHED)
  const variantTemplate = await prisma.lawListTemplate.create({
    data: {
      name: 'Arbetsmiljö för tjänsteföretag',
      slug: VARIANT_SLUG,
      description:
        'Anpassad lagkravslista för tjänsteföretag. Fokuserar på kontorsarbetsmiljö och organisatoriska krav.',
      domain: 'arbetsmiljo',
      target_audience: 'Tjänsteföretag',
      status: 'PUBLISHED',
      published_at: new Date(),
      version: 1,
      document_count: ITEMS.filter((i) => i.is_service_company_relevant).length,
      section_count: VARIANT_SECTIONS.length,
      primary_regulatory_bodies: ['Arbetsmiljöverket', 'Riksdagen'],
      is_variant: true,
      parent_template_id: parentTemplate.id,
      created_by: adminUser.id,
    },
  })
  console.log(`\nCreated variant template: ${variantTemplate.name} (PUBLISHED)`)

  // 8. Create variant sections
  for (const sec of VARIANT_SECTIONS) {
    await prisma.templateSection.create({
      data: {
        template_id: variantTemplate.id,
        section_number: sec.section_number,
        name: sec.name,
        description: sec.description,
        position: sec.position,
        item_count: 0, // Computed at query time for variants
      },
    })
    console.log(`  Section ${sec.section_number}: ${sec.name}`)
  }

  console.log('\n--- Seed complete ---')
  console.log('\nTest URLs:')
  console.log(`  Parent:  /laglistor/mallar/${PARENT_SLUG}`)
  console.log(`  Variant: /laglistor/mallar/${VARIANT_SLUG}`)
  console.log(`  404:     /laglistor/mallar/nonexistent-slug`)
  console.log('\nWhat to verify:')
  console.log(
    '  - Header: name, description, badges, stats bar (6 lagar, 3 kategorier)'
  )
  console.log(
    '  - Accordion: 3 sections, expand to see law list + compliance summaries'
  )
  console.log('  - Source type badges: Lag, Föreskrift, EU-förordning')
  console.log(
    '  - Variant toggle: "Visa version för tjänsteföretag" on parent page'
  )
  console.log(
    '  - Variant page: "Visa fullständig version" link back, 2 sections, 5 items'
  )
  console.log('  - CTA: disabled button, "Malladoption lanseras snart" note')
  console.log('  - Mobile: resize to see single-column layout + bottom CTA')
  console.log('  - 404: custom not-found with SearchX icon\n')

  await prisma.$disconnect()
}

async function cleanup() {
  console.log('Cleaning up seed data...\n')

  // Delete variant first (FK to parent)
  const variant = await prisma.lawListTemplate.findUnique({
    where: { slug: VARIANT_SLUG },
    select: { id: true },
  })
  if (variant) {
    await prisma.lawListTemplate.delete({ where: { id: variant.id } })
    console.log(`Deleted variant: ${VARIANT_SLUG}`)
  }

  // Delete parent
  const parent = await prisma.lawListTemplate.findUnique({
    where: { slug: PARENT_SLUG },
    select: { id: true },
  })
  if (parent) {
    await prisma.lawListTemplate.delete({ where: { id: parent.id } })
    console.log(`Deleted parent: ${PARENT_SLUG}`)
  }

  if (!variant && !parent) {
    console.log('No seed templates found. Nothing to clean up.')
  }

  // Clean up documents only if orphaned
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
