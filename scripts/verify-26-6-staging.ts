/* eslint-disable no-console */
// Post-staging verification for Story 26.6 Task 2.
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
// eslint-disable-next-line import/first
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const almasaTitles = await prisma.workspaceDocument.count({
    where: { title: { contains: 'Almåsa', mode: 'insensitive' } },
  })
  const almasaContent = await prisma.workspaceDocumentVersion.count({
    where: {
      OR: [
        { content_html: { contains: 'Almåsa', mode: 'insensitive' } },
        { extracted_text: { contains: 'Almåsa', mode: 'insensitive' } },
      ],
    },
  })
  console.log(
    `Almåsa: titles=${almasaTitles} contentVersions=${almasaContent} (must be 0/0)`
  )
  const nord = 'e4cd55b0-8b2c-4209-bd19-0b40f50f04f1'
  const tasks = await prisma.task.groupBy({
    by: ['priority'],
    where: { workspace_id: nord },
    _count: true,
  })
  const overdue = await prisma.task.count({
    where: {
      workspace_id: nord,
      due_date: { lt: new Date() },
      completed_at: null,
    },
  })
  console.log(
    'Nordviken tasks by priority:',
    JSON.stringify(tasks),
    'overdue:',
    overdue
  )
  const psl = await prisma.lawListItem.findFirst({
    where: {
      law_list: { workspace_id: '35b08947-57ec-4773-ac53-b138edded1e8' },
      document: { document_number: 'SFS 2010:659' },
    },
    select: {
      requirements: {
        select: {
          is_fulfilled: true,
          bevis_required: true,
          _count: { select: { evidence_links: true } },
        },
      },
    },
  })
  const f = psl!.requirements.filter((r) => r.is_fulfilled).length
  console.log(
    `Vitnäset PSL: ${psl!.requirements.length} kravpunkter, ${f} uppfyllda, evidence-linked: ${psl!.requirements.filter((r) => r._count.evidence_links > 0).length}`
  )
  const ca = await prisma.changeAssessment.groupBy({
    by: ['status'],
    where: { workspace_id: '673fbcaa-bc0c-4bf8-b45e-33e9ce73ea3e' },
    _count: true,
  })
  console.log('Tärnudden assessments:', JSON.stringify(ca))
}
main().finally(() => prisma.$disconnect())
