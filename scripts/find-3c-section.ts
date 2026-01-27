import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:57' },
    select: { html_content: true },
  })

  const html = doc?.html_content || ''

  // Find all occurrences of "3 c §"
  let idx = 0
  let count = 0
  while ((idx = html.indexOf('3 c §', idx)) !== -1) {
    count++
    console.log(`=== Occurrence ${count} at index ${idx} ===`)
    console.log(html.substring(Math.max(0, idx - 100), idx + 200))
    console.log('')
    idx++
  }

  // Find the section with P3C ID
  const idxP3C = html.indexOf('id="SFS2025-57_P3C"')
  if (idxP3C > -1) {
    console.log('=== Section P3C ===')
    console.log(html.substring(idxP3C - 100, idxP3C + 500))
  }

  await prisma.$disconnect()
}
main()
