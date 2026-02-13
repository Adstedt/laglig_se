/* eslint-disable no-console */
/**
 * Targeted EU Regulation Ingestion
 *
 * Fetches specific EU/EG regulations by CELEX number from EUR-Lex SPARQL API
 * and creates LegalDocument + EuDocument records.
 *
 * Used to fill the 15 EU/EG regulation gaps needed by the Notisum baseline templates.
 *
 * Usage: pnpm tsx scripts/ingest-eu-targeted.ts
 *        pnpm tsx scripts/ingest-eu-targeted.ts --dry-run
 *        pnpm tsx scripts/ingest-eu-targeted.ts --with-content
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient, ContentType, DocumentStatus } from '@prisma/client'
import {
  executeSparqlQuery,
  aggregateEnhancedBindings,
  fetchDocumentContentViaCellar,
  fetchDocumentRelationships,
  generateEuSlug,
  extractEUMetadata,
  type EurLexDocumentEnhanced,
} from '../lib/external/eurlex'

// ============================================================================
// Configuration — the 15 Notisum baseline EU/EG regulations
// ============================================================================

const TARGET_CELEX = [
  // EG regulations (pre-Lisbon, all type R)
  '32006R0561', // (EG) nr 561/2006 — Driving & rest times
  '32006R0166', // (EG) nr 166/2006 — E-PRTR
  '32006R1907', // (EG) nr 1907/2006 — REACH
  '32008R0440', // (EG) nr 440/2008 — REACH test methods
  '32008R1272', // (EG) nr 1272/2008 — CLP

  // EU regulations (post-Lisbon)
  '32012R0649', // (EU) nr 649/2012 — PIC
  '32014R0165', // (EU) nr 165/2014 — Tachographs
  '32016R0679', // (EU) nr 679/2016 — GDPR
  '32019R1021', // (EU) nr 1021/2019 — POPs
  '32020R0852', // (EU) nr 852/2020 — Taxonomy
  '32023R0956', // (EU) nr 956/2023 — CBAM
  '32023R1115', // (EU) nr 1115/2023 — Deforestation
  '32023R1230', // (EU) nr 1230/2023 — Machinery
  '32023R1542', // (EU) nr 1542/2023 — Battery
  '32023R2772', // (EU) nr 2772/2023 — ESRS
]

const DRY_RUN = process.argv.includes('--dry-run')
const WITH_CONTENT = process.argv.includes('--with-content')

// ============================================================================
// SPARQL query builder for specific CELEX numbers
// ============================================================================

function buildTargetedRegulationsQuery(celexNumbers: string[]): string {
  const celexFilter = celexNumbers
    .map((c) => `STR(?celex) = "${c}"`)
    .join(' || ')

  return `
PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?celex ?title ?docNumber ?publicationDate ?entryIntoForce ?eutReference
       ?eli ?inForce ?endOfValidity ?signatureDate ?eea
       (GROUP_CONCAT(DISTINCT ?dirCode; separator="|") AS ?dirCodes)
       (GROUP_CONCAT(DISTINCT ?subjectMatter; separator="|") AS ?subjectMatters)
       (GROUP_CONCAT(DISTINCT ?eurovoc; separator="|") AS ?eurovocs)
       (GROUP_CONCAT(DISTINCT ?author; separator="|") AS ?authors)
       (GROUP_CONCAT(DISTINCT ?legalBasis; separator="|") AS ?legalBases)
       (GROUP_CONCAT(DISTINCT ?citesWork; separator="|") AS ?citesWorks)
WHERE {
  ?work cdm:resource_legal_id_celex ?celex .

  # Filter for our specific CELEX numbers
  FILTER(${celexFilter})

  # Filter for regulations (including implementing, delegated, financial)
  ?work cdm:work_has_resource-type ?type .
  FILTER(?type IN (
    <http://publications.europa.eu/resource/authority/resource-type/REG>,
    <http://publications.europa.eu/resource/authority/resource-type/REG_IMPL>,
    <http://publications.europa.eu/resource/authority/resource-type/REG_DEL>,
    <http://publications.europa.eu/resource/authority/resource-type/REG_FINANC>
  ))

  # Get Swedish expression and title
  ?expr cdm:expression_belongs_to_work ?work .
  ?expr cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/SWE> .
  ?expr cdm:expression_title ?title .

  # Optional core fields
  OPTIONAL { ?work cdm:work_date_document ?publicationDate }
  OPTIONAL { ?work cdm:resource_legal_id_sector ?docNumber }
  OPTIONAL { ?work cdm:resource_legal_date_entry-into-force ?entryIntoForce }
  OPTIONAL { ?work cdm:work_part_of_collection_document ?eutReference }

  # Enhanced single-valued fields
  OPTIONAL { ?work cdm:resource_legal_eli ?eli }
  OPTIONAL { ?work cdm:resource_legal_in-force ?inForce }
  OPTIONAL { ?work cdm:resource_legal_date_end-of-validity ?endOfValidity }
  OPTIONAL { ?work cdm:resource_legal_date_signature ?signatureDate }
  OPTIONAL { ?work cdm:resource_legal_eea ?eea }

  # Multi-valued fields (will be aggregated)
  OPTIONAL { ?work cdm:resource_legal_is_about_concept_directory-code ?dirCode }
  OPTIONAL { ?work cdm:resource_legal_is_about_subject-matter ?subjectMatter }
  OPTIONAL { ?work cdm:work_is_about_concept_eurovoc ?eurovoc }
  OPTIONAL { ?work cdm:work_created_by_agent ?author }
  OPTIONAL { ?work cdm:resource_legal_based_on_resource_legal ?legalBasis }
  OPTIONAL { ?work cdm:work_cites_work ?citesWork }

  # Exclude non-indexed documents
  FILTER NOT EXISTS { ?work cdm:do_not_index "true"^^xsd:boolean }
}
GROUP BY ?celex ?title ?docNumber ?publicationDate ?entryIntoForce ?eutReference
         ?eli ?inForce ?endOfValidity ?signatureDate ?eea
ORDER BY ?celex
LIMIT ${celexNumbers.length + 10}
`
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const prisma = new PrismaClient()

  console.log('='.repeat(70))
  console.log('Targeted EU Regulation Ingestion (Notisum baseline)')
  console.log('='.repeat(70))
  console.log(`Targets: ${TARGET_CELEX.length} CELEX numbers`)
  console.log(`Dry run: ${DRY_RUN}`)
  console.log(`Fetch content: ${WITH_CONTENT}`)
  console.log()

  try {
    // 1. Check which already exist in DB
    const existing = await prisma.euDocument.findMany({
      where: { celex_number: { in: TARGET_CELEX } },
      select: { celex_number: true },
    })
    const existingSet = new Set(existing.map((e) => e.celex_number))

    const needed = TARGET_CELEX.filter((c) => !existingSet.has(c))

    console.log(`Already in DB: ${existingSet.size}`)
    if (existingSet.size > 0) {
      existingSet.forEach((c) => console.log(`  skip ${c}`))
    }
    console.log(`Need to fetch: ${needed.length}`)
    console.log()

    if (needed.length === 0) {
      console.log('All 15 EU documents already exist. Nothing to do.')
      return
    }

    // 2. Fetch from EUR-Lex SPARQL
    console.log('Querying EUR-Lex SPARQL API...')
    const query = buildTargetedRegulationsQuery(needed)
    const response = await executeSparqlQuery(query)
    const documents = aggregateEnhancedBindings(
      response.results.bindings,
      'REG'
    )

    // Deduplicate — SPARQL can return multiple rows per CELEX
    const deduped = new Map<string, EurLexDocumentEnhanced>()
    for (const doc of documents) {
      if (!deduped.has(doc.celex)) {
        deduped.set(doc.celex, doc)
      }
    }
    const uniqueDocs = [...deduped.values()]
    console.log(
      `SPARQL returned ${documents.length} rows → ${uniqueDocs.length} unique documents`
    )
    console.log()

    // Check for any that SPARQL didn't find (no Swedish translation, etc.)
    const fetchedSet = new Set(uniqueDocs.map((d) => d.celex))
    const notFound = needed.filter((c) => !fetchedSet.has(c))

    if (notFound.length > 0) {
      console.log(
        `WARNING: ${notFound.length} not found in SPARQL (no Swedish title?):`
      )
      notFound.forEach((c) => console.log(`  ${c}`))
      console.log()
    }

    // 3. Process each document
    let inserted = 0
    let skipped = 0
    let failed = 0

    for (const doc of uniqueDocs) {
      const celex = doc.celex

      // Double-check not already in DB
      const exists = await prisma.euDocument.findUnique({
        where: { celex_number: celex },
      })
      if (exists) {
        console.log(`  skip ${celex} (already exists)`)
        skipped++
        continue
      }

      if (DRY_RUN) {
        console.log(
          `  [dry-run] would insert ${celex} — ${doc.title.substring(0, 80)}`
        )
        inserted++
        continue
      }

      try {
        // Generate slug
        let slug = generateEuSlug(doc.title, celex)
        const slugExists = await prisma.legalDocument.findUnique({
          where: { slug },
        })
        if (slugExists) {
          slug = `${slug}-${celex.toLowerCase()}`
        }

        // Optionally fetch content
        let htmlContent: string | null = null
        let fullText: string | null = null
        let extractedMetadata: ReturnType<typeof extractEUMetadata> | null =
          null

        if (WITH_CONTENT) {
          try {
            const content = await fetchDocumentContentViaCellar(celex)
            if (content) {
              htmlContent = content.html
              fullText = content.plainText
              extractedMetadata = extractEUMetadata(fullText, doc.title)
              console.log(
                `    fetched content: ${(htmlContent?.length ?? 0).toLocaleString()} chars`
              )
            }
          } catch {
            console.log(`    content fetch failed, continuing without`)
          }
        }

        // Build metadata
        const baseMetadata = {
          celex,
          sector: 3,
          documentType: 'REG',
          euDocNumber: doc.documentNumber,
          eutReference: doc.eutReference,
          source: 'eur-lex.europa.eu',
          fetchedAt: new Date().toISOString(),
          method: 'targeted-notisum-baseline',
        }

        const metadata = extractedMetadata
          ? {
              ...baseMetadata,
              articleCount: extractedMetadata.articleCount,
              chapterCount: extractedMetadata.chapterCount,
              sectionCount: extractedMetadata.sectionCount,
              recitalCount: extractedMetadata.recitalCount,
              issuingBody: extractedMetadata.issuingBody,
              issuingBodySwedish: extractedMetadata.issuingBodySwedish,
              documentComplexity: extractedMetadata.documentComplexity,
              wordCount: extractedMetadata.wordCount,
            }
          : baseMetadata

        // Create LegalDocument + EuDocument
        await prisma.legalDocument.create({
          data: {
            document_number: celex,
            title: doc.title,
            slug,
            content_type: ContentType.EU_REGULATION,
            full_text: fullText,
            html_content: htmlContent,
            publication_date: doc.publicationDate,
            effective_date: doc.entryIntoForce,
            status: DocumentStatus.ACTIVE,
            source_url: doc.eurlexUrl,
            metadata,
            eu_document: {
              create: {
                celex_number: celex,
                eut_reference: doc.eutReference,
                eli_identifier: doc.eli,
                in_force: doc.inForce,
                directory_codes: doc.directoryCodes,
                subject_matters: doc.subjectMatters,
                eurovoc_concepts: doc.eurovocConcepts,
                authors: doc.authors,
                legal_basis_celex: doc.legalBasisCelex,
                cites_celex: doc.citesCelex,
                end_of_validity: doc.endOfValidity,
                signature_date: doc.signatureDate,
                eea_relevant: doc.eeaRelevant,
              },
            },
          },
        })

        inserted++
        console.log(`  + ${celex} — ${doc.title.substring(0, 80)}`)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('Unique constraint')) {
          console.log(`  skip ${celex} (unique constraint)`)
          skipped++
        } else {
          console.error(`  FAIL ${celex}: ${msg}`)
          failed++
        }
      }
    }

    // 4. Fetch relationships for newly inserted documents
    if (inserted > 0 && !DRY_RUN) {
      const insertedCelex = uniqueDocs
        .filter((d) => !existingSet.has(d.celex))
        .map((d) => d.celex)

      if (insertedCelex.length > 0) {
        console.log()
        console.log(
          `Fetching relationships for ${insertedCelex.length} documents...`
        )
        try {
          const relationships = await fetchDocumentRelationships(insertedCelex)
          let relUpdated = 0

          for (const [celex, rel] of relationships) {
            if (
              rel.citesCelex.length > 0 ||
              rel.legalBasisCelex.length > 0 ||
              rel.amendedByCelex.length > 0 ||
              rel.correctedByCelex.length > 0
            ) {
              await prisma.euDocument.update({
                where: { celex_number: celex },
                data: {
                  cites_celex: rel.citesCelex,
                  legal_basis_celex: rel.legalBasisCelex,
                  amended_by_celex: rel.amendedByCelex,
                  corrected_by_celex: rel.correctedByCelex,
                },
              })
              relUpdated++
            }
          }

          console.log(`  Updated relationships for ${relUpdated} documents`)
        } catch (error) {
          console.error(
            '  Relationship fetch failed:',
            error instanceof Error ? error.message : error
          )
        }
      }
    }

    // 5. Handle documents not found in SPARQL — create stubs from CELEX
    if (notFound.length > 0 && !DRY_RUN) {
      console.log()
      console.log(
        `Creating stubs for ${notFound.length} documents not found in SPARQL...`
      )

      for (const celex of notFound) {
        // Parse CELEX to generate a basic title
        const match = celex.match(/^(\d)(\d{4})([A-Z])(\d+)$/)
        if (!match) {
          console.error(`  Cannot parse CELEX: ${celex}`)
          failed++
          continue
        }

        const [, , year, , number] = match
        const cleanNumber = parseInt(number!, 10)
        const isPreLisbon = parseInt(year!, 10) < 2009
        const prefix = isPreLisbon ? 'EG' : 'EU'
        const title = `Europaparlamentets och rådets förordning (${prefix}) nr ${cleanNumber}/${year}`
        const slug = `forordning-${prefix.toLowerCase()}-${cleanNumber}-${year}-${celex.toLowerCase()}`

        try {
          const slugExists = await prisma.legalDocument.findUnique({
            where: { slug },
          })

          await prisma.legalDocument.create({
            data: {
              document_number: celex,
              title: slugExists ? `${title} [${celex}]` : title,
              slug: slugExists ? `${slug}-dup` : slug,
              content_type: ContentType.EU_REGULATION,
              status: DocumentStatus.ACTIVE,
              source_url: `https://eur-lex.europa.eu/legal-content/SV/ALL/?uri=CELEX:${celex}`,
              metadata: {
                celex,
                sector: 3,
                documentType: 'REG',
                source: 'eur-lex.europa.eu',
                method: 'targeted-stub',
                fetchedAt: new Date().toISOString(),
              },
              eu_document: {
                create: {
                  celex_number: celex,
                },
              },
            },
          })

          inserted++
          console.log(`  + ${celex} [stub] — ${title}`)
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          console.error(`  FAIL ${celex}: ${msg}`)
          failed++
        }
      }
    }

    // Summary
    console.log()
    console.log('='.repeat(70))
    console.log(`Inserted: ${inserted}`)
    console.log(`Skipped:  ${skipped}`)
    console.log(`Failed:   ${failed}`)
    if (notFound.length > 0) {
      console.log(`Stubs:    ${notFound.length} (no Swedish title in EUR-Lex)`)
    }

    // Final verification
    const finalCount = await prisma.euDocument.count({
      where: { celex_number: { in: TARGET_CELEX } },
    })
    console.log()
    console.log(
      `Notisum baseline coverage: ${finalCount}/${TARGET_CELEX.length}`
    )
    console.log('='.repeat(70))
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
