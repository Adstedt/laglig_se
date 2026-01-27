import { config } from 'dotenv'
import { resolve } from 'path'
import { writeFileSync } from 'fs'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { htmlToMarkdown } from '../lib/transforms/html-to-markdown'

const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: {
      document_number: { contains: '1977:1160' },
      html_content: { not: null },
    },
    select: {
      document_number: true,
      title: true,
      html_content: true,
    },
  })

  if (!doc || !doc.html_content) {
    console.log('SFS 1977:1160 not found or no HTML content')
    return
  }

  console.log('Testing:', doc.document_number, '-', doc.title)
  console.log('HTML length:', doc.html_content.length, 'chars')

  const markdown = htmlToMarkdown(doc.html_content)

  const outputPath = resolve(process.cwd(), 'test-results/SFS1977-1160.md')
  writeFileSync(outputPath, markdown, 'utf-8')

  console.log('\n--- MARKDOWN OUTPUT (first 3000 chars) ---\n')
  console.log(markdown.slice(0, 3000))
  if (markdown.length > 3000) console.log('\n... [truncated]')
  console.log('\nWritten to:', outputPath)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
