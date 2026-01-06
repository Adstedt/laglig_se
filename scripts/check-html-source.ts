import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_AMENDMENT', html_content: { not: null } },
    select: { document_number: true, html_content: true }
  })

  let llmProcessed = 0
  let legacyHtml = 0

  for (const doc of docs) {
    const html = doc.html_content || ''
    // LLM-generated HTML has <article class="sfs">
    if (html.includes('<article class="sfs"') || html.includes('class="lovhead"')) {
      llmProcessed++
    } else {
      legacyHtml++
    }
  }

  console.log('HTML source breakdown:')
  console.log('  LLM-processed (new semantic HTML):', llmProcessed)
  console.log('  Legacy HTML (rkrattsbaser API):', legacyHtml)
  console.log('  Total:', docs.length)
}

main().catch(console.error).finally(() => prisma.$disconnect())
