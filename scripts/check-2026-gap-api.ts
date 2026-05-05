/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function main() {
  // 1) Show publication dates of docs adjacent to the gap
  const adjacent = await prisma.legalDocument.findMany({
    where: {
      document_number: {
        in: [
          'SFS 2026:407',
          'SFS 2026:408',
          'SFS 2026:409',
          'SFS 2026:440',
          'SFS 2026:443',
        ],
      },
    },
    select: {
      document_number: true,
      content_type: true,
      title: true,
      publication_date: true,
      effective_date: true,
      created_at: true,
      updated_at: true,
    },
    orderBy: { document_number: 'asc' },
  })

  console.log('Adjacent docs (publication + ingest dates):\n')
  for (const d of adjacent) {
    console.log(
      `  ${d.document_number} | ${d.content_type.padEnd(15)} | publ ${d.publication_date?.toISOString().slice(0, 10) ?? '—'} | ingested ${d.created_at.toISOString().slice(0, 16)}`
    )
  }

  // 2) Hit Riksdagen API for 3 sample numbers from the gap
  const samples = ['2026:415', '2026:425', '2026:435', '2026:441', '2026:442']
  console.log(`\n\nRiksdagen API check for ${samples.length} sample numbers:\n`)

  for (const bet of samples) {
    const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=5&sok=${encodeURIComponent(bet)}`
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Laglig.se/1.0' },
      })
      if (!res.ok) {
        console.log(`  SFS ${bet} | HTTP ${res.status}`)
        continue
      }
      const data: any = await res.json()
      const docs = data.dokumentlista?.dokument || []
      const match = docs.find((d: any) => d.beteckning === bet)
      if (!match) {
        console.log(
          `  SFS ${bet} | ❌ not found in Riksdagen API (returned ${docs.length} other matches)`
        )
        continue
      }
      console.log(
        `  SFS ${bet} | ✅ "${(match.titel ?? '').slice(0, 60)}" | publ ${match.publicerad} | system ${match.systemdatum}`
      )
    } catch (e) {
      console.log(`  SFS ${bet} | error: ${(e as Error).message}`)
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
