import { config } from 'dotenv'
import { resolve } from 'path'
import { writeFileSync } from 'fs'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { htmlToMarkdown } from '../lib/transforms/html-to-markdown'

const prisma = new PrismaClient()

async function main() {
  // Get a modern base law (SFS format, not HIST)
  const doc = await prisma.legalDocument.findFirst({
    where: {
      content_type: 'SFS_LAW',
      document_number: { startsWith: 'SFS' },
      html_content: { not: null }
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
    },
    orderBy: { document_number: 'desc' }
  })

  if (!doc || !doc.html_content) {
    console.log('No modern base law with HTML content found')
    
    // Check what we have
    const samples = await prisma.legalDocument.findMany({
      where: { content_type: 'SFS_LAW', html_content: { not: null } },
      select: { document_number: true, title: true },
      take: 10
    })
    console.log('Available laws with HTML:')
    samples.forEach(s => console.log(s.document_number, '-', s.title?.slice(0, 50)))
    return
  }

  console.log('Testing:', doc.document_number, '-', doc.title)
  console.log('HTML length:', doc.html_content.length, 'chars')
  console.log('\n--- HTML SAMPLE (first 800 chars) ---')
  console.log(doc.html_content.slice(0, 800))
  
  const markdown = htmlToMarkdown(doc.html_content)
  
  const sfsNum = doc.document_number.replace('SFS ', '').replace(':', '-')
  const outputPath = resolve(process.cwd(), `test-results/base-law-${sfsNum}.md`)
  writeFileSync(outputPath, markdown, 'utf-8')
  
  console.log('\n--- MARKDOWN OUTPUT (first 2500 chars) ---')
  console.log(markdown.slice(0, 2500))
  if (markdown.length > 2500) console.log('\n... [truncated]')
  console.log('\nWritten to:', outputPath)
}

main().catch(console.error).finally(() => prisma.$disconnect())
