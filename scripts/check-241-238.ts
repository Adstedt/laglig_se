import { prisma } from '../lib/prisma'

async function main() {
  // Compare HTML structure of a SFS_LAW (241) vs SFS_AMENDMENT (234)
  for (const num of ['SFS 2026:241', 'SFS 2026:234']) {
    const doc = await prisma.legalDocument.findUnique({
      where: { document_number: num },
      select: { document_number: true, content_type: true, html_content: true },
    })
    if (!doc) {
      console.log(`${num}: NOT FOUND`)
      continue
    }
    const html = doc.html_content ?? ''
    console.log(`\n=== ${num} [${doc.content_type}] ===`)
    console.log(`Length: ${html.length} chars`)
    // Show first 1500 chars to see the structure
    console.log(html.slice(0, 1500))
    console.log('\n... (truncated)')
  }

  await prisma.$disconnect()
}

main().catch(console.error)
