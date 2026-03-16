import { prisma } from '../lib/prisma'

async function main() {
  const docs = await prisma.legalDocument.findMany({
    where: {
      document_number: {
        in: [
          'SFS 2010:110',
          'SFS 1977:1160',
          'SFS 2008:567',
          'AFS 2023:10 kap. 11',
          'KIFS 2017:7',
        ],
      },
    },
    select: { document_number: true, slug: true, title: true },
  })
  for (const d of docs) {
    console.log(
      `${d.document_number} -> slug: "${d.slug}" -> title: ${d.title?.slice(0, 60)}`
    )
  }
  await prisma.$disconnect()
}
main()
