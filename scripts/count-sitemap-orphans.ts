import { PrismaClient, ContentType } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

/**
 * Mirror of app/sitemap.ts `getUrlPath` so this script can verify the post-fix
 * routing without importing the route file (which pulls Next-only deps).
 * Keep in sync with app/sitemap.ts.
 */
function getUrlPath(contentType: ContentType, slug: string): string | null {
  switch (contentType) {
    case ContentType.SFS_LAW:
      return `/lagar/${slug}`
    case ContentType.SFS_AMENDMENT:
      return `/lagar/andringar/${slug}`
    case ContentType.AGENCY_REGULATION:
      return `/foreskrifter/${slug}`
    case ContentType.EU_REGULATION:
      return `/eu/forordningar/${slug}`
    case ContentType.EU_DIRECTIVE:
      return `/eu/direktiv/${slug}`
    case ContentType.COURT_CASE_AD:
    case ContentType.COURT_CASE_HD:
    case ContentType.COURT_CASE_HOVR:
    case ContentType.COURT_CASE_HFD:
    case ContentType.COURT_CASE_MOD:
    case ContentType.COURT_CASE_MIG:
      return null
    default:
      return null
  }
}

const REPORTED_SLUGS_AND_EXPECTED_PREFIXES: Array<[string, string]> = [
  ['lag-om-andring-i-lagen-om-bostadsbidrag-2004-477', '/lagar/andringar/'],
  ['lag-om-andring-i-rattegangsbalken-2015-684', '/lagar/andringar/'],
  [
    'lag-om-andring-i-forordningen-om-miljokonsekvensbeskrivningar-2008-691',
    '/lagar/andringar/',
  ],
  ['ssmfs-2018-4', '/foreskrifter/'],
  ['msbfs-2011-4', '/foreskrifter/'],
  ['afs-2023-15-kap-8', '/foreskrifter/'],
]

async function main() {
  const counts = await prisma.legalDocument.groupBy({
    by: ['content_type'],
    where: { status: 'ACTIVE' },
    _count: { _all: true },
    orderBy: [{ content_type: 'asc' }],
  })
  console.log('ACTIVE LegalDocument counts by content_type:')
  console.log(JSON.stringify(counts, null, 2))

  const slugs = REPORTED_SLUGS_AND_EXPECTED_PREFIXES.map(([s]) => s)
  const rows = await prisma.legalDocument.findMany({
    where: { slug: { in: slugs } },
    select: {
      slug: true,
      content_type: true,
      status: true,
      document_number: true,
    },
  })
  const bySlug = new Map(rows.map((r) => [r.slug, r]))

  console.log('\nReported-slug routing assertion:')
  let failures = 0
  for (const [slug, expectedPrefix] of REPORTED_SLUGS_AND_EXPECTED_PREFIXES) {
    const row = bySlug.get(slug)
    if (!row) {
      console.log(`  ✗ ${slug}  →  NOT FOUND in DB`)
      failures++
      continue
    }
    const actual = getUrlPath(row.content_type, row.slug)
    const ok = actual !== null && actual.startsWith(expectedPrefix)
    console.log(
      `  ${ok ? '✓' : '✗'} ${slug}  →  ${actual ?? '(null)'}  [expected prefix ${expectedPrefix}, content_type=${row.content_type}]`
    )
    if (!ok) failures++
  }

  // Smoke check: pick 1 sample slug per non-court-case content type and confirm
  // getUrlPath produces a non-null route. Court cases intentionally return null
  // (no public route yet).
  console.log('\nPer-content-type smoke check (1 sample each):')
  const liveTypes = [
    ContentType.SFS_LAW,
    ContentType.SFS_AMENDMENT,
    ContentType.AGENCY_REGULATION,
    ContentType.EU_REGULATION,
    ContentType.EU_DIRECTIVE,
  ]
  for (const t of liveTypes) {
    const sample = await prisma.legalDocument.findFirst({
      where: { content_type: t, status: 'ACTIVE' },
      select: { slug: true, content_type: true },
    })
    if (!sample) {
      console.log(`  - ${t}: no ACTIVE rows`)
      continue
    }
    const path = getUrlPath(sample.content_type, sample.slug)
    const ok = path !== null
    console.log(
      `  ${ok ? '✓' : '✗'} ${t}  →  ${path ?? '(null)'}  (slug: ${sample.slug})`
    )
    if (!ok) failures++
  }

  console.log(
    `\n${failures === 0 ? '✓ All routing assertions passed' : `✗ ${failures} failure(s)`}`
  )
  await prisma.$disconnect()
  if (failures > 0) process.exit(1)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
