/**
 * Story 24.3 AC 17: generate the matcher benchmark fixture.
 *
 * Pulls real LegalDocument rows from the live catalog and produces the
 * 50+ row mandatory series mix:
 *   - 30+ SFS rows
 *   - 5–7 AFS rows
 *   - 3–5 EU rows
 *   - 2–3 other-agency rows
 *   - 3–5 deliberate negatives (rows that should land UNMATCHED)
 *   - 2–3 prefix-mismatch tier-2 cases (year:number with wrong/missing prefix)
 *
 * Run: pnpm tsx scripts/generate-matcher-benchmark.ts
 *
 * Output: tests/fixtures/import/matcher-benchmark.json
 */

import { prisma } from '@/lib/prisma'
import { writeFile } from 'fs/promises'
import { join } from 'path'

interface BenchmarkRow {
  /** What the user pastes into their import. */
  source_titel: string | null
  source_sfs_nummer: string | null
  /** Expected match outcome. */
  expected_document_id: string | null
  expected_tier: 'high' | 'medium' | 'unmatched'
  /** Tag for per-series sub-assertions. */
  series: 'SFS' | 'AFS' | 'EU' | 'OTHER_AGENCY' | 'NEGATIVE' | 'PREFIX_MISMATCH'
  /** Notes for the human reading the fixture. */
  note?: string
}

const OUTPUT = join(
  process.cwd(),
  'tests',
  'fixtures',
  'import',
  'matcher-benchmark.json'
)

