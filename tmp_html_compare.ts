import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  const docs = await p.legalDocument.findMany({
    where: {
      document_number: { in: ['SFS 1977:1160', '32016R0679', 'AFS 2023:1'] },
    },
    select: { document_number: true, html_content: true },
  })

  console.log('Found ' + docs.length + ' documents')

  for (const d of docs) {
    const html = d.html_content || ''
    console.log('\n' + '='.repeat(60))
    console.log(d.document_number + ' — FIRST BODY SECTION')
    console.log('='.repeat(60))
    console.log('html_content length: ' + html.length)

    // Find the body div or first section
    let startIdx = html.indexOf('<div class="body">')
    if (startIdx === -1) startIdx = html.indexOf('<section')
    if (startIdx === -1) startIdx = 0

    console.log('startIdx: ' + startIdx)

    // Get ~2500 chars from that point
    const snippet = html.substring(startIdx, startIdx + 2500)
    console.log(snippet)
  }
}
main().finally(() => p.$disconnect())
