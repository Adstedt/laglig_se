import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:57' },
    select: { html_content: true },
  })

  const html = doc?.html_content || ''

  // Find 3 c § and check if Samhällsintroduktion header exists before it
  const idx3c = html.indexOf('3 c §')
  if (idx3c > -1) {
    console.log('=== Around "3 c §" ===')
    console.log(html.substring(Math.max(0, idx3c - 500), idx3c + 300))
    console.log('')
  }

  // Check for Samhällsintroduktion
  const idxSamh = html.indexOf('Samhällsintroduktion')
  console.log('Samhällsintroduktion found at index:', idxSamh)
  console.log('3 c § found at index:', idx3c)

  if (idxSamh > -1 && idx3c > -1) {
    console.log('Samhällsintroduktion comes BEFORE 3 c §:', idxSamh < idx3c)
  }

  await prisma.$disconnect()
}
main()
