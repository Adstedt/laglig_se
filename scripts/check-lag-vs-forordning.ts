import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_AMENDMENT', html_content: { not: null } },
    select: { document_number: true, title: true, html_content: true }
  })

  let lagar = 0
  let forordningar = 0
  let other = 0
  let lagarWithRefs = 0
  let lagarWithoutRefs = 0

  for (const doc of docs) {
    const title = (doc.title || '').toLowerCase()
    const html = doc.html_content || ''

    const hasRefs = /[Pp]rop\.\s*\d{4}\/\d{2,4}:\d+/.test(html)

    if (title.includes('lag (') || title.includes('lag om')) {
      lagar++
      if (hasRefs) lagarWithRefs++
      else lagarWithoutRefs++
    } else if (title.includes('förordning')) {
      forordningar++
    } else {
      other++
    }
  }

  console.log('Amendment types in 109 test docs:')
  console.log('  Lagar (laws):', lagar)
  console.log('    - with prop/bet/rskr:', lagarWithRefs)
  console.log('    - WITHOUT prop/bet/rskr:', lagarWithoutRefs)
  console.log('  Förordningar (regulations):', forordningar)
  console.log('  Other:', other)

  // Show examples of lagar without refs
  if (lagarWithoutRefs > 0) {
    console.log('\n--- Lagar WITHOUT refs (investigate): ---')
    for (const doc of docs) {
      const title = (doc.title || '').toLowerCase()
      const html = doc.html_content || ''
      const hasRefs = /[Pp]rop\.\s*\d{4}\/\d{2,4}:\d+/.test(html)

      if ((title.includes('lag (') || title.includes('lag om')) && !hasRefs) {
        console.log(doc.document_number, '-', doc.title?.substring(0, 60))
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
