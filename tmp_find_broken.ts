import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find all SFS laws that have the article wrapper but are missing paragraph structure
  const docs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'SFS_LAW',
      html_content: {
        contains: '<article class="legal-document"',
      },
    },
    select: {
      id: true,
      document_number: true,
      title: true,
      html_content: true,
    },
  })

  console.log(`Total SFS laws with canonical wrapper: ${docs.length}`)

  const broken: {
    num: string
    title: string
    hasParagraph: boolean
    hasSection: boolean
    contentLen: number
  }[] = []

  for (const doc of docs) {
    const html = doc.html_content || ''
    const hasParagraphClass = html.includes('class="paragraph"')
    const hasH3Paragraph = html.includes('<h3 class="paragraph">')
    const hasParagrafSign = html.includes('§')

    // Broken = has § in text content but no class="paragraph" headings
    if (hasParagrafSign && !hasParagraphClass) {
      broken.push({
        num: doc.document_number,
        title: doc.title.substring(0, 60),
        hasParagraph: hasH3Paragraph,
        hasSection: html.includes('<h3 id="'),
        contentLen: html.length,
      })
    }
  }

  console.log(
    `\nBroken (has § text but no class="paragraph" structure): ${broken.length}`
  )
  console.log('')
  for (const b of broken) {
    console.log(`  ${b.num.padEnd(16)} ${b.title}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