async function main() {
  const benchmark: BenchmarkRow[] = []

  // ============================================================================
  // SFS — 30 rows. Pull a mix of laws + amendments and use the canonical
  // document_number/title pair as the expected match.
  // ============================================================================
  const sfs = await prisma.legalDocument.findMany({
    where: {
      content_type: { in: ['SFS_LAW', 'SFS_AMENDMENT'] },
      document_number: { startsWith: 'SFS ' },
    },
    select: { id: true, title: true, document_number: true },
    take: 30,
    orderBy: { id: 'asc' },
  })
  for (const row of sfs) {
    benchmark.push({
      source_titel: row.title,
      source_sfs_nummer: row.document_number,
      expected_document_id: row.id,
      expected_tier: 'high',
      series: 'SFS',
    })
  }

  // ============================================================================
  // AFS — 6 rows. Real AFS regulations. Filter out chapter-sliced rows
  // ("AFS 2023:15 kap. 8") because they share the same parent canonical and
  // the matcher legitimately can't tell them apart on title alone.
  // ============================================================================
  const afs = await prisma.legalDocument.findMany({
    where: {
      content_type: 'AGENCY_REGULATION',
      document_number: { startsWith: 'AFS ' },
      NOT: { document_number: { contains: ' kap.' } },
    },
    select: { id: true, title: true, document_number: true },
    take: 6,
    orderBy: { id: 'asc' },
  })
  for (const row of afs) {
    benchmark.push({
      source_titel: row.title,
      source_sfs_nummer: row.document_number,
      expected_document_id: row.id,
      expected_tier: 'high',
      series: 'AFS',
    })
  }

  // ============================================================================
  // EU — 4 rows. Mix of regulation + directive forms (catalog dual-storage).
  // ============================================================================
  const euReg = await prisma.legalDocument.findMany({
    where: { content_type: 'EU_REGULATION' },
    select: { id: true, title: true, document_number: true },
    take: 2,
    orderBy: { id: 'asc' },
  })
  const euDir = await prisma.legalDocument.findMany({
    where: { content_type: 'EU_DIRECTIVE' },
    select: { id: true, title: true, document_number: true },
    take: 2,
    orderBy: { id: 'asc' },
  })
  for (const row of [...euReg, ...euDir]) {
    benchmark.push({
      source_titel: row.title,
      source_sfs_nummer: row.document_number,
      expected_document_id: row.id,
      expected_tier: 'high',
      series: 'EU',
    })
  }

  // ============================================================================
  // Other agency — 3 rows from non-AFS prefixes (MSBFS, BFS, ELSÄK-FS, etc.).
  // ============================================================================
  const otherAgency = await prisma.legalDocument.findMany({
    where: {
      content_type: 'AGENCY_REGULATION',
      AND: [
        { document_number: { not: { startsWith: 'AFS ' } } },
        { NOT: { document_number: { contains: ' kap.' } } },
      ],
    },
    select: { id: true, title: true, document_number: true },
    take: 3,
    orderBy: { id: 'asc' },
  })
  for (const row of otherAgency) {
    benchmark.push({
      source_titel: row.title,
      source_sfs_nummer: row.document_number,
      expected_document_id: row.id,
      expected_tier: 'high',
      series: 'OTHER_AGENCY',
    })
  }

  // ============================================================================
  // Negatives — 4 rows that should NOT match anything in the catalog.
  // ============================================================================
  benchmark.push(
    {
      source_titel: 'Personuppgiftslagen från 1973 i Sverige',
      source_sfs_nummer: null,
      expected_document_id: null,
      expected_tier: 'unmatched',
      series: 'NEGATIVE',
      note: 'Outdated repealed law; not in current catalog',
    },
    {
      source_titel: 'Internal company brand guidelines v3',
      source_sfs_nummer: null,
      expected_document_id: null,
      expected_tier: 'unmatched',
      series: 'NEGATIVE',
      note: 'Not lagstiftning at all',
    },
    {
      source_titel: 'Helt påhittat namn på en lag som inte existerar',
      source_sfs_nummer: 'XYZ 9999:1',
      expected_document_id: null,
      expected_tier: 'unmatched',
      series: 'NEGATIVE',
      note: 'Synthetic prefix + far-future year',
    },
    {
      source_titel: '',
      source_sfs_nummer: null,
      expected_document_id: null,
      expected_tier: 'unmatched',
      series: 'NEGATIVE',
      note: 'Empty source',
    }
  )

  // ============================================================================
  // Prefix-mismatch — 3 rows where the user wrote year:number without a
  // prefix (or with a wrong prefix that does NOT collide with a real
  // catalog row). Tier-2 suffix-match should rescue.
  // ============================================================================
  if (afs.length >= 2 && otherAgency.length >= 1) {
    const stripPrefix = (s: string) => s.replace(/^[A-ZÅÄÖ][A-ZÅÄÖ\-]+\s+/, '')

    // Helper: pick a wrong prefix that does NOT have a real catalog row at
    // the same year:number tail. If the user writes "SFS X:Y" and a real
    // SFS X:Y exists (different agency entirely), the matcher legitimately
    // returns the SFS doc — the input is genuinely ambiguous, not a
    // matcher defect. Filter those rows out so the benchmark exercises only
    // unambiguous suffix-match cases.
    async function findUncollidingWrongPrefix(
      sourceDocNumber: string
    ): Promise<string | null> {
      const tail = stripPrefix(sourceDocNumber)
      const candidatePrefixes = ['SFS', 'NFS', 'BFS', 'MSBFS', 'TSFS']
      for (const prefix of candidatePrefixes) {
        const wrongCanonical = `${prefix} ${tail}`
        if (wrongCanonical === sourceDocNumber) continue
        const collision = await prisma.legalDocument.findFirst({
          where: { document_number: wrongCanonical },
          select: { id: true },
        })
        if (!collision) return wrongCanonical
      }
      return null
    }

    benchmark.push({
      source_titel: afs[0]!.title,
      source_sfs_nummer: stripPrefix(afs[0]!.document_number), // bare YYYY:NNN
      expected_document_id: afs[0]!.id,
      expected_tier: 'medium', // tier-2 fallback target
      series: 'PREFIX_MISMATCH',
      note: 'AFS row with prefix stripped — should land MEDIUM via suffix match',
    })

    const wrongPrefixed = await findUncollidingWrongPrefix(
      afs[1]!.document_number
    )
    if (wrongPrefixed) {
      benchmark.push({
        source_titel: afs[1]!.title,
        source_sfs_nummer: wrongPrefixed,
        expected_document_id: afs[1]!.id,
        expected_tier: 'medium',
        series: 'PREFIX_MISMATCH',
        note: `AFS row written with non-colliding wrong prefix (${wrongPrefixed.split(' ')[0]}) — suffix match should rescue`,
      })
    } else {
      // Fallback: use bare prefix-stripped form for this row too.
      benchmark.push({
        source_titel: afs[1]!.title,
        source_sfs_nummer: stripPrefix(afs[1]!.document_number),
        expected_document_id: afs[1]!.id,
        expected_tier: 'medium',
        series: 'PREFIX_MISMATCH',
        note: 'AFS row with prefix stripped (no non-colliding wrong-prefix candidate found)',
      })
    }

    benchmark.push({
      source_titel: otherAgency[0]!.title,
      source_sfs_nummer: stripPrefix(otherAgency[0]!.document_number),
      expected_document_id: otherAgency[0]!.id,
      expected_tier: 'medium',
      series: 'PREFIX_MISMATCH',
      note: 'Other-agency row with prefix stripped',
    })
  }

  // ============================================================================
  // Write fixture
  // ============================================================================
  await writeFile(OUTPUT, JSON.stringify(benchmark, null, 2), 'utf8')

  console.log(`✓ ${OUTPUT}`)
  console.log(`  total: ${benchmark.length} rows`)
  const counts = benchmark.reduce(
    (acc, r) => {
      acc[r.series] = (acc[r.series] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
  for (const [series, count] of Object.entries(counts)) {
    console.log(`  ${series.padEnd(20)} ${count}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
