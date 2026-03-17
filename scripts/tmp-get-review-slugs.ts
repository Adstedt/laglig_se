import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const targets = [
    'SFS 2024:7',
    'SFS 2024:1085',
    'SFS 2024:506',
    'SFS 2024:945',
    'SFS 2024:710',
    'SFS 1999:1229',
    'SFS 1999:1079',
    'SFS 2000:1225',
    'SFS 1980:1021',
    'SFS 2000:592',
  ]

  const docs = await prisma.legalDocument.findMany({
    where: { document_number: { in: targets } },
    select: { document_number: true, slug: true, title: true },
  })

  // Sort by target order
  for (const t of targets) {
    const d = docs.find((x) => x.document_number === t)
    if (d) {
      console.log(`/lagar/${d.slug}`)
      console.log(
        `  ${d.document_number} — ${(d.title || '').substring(0, 70)}`
      )
      console.log()
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
