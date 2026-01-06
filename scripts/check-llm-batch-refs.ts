import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_AMENDMENT', html_content: { not: null } },
    select: { document_number: true, title: true, html_content: true }
  })

  let llmLagar = 0
  let llmLagarWithRefs = 0
  let llmForordningar = 0

  for (const doc of docs) {
    const html = doc.html_content || ''
    const title = (doc.title || '').toLowerCase()

    // Only count LLM-processed docs
    if (!html.includes('<article class="sfs"') && !html.includes('class="lovhead"')) {
      continue
    }

    const hasRefs = /[Pp]rop\.\s*\d{4}\/\d{2,4}:\d+/.test(html)

    if (title.includes('lag (') || title.includes('lag om')) {
      llmLagar++
      if (hasRefs) llmLagarWithRefs++
      else {
        console.log('LAG without refs:', doc.document_number, '-', doc.title?.substring(0, 50))
      }
    } else if (title.includes('förordning')) {
      llmForordningar++
    }
  }

  console.log('\nLLM-processed batch (100 docs):')
  console.log('  Lagar (laws):', llmLagar, '- with refs:', llmLagarWithRefs)
  console.log('  Förordningar:', llmForordningar, '(no refs expected)')
}

main().catch(console.error).finally(() => prisma.$disconnect())
