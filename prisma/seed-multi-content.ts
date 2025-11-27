/**
 * Seed script for testing multi-content-type data model
 * Story 2.1: Design Multi-Content-Type Data Model
 *
 * This script inserts test data for:
 * - SFS Law (Semesterlag)
 * - Court Case (AD decision)
 * - EU Regulation (GDPR)
 * - Amendment with all 7 competitive-feature fields
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding multi-content-type test data...')

  // 1. Insert sample SFS law
  console.log('Creating SFS law: Semesterlag (1977:480)...')
  const semesterlag = await prisma.legalDocument.create({
    data: {
      document_number: 'SFS 1977:480',
      title: 'Semesterlag (1977:480)',
      slug: 'semesterlag-1977-480',
      content_type: 'SFS_LAW',
      summary: 'Lag om rätt till semester för arbetstagare',
      full_text: 'Denna lag reglerar rätten till semester för arbetstagare...',
      effective_date: new Date('1977-06-01'),
      publication_date: new Date('1977-05-25'),
      status: 'ACTIVE',
      source_url:
        'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/semesterlag-1977480_sfs-1977-480',
      metadata: {
        category: 'ARBETSRATT',
        sfs_number: '1977:480',
      },
    },
  })
  console.log(`✓ Created SFS law: ${semesterlag.id}`)

  // 2. Insert sample court case (AD)
  console.log('Creating court case: AD 2023 nr 45...')
  const courtCaseDoc = await prisma.legalDocument.create({
    data: {
      document_number: 'AD 2023 nr 45',
      title: 'AD 2023 nr 45 - Uppsägning p.g.a. arbetsbrist',
      slug: 'ad-2023-nr-45-uppsagning-arbetsbrist',
      content_type: 'COURT_CASE_AD',
      summary:
        'Arbetsdomstolens dom om uppsägning på grund av arbetsbrist. Fråga om turordning enligt LAS.',
      full_text: 'Arbetsdomstolen har meddelat följande dom...',
      effective_date: new Date('2023-05-15'),
      publication_date: new Date('2023-05-15'),
      status: 'ACTIVE',
      source_url: 'https://arbetsdomstolen.se/domar/2023-45',
      metadata: {
        court: 'Arbetsdomstolen',
        year: 2023,
        number: 45,
      },
      court_case: {
        create: {
          court_name: 'Arbetsdomstolen',
          case_number: '2023-45',
          decision_date: new Date('2023-05-15'),
          lower_court: null,
          parties: {
            plaintiff: 'LO',
            defendant: 'Företag AB',
          },
        },
      },
    },
  })
  console.log(`✓ Created court case: ${courtCaseDoc.id}`)

  // 3. Insert sample EU regulation (GDPR)
  console.log('Creating EU regulation: GDPR...')
  const gdpr = await prisma.legalDocument.create({
    data: {
      document_number: 'EU 2016/679',
      title: 'GDPR - Dataskyddsförordningen',
      slug: 'gdpr-dataskyddsforordningen-2016-679',
      content_type: 'EU_REGULATION',
      summary:
        'Europaparlamentets och rådets förordning (EU) 2016/679 om skydd för fysiska personer med avseende på behandling av personuppgifter',
      full_text: 'EUROPAPARLAMENTETS OCH RÅDETS FÖRORDNING (EU) 2016/679...',
      effective_date: new Date('2018-05-25'),
      publication_date: new Date('2016-04-27'),
      status: 'ACTIVE',
      source_url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
      metadata: {
        celex: '32016R0679',
        type: 'regulation',
      },
      eu_document: {
        create: {
          celex_number: '32016R0679',
          eut_reference: 'L 119/1',
          national_implementation_measures: {
            sweden: ['SFS 2018:218'],
          },
        },
      },
    },
  })
  console.log(`✓ Created EU regulation: ${gdpr.id}`)

  // 4. Insert amending law for Semesterlag
  console.log('Creating amending law for Semesterlag...')
  const amendingLaw = await prisma.legalDocument.create({
    data: {
      document_number: 'SFS 2021:1112',
      title: 'Lag (2021:1112) om ändring i semesterlagen (1977:480)',
      slug: 'lag-2021-1112-andring-semesterlagen',
      content_type: 'SFS_LAW',
      summary: 'Ändringar i beräkningen av semesterersättning',
      full_text: 'Lag om ändring i semesterlagen (1977:480)...',
      effective_date: new Date('2022-01-01'),
      publication_date: new Date('2021-12-15'),
      status: 'ACTIVE',
      source_url:
        'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-20211112-om-andring-i-semesterlagen_sfs-2021-1112',
      metadata: {
        category: 'ARBETSRATT',
        sfs_number: '2021:1112',
        amending_law: true,
      },
    },
  })
  console.log(`✓ Created amending law: ${amendingLaw.id}`)

  // 5. Insert amendment with all 7 competitive-feature fields
  console.log('Creating amendment record with all 7 fields...')
  const amendment = await prisma.amendment.create({
    data: {
      base_document_id: semesterlag.id,
      amending_document_id: amendingLaw.id,
      // 7 competitive-feature fields
      amending_law_title:
        'Lag (2021:1112) om ändring i semesterlagen (1977:480)',
      publication_date: new Date('2021-12-15'),
      effective_date: new Date('2022-01-01'),
      affected_sections_raw: 'ändr. 3 kap. 2 §; upph. 5 kap. 7 §',
      affected_sections: {
        amended: ['3:2'],
        repealed: ['5:7'],
        new: [],
        renumbered: [],
      },
      summary:
        'Ändring i beräkning av semesterersättning vid anställningens upphörande. Semesterersättning ska nu beräknas på ny förordnad lön istället för tidigare lön. Paragrafen om fribelopp upphävs.',
      summary_generated_by: 'GPT_4',
      // Additional fields
      detected_method: 'RIKSDAGEN_TEXT_PARSING',
      metadata: {
        source: 'Riksdagen API',
        confidence: 0.95,
      },
    },
  })
  console.log(`✓ Created amendment: ${amendment.id}`)

  // 6. Add document subjects to Semesterlag
  console.log('Adding subjects to Semesterlag...')
  await prisma.documentSubject.createMany({
    data: [
      {
        document_id: semesterlag.id,
        subject_code: 'ARBETSRATT',
        subject_name: 'Arbetsrätt',
      },
      {
        document_id: semesterlag.id,
        subject_code: 'SEMESTER',
        subject_name: 'Semester & Ledighet',
      },
    ],
  })
  console.log('✓ Created 2 subject classifications')

  // 7. Add cross-reference from court case to Semesterlag
  console.log('Creating cross-reference from court case to Semesterlag...')
  await prisma.crossReference.create({
    data: {
      source_document_id: courtCaseDoc.id,
      target_document_id: semesterlag.id,
      reference_type: 'REFERENCES',
      context:
        'Detta mål tolkar § 7 i semesterlagen angående turordning vid uppsägning på grund av arbetsbrist.',
    },
  })
  console.log('✓ Created cross-reference')

  console.log('\n✅ Seed completed successfully!')
  console.log('\nCreated test data:')
  console.log(`  - 1 SFS law (Semesterlag)`)
  console.log(`  - 1 Court case (AD 2023 nr 45)`)
  console.log(`  - 1 EU regulation (GDPR)`)
  console.log(`  - 1 Amending law`)
  console.log(`  - 1 Amendment record (with 7 competitive fields)`)
  console.log(`  - 2 Document subjects`)
  console.log(`  - 1 Cross-reference`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
