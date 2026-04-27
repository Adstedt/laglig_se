import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
prisma.complianceAuditCycle
  .findMany({
    where: {
      workspace: { slug: 'almasa-havshotell-ab-fvarlj' },
      deleted_at: null,
    },
    select: {
      id: true,
      name: true,
      status: true,
      sealed_at: true,
      seal_hash: true,
    },
    orderBy: { created_at: 'desc' },
  })
  .then((rows) => {
    console.table(
      rows.map((r) => ({
        name: r.name,
        status: r.status,
        sealed: r.sealed_at ? 'yes' : 'no',
        hashPrefix: r.seal_hash?.slice(0, 12) ?? null,
      }))
    )
    process.exit(0)
  })
