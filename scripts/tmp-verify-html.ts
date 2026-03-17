import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const docs = await p.legalDocument.findMany({
    where: {
      document_number: {
        in: [
          'AFS 2023:1',
          'SFS SFS:2025-18',
          '32016R0679',
          'MSBFS 2009:1',
          'SFS 1977:1160',
        ],
      },
    },
    select: {
      document_number: true,
      html_content: true,
      json_content: true,
      markdown_content: true,
      updated_at: true,
    },
  })
  for (const d of docs) {
    const html = d.html_content || ''
    const hasCanonical = html.includes('<article class="legal-document"')
    const hasLovhead = html.includes('div class="lovhead"')
    const first100 = html.slice(0, 100).replace(/\n/g, ' ')
    const jsonKeys = d.json_content ? Object.keys(d.json_content as object) : []
    console.log(`\n${d.document_number}`)
    console.log(`  updated_at: ${d.updated_at.toISOString()}`)
    console.log(
      `  html: ${html.length} chars | canonical: ${hasCanonical} | lovhead: ${hasLovhead}`
    )
    console.log(`  html start: ${first100}`)
    console.log(
      `  json_content: ${jsonKeys.length > 0 ? jsonKeys.join(', ') : 'null'}`
    )
    console.log(
      `  markdown: ${d.markdown_content ? d.markdown_content.length + ' chars' : 'null'}`
    )
  }
}
main().finally(() => p.$disconnect())
