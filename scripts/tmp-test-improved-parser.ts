import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findUnique({
    where: { document_number: 'SFS 1977:1160' },
    select: { html_content: true, document_number: true },
  })
  if (!doc?.html_content) {
    console.log('No html_content found')
    return
  }

  const newJson = parseCanonicalHtml(doc.html_content, {
    sfsNumber: 'SFS 1977:1160',
    documentType: 'SFS_LAW',
  })

  fs.writeFileSync(
    'data/sfs-1977-1160-json-improved.json',
    JSON.stringify(newJson, null, 2)
  )
  console.log('Saved to data/sfs-1977-1160-json-improved.json')

  console.log('\n=== STRUCTURE ===')
  console.log('Chapters:', newJson.chapters.length)

  const ch1 = newJson.chapters[0]
  if (ch1) {
    console.log(`\n=== ${ch1.number} kap. ${ch1.title} ===`)
    console.log('Paragrafer:', ch1.paragrafer.length)

    for (const p of ch1.paragrafer.slice(0, 5)) {
      console.log(`\n  --- ${p.number} § ---`)
      console.log(`  amendedBy: ${p.amendedBy}`)
      console.log(`  content (200): ${p.content.substring(0, 200)}`)
      console.log(`  stycken: ${p.stycken.length}`)
      for (const s of p.stycken.slice(0, 4)) {
        console.log(`    [${s.role}] #${s.number}: ${s.text.substring(0, 120)}`)
      }
    }
  }

  const ch3 = newJson.chapters[2]
  if (ch3) {
    console.log(`\n=== ${ch3.number} kap. ${ch3.title} ===`)
    for (const p of ch3.paragrafer.slice(0, 3)) {
      console.log(`\n  --- ${p.number} § ---`)
      console.log(`  amendedBy: ${p.amendedBy}`)
      for (const s of p.stycken) {
        console.log(`    [${s.role}] #${s.number}: ${s.text.substring(0, 120)}`)
      }
    }
  }

  let totalP = 0,
    withAmended = 0,
    listItems = 0,
    numberedS = 0
  for (const ch of newJson.chapters) {
    for (const p of ch.paragrafer) {
      totalP++
      if (p.amendedBy) withAmended++
      for (const s of p.stycken) {
        if (s.role === 'LIST_ITEM') listItems++
        if (s.role === 'STYCKE' && s.number !== null) numberedS++
      }
    }
  }
  console.log('\n=== STATS ===')
  console.log(`Paragrafer: ${totalP}`)
  console.log(`With amendedBy: ${withAmended}`)
  console.log(`List items: ${listItems}`)
  console.log(`Numbered stycken: ${numberedS}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
