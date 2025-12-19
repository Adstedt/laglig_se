/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function check() {
  // Check specific document
  const doc = await prisma.legalDocument.findUnique({
    where: { id: '93f2a807-e3a7-48e8-9363-e9739dd1144a' },
    include: { eu_document: true },
  })

  if (doc) {
    console.log('=== Document found ===')
    console.log('  document_number:', doc.document_number)
    console.log('  title:', doc.title?.substring(0, 100))
    console.log('  content_type:', doc.content_type)
    console.log('  html_content length:', doc.html_content?.length || 0)
    console.log('  full_text length:', doc.full_text?.length || 0)
    console.log('  source_url:', doc.source_url)
    console.log('')
    console.log('EU Document metadata:')
    console.log('  celex:', doc.eu_document?.celex_number)
    console.log('  in_force:', doc.eu_document?.in_force)
    console.log('  eli:', doc.eu_document?.eli_identifier)
    console.log('  authors:', doc.eu_document?.authors)
    console.log('  directory_codes:', doc.eu_document?.directory_codes)
  } else {
    console.log('Document not found')
  }

  // Also check by CELEX - try different formats
  console.log('')
  console.log('=== Searching for 32020L1057 variants ===')

  const searches = ['CELEX 32020L1057', '32020L1057', 'CELEX:32020L1057']

  for (const search of searches) {
    const found = await prisma.legalDocument.findFirst({
      where: { document_number: search },
    })
    console.log(`  "${search}":`, found ? 'FOUND' : 'not found')
  }

  // Search in eu_documents table
  const euDoc = await prisma.euDocument.findFirst({
    where: { celex_number: '32020L1057' },
    include: { document: true },
  })
  console.log('')
  console.log(
    'Direct CELEX search in eu_documents:',
    euDoc ? 'FOUND' : 'not found'
  )
  if (euDoc) {
    console.log('  document_number:', euDoc.document.document_number)
    console.log(
      '  html_content length:',
      euDoc.document.html_content?.length || 0
    )
  }

  // Stats by ingestion method
  console.log('')
  console.log('=== Stats by content type ===')
  const stats = (await prisma.$queryRawUnsafe(`
    SELECT
      content_type::text,
      COUNT(*)::int as total,
      COUNT(html_content)::int as with_html
    FROM legal_documents
    WHERE content_type IN ('EU_REGULATION', 'EU_DIRECTIVE')
    GROUP BY content_type
  `)) as Array<{ content_type: string; total: number; with_html: number }>

  stats.forEach((s) => {
    console.log(`  ${s.content_type}: ${s.with_html}/${s.total} with HTML`)
  })

  await prisma.$disconnect()
}

check()
