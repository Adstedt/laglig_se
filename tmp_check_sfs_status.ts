import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const docs = await p.legalDocument.findMany({
    where: {
      content_type: 'SFS_AMENDMENT',
      document_number: { startsWith: 'SFS 2026:' },
    },
    select: { document_number: true, json_content: true, html_content: true },
  })

  let emptyJson = 0
  let goodJson = 0
  const emptyList: string[] = []

  for (const doc of docs) {
    const json = doc.json_content as any
    if (!json) {
      emptyJson++
      emptyList.push(doc.document_number + ' (no JSON)')
      continue
    }

    const totalParas =
      json.chapters?.reduce(
        (sum: number, k: any) => sum + (k.paragrafer?.length ?? 0),
        0
      ) ?? 0
    if (totalParas === 0) {
      emptyJson++
      // Check if HTML has paragraf sections
      const hasParagrafSections =
        doc.html_content?.includes('class="paragraf"') ?? false
      emptyList.push(
        `${doc.document_number} (0 paragrafer, html: ${doc.html_content?.length ?? 0} chars, has §sections: ${hasParagrafSections})`
      )
    } else {
      goodJson++
    }
  }

  console.log(`Total 2026 amendments: ${docs.length}`)
  console.log(`Good JSON (has paragrafer): ${goodJson}`)
  console.log(`Empty JSON (0 paragrafer): ${emptyJson}`)
  console.log(`\nEmpty ones:`)
  emptyList.forEach((e) => console.log(`  ${e}`))

  await p.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
