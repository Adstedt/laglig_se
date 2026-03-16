import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: { markdown_content: true, json_content: true },
  })
  if (!doc) {
    console.log('NOT FOUND')
    return
  }

  const md = doc.markdown_content ?? ''
  const json = JSON.stringify(doc.json_content)

  // Show markdown structure
  console.log('=== MARKDOWN (first 2000 chars) ===')
  console.log(md.substring(0, 2000))
  console.log('\n\n=== MARKDOWN (chapter 2 area, chars 3000-5000) ===')
  const ch2Start = md.indexOf('## 2 kap')
  if (ch2Start >= 0) {
    console.log(md.substring(ch2Start, ch2Start + 2000))
  } else {
    console.log('Could not find "## 2 kap" heading')
    // Try to find any chapter 2 marker
    const alt = md.indexOf('2 kap')
    if (alt >= 0) console.log(md.substring(alt, alt + 2000))
  }

  // Show JSON structure (just the keys and first chapter)
  console.log('\n\n=== JSON keys ===')
  const parsed = doc.json_content as any
  console.log('Top-level keys:', Object.keys(parsed))
  if (parsed.chapters?.length > 0) {
    const ch = parsed.chapters[0]
    console.log('\nFirst chapter keys:', Object.keys(ch))
    if (ch.paragrafer?.length > 0) {
      console.log('First paragraf keys:', Object.keys(ch.paragrafer[0]))
      console.log(
        'First paragraf content (first 300 chars):',
        ch.paragrafer[0].content?.substring(0, 300)
      )
      console.log(
        'First paragraf stycken count:',
        ch.paragrafer[0].stycken?.length
      )
      if (ch.paragrafer[0].stycken?.length > 0) {
        console.log(
          'First stycke:',
          JSON.stringify(ch.paragrafer[0].stycken[0]).substring(0, 300)
        )
      }
    }
  }

  console.log('\nHas transitionProvisions:', !!parsed.transitionProvisions)
  console.log('Has preamble:', !!parsed.preamble)
  console.log('Has appendices:', !!parsed.appendices)
  console.log('Chapters count:', parsed.chapters?.length)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
