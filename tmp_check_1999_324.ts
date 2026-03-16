import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  const doc = await p.legalDocument.findUnique({
    where: { document_number: 'SFS 1999:324' },
    select: {
      document_number: true,
      title: true,
      content_type: true,
      html_content: true,
      json_content: true,
      markdown_content: true,
      updated_at: true,
    },
  })

  if (!doc) {
    console.log('Not found')
    return
  }

  console.log(`Title: ${doc.title}`)
  console.log(`Type: ${doc.content_type}`)
  console.log(`Updated: ${doc.updated_at}`)
  console.log(`HTML: ${doc.html_content?.length ?? 0} chars`)
  console.log(`Markdown: ${doc.markdown_content?.length ?? 0} chars`)

  const json = doc.json_content as any
  if (!json) {
    console.log('JSON: null')
    return
  }

  console.log(`\nJSON keys: ${Object.keys(json).join(', ')}`)
  console.log(`schemaVersion: ${json.schemaVersion}`)
  console.log(`chapters: ${json.chapters?.length ?? 0}`)

  let totalPara = 0
  for (const ch of json.chapters ?? []) {
    const pCount = ch.paragrafer?.length ?? 0
    totalPara += pCount
    if (pCount > 0) {
      console.log(
        `  Kap ${ch.number}: ${ch.title ?? '(no title)'} — ${pCount} paragrafer`
      )
    }
  }
  console.log(`Total paragrafer: ${totalPara}`)

  if (json.transitionProvisions)
    console.log(
      `transitionProvisions: ${json.transitionProvisions.length} stycken`
    )
  if (json.preamble) console.log(`preamble: present`)
  if (json.appendices) console.log(`appendices: ${json.appendices.length}`)

  // Show first 500 chars of HTML
  console.log(`\n--- HTML (first 500 chars) ---`)
  console.log(doc.html_content?.substring(0, 500))

  await p.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
