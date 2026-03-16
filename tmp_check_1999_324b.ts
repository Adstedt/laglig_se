import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  const doc = await p.legalDocument.findUnique({
    where: { document_number: 'SFS 1999:324' },
    select: { json_content: true },
  })
  const json = doc!.json_content as any

  console.log('=== Old schema structure ===')
  console.log(`Top keys: ${Object.keys(json).join(', ')}`)
  console.log(`\nsections: ${json.sections?.length ?? 0}`)

  if (json.sections) {
    for (const s of json.sections.slice(0, 5)) {
      console.log(`\n  Section keys: ${Object.keys(s).join(', ')}`)
      console.log(`  number: ${s.number}`)
      console.log(`  title: ${s.title}`)
      console.log(`  content: ${String(s.content ?? '').substring(0, 200)}`)
      if (s.paragraphs) {
        console.log(`  paragraphs: ${s.paragraphs.length}`)
        for (const para of s.paragraphs.slice(0, 2)) {
          console.log(`    para keys: ${Object.keys(para).join(', ')}`)
          console.log(
            `    text: ${String(para.text ?? para.content ?? '').substring(0, 150)}`
          )
        }
      }
    }
  }

  console.log(`\ntransitionProvisions:`)
  console.log(JSON.stringify(json.transitionProvisions, null, 2))

  console.log(`\nmetadata:`)
  console.log(JSON.stringify(json.metadata, null, 2))

  await p.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
