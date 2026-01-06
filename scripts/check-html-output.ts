import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:57' },
    select: { html_content: true }
  })

  const html = doc?.html_content || ''

  console.log('=== LAST 4000 CHARS ===')
  console.log(html.substring(html.length - 4000))

  console.log('\n\n=== SEARCH FOR ISSUES ===')

  // Check for the strange numbers
  if (html.includes('353)') || html.includes('716)')) {
    console.log('Found "353)" or "716)" - incorrect parsing')
  }

  // Check for Samhällsintroduktion
  if (html.includes('Samhällsintroduktion')) {
    console.log('Found "Samhällsintroduktion" header')
  } else {
    console.log('MISSING "Samhällsintroduktion" header')
  }

  // Check for ikraftträdande
  if (html.includes('Ikraftträdande') || html.includes('träder i kraft')) {
    console.log('Found ikraftträdande section')
  } else {
    console.log('MISSING ikraftträdande section')
  }

  // Check for JOHAN FORSSELL
  if (html.includes('JOHAN FORSSELL')) {
    console.log('Found signature')
  } else {
    console.log('MISSING signature')
  }

  await prisma.$disconnect()
}
main()
