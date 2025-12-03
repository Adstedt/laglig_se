/* eslint-disable no-console */
/**
 * Test Script: Fetch 100 Court Cases from AD (Labour Court)
 *
 * Purpose: Manual validation of Domstolsverket API integration before full ingestion
 *
 * Validates:
 * - API connection and response structure
 * - innehall field contains HTML (full text works)
 * - bilagaLista structure for PDF attachments
 * - lagrumLista structure for SFS cross-references
 *
 * Usage: pnpm tsx scripts/test-court-cases-fetch.ts
 */

import {
  fetchCourtCases,
  type PubliceringDTO as _PubliceringDTO,
  generateDocumentNumber,
  generateTitle,
  extractCaseNumber,
  parseApiDate,
  COURT_CONFIGS,
} from '../lib/external/domstolsverket'

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🧪 Test Script: Fetching 100 AD Court Cases')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  try {
    // Fetch 100 cases from AD (highest priority court)
    console.log(`📡 Fetching cases from: ${COURT_CONFIGS.AD.name}`)
    console.log(`   Court code: ${COURT_CONFIGS.AD.code}`)
    console.log(`   Content type: ${COURT_CONFIGS.AD.contentType}`)
    console.log('')

    const result = await fetchCourtCases('AD', 0, 100)

    console.log(`✅ API Response received`)
    console.log(`   Total cases in API: ${result.total}`)
    console.log(`   Cases in this batch: ${result.publiceringLista?.length || 0}`)
    console.log('')

    const cases = result.publiceringLista || []

    if (cases.length === 0) {
      console.log('⚠️  No cases returned from API')
      return
    }

    // Analyze the response structure
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 Response Structure Analysis')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Count cases with various fields
    let withFullText = 0
    let withSummary = 0
    let withAttachments = 0
    let withLagrumRefs = 0
    let withKeywords = 0
    let withEcli = 0
    let withAdNumber = 0

    let totalFullTextLength = 0
    let totalAttachments = 0
    let totalLagrumRefs = 0

    for (const c of cases) {
      if (c.innehall && c.innehall.length > 0) {
        withFullText++
        totalFullTextLength += c.innehall.length
      }
      if (c.sammanfattning && c.sammanfattning.length > 0) withSummary++
      if (c.bilagaLista && c.bilagaLista.length > 0) {
        withAttachments++
        totalAttachments += c.bilagaLista.length
      }
      if (c.lagrumLista && c.lagrumLista.length > 0) {
        withLagrumRefs++
        totalLagrumRefs += c.lagrumLista.length
      }
      if (c.nyckelordLista && c.nyckelordLista.length > 0) withKeywords++
      if (c.ecliNummer) withEcli++
      if (c.arbetsdomstolenDomsnummer) withAdNumber++
    }

    console.log('')
    console.log('Field Coverage:')
    console.log(`  📝 innehall (full text):     ${withFullText}/${cases.length} cases (${Math.round(withFullText/cases.length*100)}%)`)
    console.log(`  📋 sammanfattning (summary): ${withSummary}/${cases.length} cases`)
    console.log(`  📎 bilagaLista (attachments): ${withAttachments}/${cases.length} cases (${totalAttachments} total attachments)`)
    console.log(`  ⚖️  lagrumLista (SFS refs):   ${withLagrumRefs}/${cases.length} cases (${totalLagrumRefs} total refs)`)
    console.log(`  🏷️  nyckelordLista (keywords): ${withKeywords}/${cases.length} cases`)
    console.log(`  🔗 ecliNummer (ECLI):         ${withEcli}/${cases.length} cases`)
    console.log(`  #️⃣  arbetsdomstolenDomsnummer: ${withAdNumber}/${cases.length} cases`)
    console.log('')

    if (withFullText > 0) {
      const avgLength = Math.round(totalFullTextLength / withFullText)
      console.log(`  📏 Average full text length: ${avgLength.toLocaleString()} characters`)
    }

    // Verify HTML content in innehall
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔍 HTML Content Verification')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const caseWithHtml = cases.find((c) => c.innehall && c.innehall.length > 100)
    if (caseWithHtml && caseWithHtml.innehall) {
      const htmlContent = caseWithHtml.innehall
      const hasHtmlTags = /<[^>]+>/.test(htmlContent)
      const hasParagraphs = /<p\b/i.test(htmlContent)
      const hasHeadings = /<h[1-6]\b/i.test(htmlContent)
      const hasStrong = /<strong\b/i.test(htmlContent) || /<b\b/i.test(htmlContent)

      console.log('')
      console.log(`Sample case: ${generateDocumentNumber(caseWithHtml)}`)
      console.log(`  Content length: ${htmlContent.length.toLocaleString()} characters`)
      console.log(`  Contains HTML tags: ${hasHtmlTags ? '✅ YES' : '❌ NO'}`)
      console.log(`  Contains <p> tags: ${hasParagraphs ? '✅ YES' : '❌ NO'}`)
      console.log(`  Contains heading tags: ${hasHeadings ? '✅ YES' : '❌ NO'}`)
      console.log(`  Contains emphasis tags: ${hasStrong ? '✅ YES' : '❌ NO'}`)

      console.log('')
      console.log('  First 500 characters of content:')
      console.log('  ─────────────────────────────────')
      console.log(`  ${htmlContent.substring(0, 500)}...`)
    } else {
      console.log('⚠️  No case found with sufficient full text content')
    }

    // Check bilagaLista structure
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📎 PDF Attachment Structure (bilagaLista)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const caseWithAttachments = cases.find(
      (c) => c.bilagaLista && c.bilagaLista.length > 0
    )
    if (caseWithAttachments && caseWithAttachments.bilagaLista) {
      console.log('')
      console.log(`Sample case: ${generateDocumentNumber(caseWithAttachments)}`)
      console.log(`  Attachments: ${caseWithAttachments.bilagaLista.length}`)
      for (const attachment of caseWithAttachments.bilagaLista.slice(0, 3)) {
        console.log(`    - fillagringId: ${attachment.fillagringId}`)
        console.log(`      filnamn: ${attachment.filnamn}`)
      }
    } else {
      console.log('⚠️  No case found with attachments in this batch')
    }

    // Check lagrumLista structure
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⚖️  SFS Law References (lagrumLista)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const caseWithRefs = cases.find(
      (c) => c.lagrumLista && c.lagrumLista.length > 0
    )
    if (caseWithRefs && caseWithRefs.lagrumLista) {
      console.log('')
      console.log(`Sample case: ${generateDocumentNumber(caseWithRefs)}`)
      console.log(`  SFS references: ${caseWithRefs.lagrumLista.length}`)
      for (const ref of caseWithRefs.lagrumLista.slice(0, 5)) {
        console.log(`    - sfsNummer: ${ref.sfsNummer}`)
        if (ref.referens) {
          console.log(`      referens: ${ref.referens}`)
        }
      }
    } else {
      console.log('⚠️  No case found with SFS references in this batch')
    }

    // Sample case details
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 Sample Cases (first 10)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    for (const c of cases.slice(0, 10)) {
      console.log('')
      console.log(`  ${generateDocumentNumber(c)}`)
      console.log(`    Title: ${generateTitle(c).substring(0, 70)}${generateTitle(c).length > 70 ? '...' : ''}`)
      console.log(`    Court: ${c.domstol?.domstolNamn || 'N/A'}`)
      console.log(`    Case #: ${extractCaseNumber(c) || 'N/A'}`)
      console.log(`    Date: ${parseApiDate(c.avgorandedatum)?.toISOString().split('T')[0] || 'N/A'}`)
      console.log(`    Type: ${c.typ || 'N/A'}`)
      console.log(`    Full text: ${c.innehall ? `${c.innehall.length.toLocaleString()} chars` : 'N/A'}`)
      console.log(`    Attachments: ${c.bilagaLista?.length || 0}`)
      console.log(`    SFS refs: ${c.lagrumLista?.length || 0}`)
    }

    // Final summary
    console.log('')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 SUMMARY')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('')
    console.log(`  Fetched: ${cases.length} cases`)
    console.log(`  With full text: ${withFullText} (${Math.round(withFullText/cases.length*100)}%)`)
    console.log(`  With attachments: ${withAttachments} (${totalAttachments} total)`)
    console.log(`  With SFS refs: ${withLagrumRefs} (${totalLagrumRefs} total)`)
    console.log('')

    if (withFullText > 0) {
      console.log('🏆 COMPETITIVE ADVANTAGE VERIFIED:')
      console.log('   AD (Arbetsdomstolen) cases have full text content!')
      console.log('   (Notisum\'s AD pages show only "- - -" / empty content)')
    } else {
      console.log('⚠️  WARNING: No cases with full text found!')
      console.log('   Please investigate API response structure')
    }

    console.log('')
    console.log('✅ Test script completed successfully')

  } catch (error) {
    console.error('')
    console.error('❌ Error during test:')
    console.error(error)
    process.exit(1)
  }
}

main()
