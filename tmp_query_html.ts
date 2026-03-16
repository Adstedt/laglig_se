import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2023:875', content_type: 'SFS_LAW' },
    select: { html_content: true },
  })
  if (!doc?.html_content) {
    console.log('NOT FOUND for SFS 2023:875 with SFS_LAW')
    // List some available docs
    const docs = await prisma.legalDocument.findMany({
      where: { content_type: 'SFS_LAW' },
      select: { document_number: true, title: true },
      take: 10,
    })
    console.log('Available SFS_LAW documents (' + docs.length + '):')
    for (const d of docs) {
      console.log('  ' + d.document_number + ' - ' + d.title)
    }
    return
  }
  // Show structure around first paragraf section
  const idx = doc.html_content.indexOf('class="paragraf"')
  if (idx > 0) {
    const start = Math.max(0, idx - 200)
    const end = Math.min(doc.html_content.length, idx + 800)
    console.log('=== BASE LAW STRUCTURE (around first paragraf) ===')
    console.log(doc.html_content.substring(start, end))
  }
  // Show structure around footnote
  const fnIdx = doc.html_content.indexOf('footnote')
  if (fnIdx > 0) {
    const start2 = Math.max(0, fnIdx - 200)
    const end2 = Math.min(doc.html_content.length, fnIdx + 400)
    console.log('\n=== BASE LAW STRUCTURE (around footnote) ===')
    console.log(doc.html_content.substring(start2, end2))
  }
  // Show list structure
  const listIdx = doc.html_content.indexOf('<li>')
  if (listIdx > 0) {
    const start3 = Math.max(0, listIdx - 100)
    const end3 = Math.min(doc.html_content.length, listIdx + 600)
    console.log('\n=== BASE LAW STRUCTURE (around list) ===')
    console.log(doc.html_content.substring(start3, end3))
  }
  // Show a group/section heading if any
  const grpIdx = doc.html_content.indexOf('Definitioner')
  if (grpIdx > 0) {
    const start4 = Math.max(0, grpIdx - 100)
    const end4 = Math.min(doc.html_content.length, grpIdx + 400)
    console.log('\n=== BASE LAW STRUCTURE (section heading) ===')
    console.log(doc.html_content.substring(start4, end4))
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
