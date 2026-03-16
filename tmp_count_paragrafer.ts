import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function countType(type: string) {
  let skip = 0,
    take = 500,
    totalDocs = 0,
    totalPara = 0,
    emptyDocs = 0
  while (true) {
    const batch = await p.legalDocument.findMany({
      where: { content_type: type as any, json_content: { not: null } },
      select: { json_content: true },
      skip,
      take,
    })
    if (batch.length === 0) break
    for (const doc of batch) {
      totalDocs++
      const json = doc.json_content as any
      if (!json?.chapters) {
        emptyDocs++
        continue
      }
      let count = 0
      for (const ch of json.chapters) count += ch.paragrafer?.length ?? 0
      if (count === 0) emptyDocs++
      totalPara += count
    }
    skip += take
  }
  return { totalDocs, totalPara, emptyDocs }
}

async function main() {
  for (const type of ['SFS_AMENDMENT', 'AGENCY_REGULATION']) {
    const s = await countType(type)
    console.log(`\n${type}:`)
    console.log(`  Docs with json_content: ${s.totalDocs}`)
    console.log(`  Docs with 0 paragrafer: ${s.emptyDocs}`)
    console.log(`  Total paragrafer: ${s.totalPara}`)
    if (s.totalDocs - s.emptyDocs > 0)
      console.log(
        `  Avg §§ per doc (non-empty): ${(s.totalPara / (s.totalDocs - s.emptyDocs)).toFixed(1)}`
      )
  }
  await p.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
