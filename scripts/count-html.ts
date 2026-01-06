import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const total = await prisma.amendmentDocument.count({
    where: { parse_status: 'COMPLETED' }
  })

  const withMarkdown = await prisma.amendmentDocument.count({
    where: {
      parse_status: 'COMPLETED',
      markdown_content: { not: null }
    }
  })

  // Check LegalDocument table for html_content (where batch results are stored)
  const legalDocsWithHtml = await prisma.legalDocument.count({
    where: {
      html_content: { not: '' }
    }
  })

  const legalDocsTotal = await prisma.legalDocument.count()

  // Specifically SFS_AMENDMENT type
  const amendmentsTotal = await prisma.legalDocument.count({
    where: { content_type: 'SFS_AMENDMENT' }
  })

  const amendmentsWithHtml = await prisma.legalDocument.count({
    where: {
      content_type: 'SFS_AMENDMENT',
      html_content: { not: '' }
    }
  })

  console.log('Amendment Documents (source):')
  console.log('  Total (COMPLETED):', total)
  console.log('  With markdown:', withMarkdown)
  console.log('')
  console.log('Legal Documents (all types):')
  console.log('  Total:', legalDocsTotal)
  console.log('  With HTML:', legalDocsWithHtml, `(${((legalDocsWithHtml / legalDocsTotal) * 100).toFixed(1)}%)`)
  console.log('')
  console.log('SFS Amendments (what batch is building):')
  console.log('  Total:', amendmentsTotal)
  console.log('  With HTML:', amendmentsWithHtml, `(${((amendmentsWithHtml / amendmentsTotal) * 100).toFixed(1)}%)`)
  console.log('  Still need:', amendmentsTotal - amendmentsWithHtml)

  await prisma.$disconnect()
}
main()
