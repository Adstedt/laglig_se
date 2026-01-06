import { config } from 'dotenv'
import { resolve } from 'path'
import { writeFileSync } from 'fs'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { htmlToMarkdown } from '../lib/transforms/html-to-markdown'

const prisma = new PrismaClient()

async function main() {
  // Get a base law with HTML content
  const doc = await prisma.legalDocument.findFirst({
    where: {
      content_type: 'SFS_LAW',
      html_content: { not: null }
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
    },
    orderBy: { document_number: 'asc' }
  })

  if (!doc || !doc.html_content) {
    console.log('No base law with HTML content found')
    return
  }

  console.log('Testing:', doc.document_number, '-', doc.title)
  console.log('HTML length:', doc.html_content.length, 'chars')
  console.log('\n--- HTML SAMPLE (first 500 chars) ---')
  console.log(doc.html_content.slice(0, 500))
  
  const markdown = htmlToMarkdown(doc.html_content)
  
  const sfsNum = doc.document_number.replace('SFS ', '').replace(':', '-')
  const outputPath = resolve(process.cwd(), `test-results/base-law-${sfsNum}.md`)
  writeFileSync(outputPath, markdown, 'utf-8')
  
  console.log('\n--- MARKDOWN OUTPUT (first 2000 chars) ---')
  console.log(markdown.slice(0, 2000))
  if (markdown.length > 2000) console.log('\n... [truncated]')
  console.log('\nWritten to:', outputPath)
}

main().catch(console.error).finally(() => prisma.$disconnect())
