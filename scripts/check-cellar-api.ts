/* eslint-disable no-console */
import { prisma } from '../lib/prisma'
import { fetchDocumentContentViaCellar } from '../lib/external/eurlex'

async function check() {
  // Get some documents WITH html content to see their format
  const withHtml = await prisma.legalDocument.findMany({
    where: {
      content_type: 'EU_REGULATION',
      html_content: { not: null },
    },
    take: 3,
    select: { document_number: true, html_content: true },
  })

  // Get some without html
  const withoutHtml = await prisma.legalDocument.findMany({
    where: {
      content_type: 'EU_DIRECTIVE',
      html_content: null,
    },
    take: 3,
    select: { document_number: true },
  })

  console.log('=== Documents WITH HTML ===')
  for (const doc of withHtml) {
    console.log(
      `  ${doc.document_number}: ${doc.html_content?.length || 0} bytes`
    )
  }

  console.log('')
  console.log('=== Testing CELLAR API for documents WITHOUT HTML ===')
  for (const doc of withoutHtml) {
    console.log(`\nTesting ${doc.document_number}...`)
    try {
      const content = await fetchDocumentContentViaCellar(doc.document_number)
      if (content) {
        console.log(`  SUCCESS: ${content.html.length} bytes HTML`)
      } else {
        console.log(`  FAILED: no content returned`)
      }
    } catch (e) {
      console.log(`  ERROR: ${e instanceof Error ? e.message : e}`)
    }
  }

  console.log('')
  console.log('=== Testing CELLAR API for a document WITH HTML ===')
  if (withHtml[0]) {
    console.log(`Testing ${withHtml[0].document_number}...`)
    try {
      const content = await fetchDocumentContentViaCellar(
        withHtml[0].document_number
      )
      if (content) {
        console.log(`  SUCCESS: ${content.html.length} bytes HTML`)
      } else {
        console.log(`  FAILED: no content returned`)
      }
    } catch (e) {
      console.log(`  ERROR: ${e instanceof Error ? e.message : e}`)
    }
  }

  await prisma.$disconnect()
}

check()
