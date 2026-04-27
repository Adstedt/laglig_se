import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const CYCLE_ID = 'cbc3bd86-5964-434d-8d04-9325c5c59f1a'

  const cycle = await prisma.complianceAuditCycle.findUnique({
    where: { id: CYCLE_ID },
    select: {
      id: true,
      name: true,
      status: true,
      seal_hash: true,
      sealed_at: true,
      sealed_by_user_id: true,
    },
  })
  console.log('CYCLE:', cycle)

  const activityLog = await prisma.activityLog.findFirst({
    where: { entity_id: CYCLE_ID, action: 'cycle_sealed' },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      action: true,
      old_value: true,
      new_value: true,
      user_id: true,
      created_at: true,
    },
  })
  console.log('\nACTIVITY LOG cycle_sealed row:')
  console.log(JSON.stringify(activityLog, null, 2))

  const report = await prisma.complianceAuditReport.findFirst({
    where: { cycle_id: CYCLE_ID, report_kind: 'SEALED' },
    select: { id: true, report_kind: true, generated_at: true, manifest: true },
  })
  console.log('\nSEALED REPORT ROW (manifest truncated to relevant parts):')
  if (report?.manifest && typeof report.manifest === 'object') {
    const m = report.manifest as Record<string, unknown>
    console.log({
      id: report.id,
      report_kind: report.report_kind,
      generated_at: report.generated_at,
      manifest_sealHash: m.sealHash,
      manifest_overrideReason: m.overrideReason,
      manifest_draftDocumentsAtSeal: m.draftDocumentsAtSeal,
      manifest_openAvvikelsesAtSeal: m.openAvvikelsesAtSeal,
    })
  } else {
    console.log(report)
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
