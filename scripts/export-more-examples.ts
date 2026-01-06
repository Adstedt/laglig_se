import { config } from 'dotenv'
import { resolve } from 'path'
import { writeFileSync } from 'fs'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { htmlToMarkdown } from '../lib/transforms/html-to-markdown'

const prisma = new PrismaClient()

async function main() {
  // Get 3 more test amendments (skip the first one we already reviewed)
  const docs = await prisma.legalDocument.findMany({
    where: {
      document_number: { startsWith: 'SFS 1998:100' },
      html_content: { not: null }
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
    },
    orderBy: { document_number: 'asc' },
    skip: 1,
    take: 3
  })

  for (const doc of docs) {
    if (!doc.html_content) continue

    const sfsNum = doc.document_number.replace('SFS ', '').replace(':', '-')
    const markdown = htmlToMarkdown(doc.html_content)

    const outputPath = resolve(process.cwd(), `test-results/SFS${sfsNum}.md`)
    writeFileSync(outputPath, markdown, 'utf-8')

    console.log('\n' + '='.repeat(60))
    console.log(doc.document_number + ': ' + doc.title)
    console.log('Written to: test-results/SFS' + sfsNum + '.md')
    console.log('='.repeat(60))
    console.log(markdown.slice(0, 1500))
    if (markdown.length > 1500) console.log('\n... [truncated]')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
