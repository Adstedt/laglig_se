import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findUnique({
    where: { document_number: 'SFS 1977:1160' },
    select: { json_content: true },
  })
  const json = doc?.json_content as any
  if (!json) {
    console.log('No json_content')
    return
  }

  // Save full JSON for inspection
  fs.writeFileSync(
    'data/sfs-1977-1160-json.json',
    JSON.stringify(json, null, 2)
  )
  console.log('Saved to data/sfs-1977-1160-json.json')

  // Structure overview
  console.log('\nTop keys:', Object.keys(json))
  console.log('Chapters:', json.chapters?.length)
  console.log('Divisions:', json.divisions?.length)
  console.log('Appendices:', json.appendices?.length)
  console.log('Transition:', json.transitionProvisions?.length)

  // Look at first chapter
  if (json.chapters?.length > 0) {
    const ch = json.chapters[0]
    console.log('\n=== CHAPTER 1 ===')
    console.log('Keys:', Object.keys(ch))
    console.log('Number:', ch.number)
    console.log('Title:', ch.title)
    console.log('Sections:', ch.sections?.length)

    // First section
    if (ch.sections?.length > 0) {
      const s = ch.sections[0]
      console.log('\n  --- Section 1 ---')
      console.log('  Keys:', Object.keys(s))
      console.log('  Number:', s.number)
      console.log('  Content:', (s.content || '').substring(0, 200))
      console.log('  Paragraphs:', s.paragraphs?.length)
      if (s.paragraphs?.length > 0) {
        console.log(
          '  P1:',
          (s.paragraphs[0].content || s.paragraphs[0].text || '').substring(
            0,
            200
          )
        )
      }
    }

    // Second section
    if (ch.sections?.length > 1) {
      const s = ch.sections[1]
      console.log('\n  --- Section 2 ---')
      console.log('  Keys:', Object.keys(s))
      console.log('  Number:', s.number)
      console.log('  Content:', (s.content || '').substring(0, 200))
    }
  }

  // Chapter 3 for more variety
  if (json.chapters?.length >= 3) {
    const ch = json.chapters[2]
    console.log('\n=== CHAPTER 3 ===')
    console.log('Number:', ch.number)
    console.log('Title:', ch.title)
    console.log('Sections:', ch.sections?.length)
    if (ch.sections?.length > 0) {
      const s = ch.sections[0]
      console.log('  S1 number:', s.number)
      console.log('  S1 content:', (s.content || '').substring(0, 200))
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
