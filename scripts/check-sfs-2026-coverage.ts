/* eslint-disable no-console */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { prisma } from '../lib/prisma'

const YEAR = '2026'

function ranges(nums: number[]): string {
  if (nums.length === 0) return '(none)'
  const s = [...nums].sort((a, b) => a - b)
  const out: string[] = []
  let start = s[0]
  let prev = s[0]
  for (let i = 1; i < s.length; i++) {
    if (s[i] === prev + 1) prev = s[i]
    else {
      out.push(start === prev ? `${start}` : `${start}-${prev}`)
      start = prev = s[i]
    }
  }
  out.push(start === prev ? `${start}` : `${start}-${prev}`)
  return out.join(', ')
}

async function setFrom(
  rows: { num: string }[],
  field: 'num'
): Promise<Set<number>> {
  const set = new Set<number>()
  for (const r of rows) {
    const m = r[field].match(/SFS\s+(\d{4}):(\d+)/)
    if (m && m[1] === YEAR) set.add(parseInt(m[2], 10))
  }
  return set
}

async function main() {
  console.log(`\n=== SFS ${YEAR} coverage by table ===\n`)

  const legal = await prisma.legalDocument.findMany({
    where: { document_number: { contains: `SFS ${YEAR}:` } },
    select: { document_number: true },
  })
  const legalSet = await setFrom(
    legal.map((d) => ({ num: d.document_number })),
    'num'
  )

  let amendSet = new Set<number>()
  try {
    const amend = await prisma.amendmentDocument.findMany({
      where: { sfs_number: { contains: `SFS ${YEAR}:` } },
      select: { sfs_number: true },
    })
    amendSet = await setFrom(
      amend.map((d) => ({ num: d.sfs_number })),
      'num'
    )
  } catch {
    /* table may not exist */
  }

  const union = new Set<number>([...legalSet, ...amendSet])

  const report = (label: string, set: Set<number>) => {
    const arr = [...set].sort((a, b) => a - b)
    const min = arr[0]
    const max = arr[arr.length - 1]
    const gaps: number[] = []
    if (min != null)
      for (let n = min; n <= max; n++) if (!set.has(n)) gaps.push(n)
    console.log(`${label}`)
    console.log(`  count ${set.size}, range ${min ?? '—'}–${max ?? '—'}`)
    console.log(`  internal gaps (${gaps.length}): ${ranges(gaps)}\n`)
    return { max, gaps }
  }

  const L = report('legal_documents (full content / RAG):', legalSet)
  report('amendment_documents (PDF crawler):', amendSet)
  report('UNION of both tables:', union)

  // What legal_documents is missing that amendment_documents has
  const inAmendNotLegal = [...amendSet]
    .filter((n) => !legalSet.has(n))
    .sort((a, b) => a - b)
  console.log(
    `In amendment_documents but NOT legal_documents (${inAmendNotLegal.length}):`
  )
  console.log(`  ${ranges(inAmendNotLegal)}\n`)

  // legal_documents gaps that are ALSO absent from amendment_documents (true total blanks)
  const trueBlanks = L.gaps.filter((n) => !amendSet.has(n))
  console.log(
    `legal_documents gaps absent from BOTH tables (total blanks): ${ranges(trueBlanks)}`
  )

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
