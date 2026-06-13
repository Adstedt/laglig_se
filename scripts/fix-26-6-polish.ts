/* eslint-disable no-console */
// Story 26.6 Task 2 follow-up: assignees on MBL kravpunkter + junk-doc ARCHIVE
// (reversible — the styrdokument "aktiva" tab filters status !== ARCHIVED)
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })
// eslint-disable-next-line import/first
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const NORD = 'e4cd55b0-8b2c-4209-bd19-0b40f50f04f1'
const ANNA = '1389c227-6143-4ccb-b630-7d2b9f7b69b2'
const SOFIA = '54611138-8ef9-40ed-83da-1708e7d4bad0'
const ERIK = 'cb98cac2-5cf1-4ed3-9988-5eded193765e'

async function main() {
  const reqs = await prisma.lawListItemRequirement.findMany({
    where: { list_item_id: '765b0c7f-12cd-429f-b415-7b938ddb3cf0' },
    orderBy: { position: 'asc' },
  })
  const assignees = [SOFIA, ANNA, ERIK, SOFIA, null, SOFIA, ERIK, ANNA, null]
  for (let i = 0; i < reqs.length; i++) {
    const a = assignees[i] ?? null
    if (a) {
      await prisma.lawListItemRequirement.update({
        where: { id: reqs[i]!.id },
        data: { responsible_user_id: a },
      })
    }
  }
  console.log('assigned responsible users on MBL kravpunkter')

  // Archive (NOT delete) demo-workspace test artifacts so the styrdokument
  // hero shows a clean list. Reversible via status flip.
  const junkTitles = [
    'Test',
    'Test 5',
    'Test 55',
    'Test 555',
    'Test 5555',
    'Tomt dokument',
    'DEMO styrdokument — Approved för seal',
  ]
  const archived = await prisma.workspaceDocument.updateMany({
    where: { workspace_id: NORD, title: { in: junkTitles } },
    data: { status: 'ARCHIVED' },
  })
  console.log(`archived ${archived.count} junk test docs (reversible)`)
  const remaining = await prisma.workspaceDocument.findMany({
    where: { workspace_id: NORD, status: { not: 'ARCHIVED' } },
    select: { title: true, status: true, draft_status: true },
    orderBy: { updated_at: 'desc' },
  })
  console.log('\nactive docs:', remaining.length)
  for (const d of remaining)
    console.log(' ', d.status, d.draft_status ?? '', '|', d.title)
}
main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
