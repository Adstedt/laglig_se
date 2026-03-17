import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  // Check how many SFS_LAW docs have latestAmendment in metadata
  // We need to batch since there are ~11K docs
  let skip = 0,
    take = 500
  let total = 0,
    withLatestAmendment = 0,
    withSystemdatum = 0
  const amendmentYears: Record<string, number> = {}
  const samplesWith: any[] = []
  const samplesWithout: any[] = []

  while (true) {
    const batch = await p.legalDocument.findMany({
      where: { content_type: 'SFS_LAW' },
      select: { document_number: true, metadata: true, updated_at: true },
      skip,
      take,
    })
    if (batch.length === 0) break

    for (const doc of batch) {
      total++
      const meta = doc.metadata as any
      if (!meta) continue

      if (meta.systemdatum) withSystemdatum++

      if (meta.latestAmendment) {
        withLatestAmendment++
        // Extract year from latestAmendment like "SFS 2025:732"
        const yearMatch = meta.latestAmendment.match(/(\d{4})/)
        if (yearMatch) {
          const y = yearMatch[1]
          amendmentYears[y] = (amendmentYears[y] || 0) + 1
        }
        if (samplesWith.length < 5) {
          samplesWith.push({
            dn: doc.document_number,
            la: meta.latestAmendment,
            sd: meta.systemdatum,
          })
        }
      } else {
        if (samplesWithout.length < 5 && meta.systemdatum) {
          samplesWithout.push({
            dn: doc.document_number,
            sd: meta.systemdatum,
            metaKeys: Object.keys(meta),
          })
        }
      }
    }
    skip += take
  }

  console.log(`\n=== SFS_LAW undertitel/latestAmendment availability ===`)
  console.log(`Total SFS_LAW docs: ${total}`)
  console.log(`With systemdatum: ${withSystemdatum}`)
  console.log(`With latestAmendment: ${withLatestAmendment}`)
  console.log(`Without latestAmendment: ${total - withLatestAmendment}`)
  console.log(`\nAmendment years distribution:`)
  for (const [y, c] of Object.entries(amendmentYears).sort()) {
    console.log(`  ${y}: ${c} laws`)
  }

  console.log(`\nSamples WITH latestAmendment:`)
  for (const s of samplesWith)
    console.log(`  ${s.dn} → ${s.la} (systemdatum: ${s.sd})`)

  console.log(`\nSamples WITHOUT latestAmendment (but has systemdatum):`)
  for (const s of samplesWithout)
    console.log(`  ${s.dn} — keys: ${s.metaKeys.join(', ')}`)

  // Also check: how many amendments have base_law_sfs linking?
  console.log(`\n\n=== Amendment → Base Law linking ===`)
  const totalAmendments = await p.legalDocument.count({
    where: { content_type: 'SFS_AMENDMENT' },
  })

  // Sample some amendments to check metadata structure
  let aSkip = 0,
    withBaseLaw = 0,
    totalA = 0
  while (true) {
    const batch = await p.legalDocument.findMany({
      where: { content_type: 'SFS_AMENDMENT' },
      select: { document_number: true, metadata: true },
      skip: aSkip,
      take: 500,
    })
    if (batch.length === 0) break
    for (const a of batch) {
      totalA++
      const meta = a.metadata as any
      if (meta?.base_law_sfs) withBaseLaw++
    }
    aSkip += 500
  }

  console.log(`Total SFS_AMENDMENT docs: ${totalA}`)
  console.log(`With base_law_sfs: ${withBaseLaw}`)
  console.log(`Without base_law_sfs: ${totalA - withBaseLaw}`)

  await p.$disconnect()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
