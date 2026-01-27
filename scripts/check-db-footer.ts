import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:57' },
    select: { html_content: true, updated_at: true },
  })

  const html = doc?.html_content || ''

  console.log('Updated at:', doc?.updated_at)
  console.log('HTML length:', html.length)
  console.log('')

  // Check for key sections
  console.log(
    'Has Samhällsintroduktion:',
    html.includes('Samhällsintroduktion')
  )
  console.log('Has Ikraftträdande:', html.includes('Ikraftträdande'))
  console.log('Has footer BACK0001:', html.includes('BACK0001'))
  console.log('')

  // Show footer
  const footerIdx = html.indexOf('<footer')
  if (footerIdx > -1) {
    console.log('=== FOOTER SECTION ===')
    console.log(html.substring(footerIdx))
  }

  await prisma.$disconnect()
}
main()
