const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const d = await p.legalDocument.findFirst({
    where: { document_number: { contains: '1977:1160' } },
    select: {
      id: true,
      title: true,
      document_number: true,
      slug: true,
      content_type: true,
      html_content: true,
      full_text: true,
    },
  })

  if (!d) {
    console.log('NOT FOUND')
    return
  }

  console.log('id:', d.id)
  console.log('type:', d.content_type)
  console.log('slug:', d.slug)
  console.log('title:', d.title)
  console.log('has html_content:', !!d.html_content)
  console.log('html_content length:', d.html_content?.length ?? 0)
  console.log('has full_text:', !!d.full_text)
  console.log('--- html_content preview (first 3000 chars) ---')
  console.log(d.html_content?.substring(0, 3000) ?? 'NULL')
}

main().catch(console.error).finally(() => p.$disconnect())
