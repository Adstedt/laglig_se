const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const d = await p.legalDocument.findFirst({
    where: { document_number: { contains: '2026:43' } },
    select: { document_number: true, html_content: true },
  })
  if (!d) {
    console.log('NOT FOUND')
    return
  }

  const html = d.html_content || ''

  console.log('Has .sfstoc:', html.includes('class="sfstoc"'))

  // Check h3 headings
  const h3s = html.match(/<h3[^>]*>[\s\S]*?<\/h3>/g) || []
  console.log('\n=== h3 headings ===')
  h3s.forEach((m) => console.log(' ', m.substring(0, 150)))

  // Check h4 headings
  const h4s = html.match(/<h4[^>]*>[\s\S]*?<\/h4>/g) || []
  console.log('\n=== h4 headings ===')
  h4s.forEach((m) => console.log(' ', m.substring(0, 150)))

  // Check a.paragraf count
  const paragrafs = html.match(/<a[^>]*class=.paragraf.[^>]*>/g) || []
  console.log('\n=== a.paragraf count ===', paragrafs.length)

  // Count h3/h4 with name/id
  const h3Named = html.match(/<h3[^>]*(?:name|id)=[^>]*>/g) || []
  const h4Named = html.match(/<h4[^>]*(?:name|id)=[^>]*>/g) || []
  console.log('h3 with name/id:', h3Named.length)
  console.log('h4 with name/id:', h4Named.length)
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect())
