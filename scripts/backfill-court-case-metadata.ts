/* eslint-disable no-console */
/**
 * Backfill Court Case Metadata Script
 *
 * Updates existing court cases with `case_type` and `case_name` fields
 * by fetching data from the Domstolsverket API using stored api_id.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-court-case-metadata.ts
 *   pnpm tsx scripts/backfill-court-case-metadata.ts --limit=100
 *   pnpm tsx scripts/backfill-court-case-metadata.ts --dry-run
 */

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const DOMSTOLSVERKET_API = 'https://rattspraxis.etjanst.domstol.se/api/v1'

// Rate limiting: 5 requests/second
const RATE_LIMIT_MS = 200
let lastRequestTime = 0

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - timeSinceLastRequest)
  }
  lastRequestTime = Date.now()
}

interface ApiResponse {
  typ?: string
  benamning?: string
  arVagledande?: boolean
}

async function fetchFromApi(apiId: string): Promise<ApiResponse | null> {
  await waitForRateLimit()

  try {
    const response = await fetch(
      `${DOMSTOLSVERKET_API}/publiceringar/${apiId}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Laglig.se/1.0 (https://laglig.se)',
        },
      }
    )

    if (!response.ok) {
      console.warn(`  ⚠️ API returned ${response.status} for ${apiId}`)
      return null
    }

    return (await response.json()) as ApiResponse
  } catch (error) {
    console.error(`  ❌ Failed to fetch ${apiId}:`, error)
    return null
  }
}

interface Config {
  limit?: number
  dryRun: boolean
}

function parseArgs(): Config {
  const args = process.argv.slice(2)
  const config: Config = {
    dryRun: false,
  }

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      config.limit = parseInt(arg.split('=')[1] || '0', 10)
    } else if (arg === '--dry-run') {
      config.dryRun = true
    }
  }

  return config
}

async function main() {
  const config = parseArgs()
  console.log('='.repeat(60))
  console.log('Court Case Metadata Backfill')
  console.log('='.repeat(60))
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`)
  if (config.limit) console.log(`Limit: ${config.limit}`)
  console.log('')

  // Find court cases that need backfill
  // Cases missing case_type in metadata OR have old raw values in title
  const courtCases = await prisma.legalDocument.findMany({
    where: {
      content_type: {
        in: [
          'COURT_CASE_AD',
          'COURT_CASE_HD',
          'COURT_CASE_HFD',
          'COURT_CASE_HOVR',
          'COURT_CASE_MOD',
          'COURT_CASE_MIG',
        ],
      },
      metadata: { not: Prisma.DbNull },
    },
    select: {
      id: true,
      document_number: true,
      title: true,
      metadata: true,
    },
    take: config.limit,
    orderBy: { created_at: 'desc' },
  })

  console.log(`Found ${courtCases.length} court cases to check`)
  console.log('')

  let updated = 0
  let skipped = 0
  let errors = 0
  let alreadyComplete = 0

  for (let i = 0; i < courtCases.length; i++) {
    const doc = courtCases[i]
    const metadata = doc.metadata as Record<string, unknown>

    // Skip if already has case_type
    if (metadata.case_type) {
      alreadyComplete++
      continue
    }

    // Get API ID from metadata
    const apiId = metadata.api_id as string | undefined
    if (!apiId) {
      console.log(`  ⚠️ No api_id for ${doc.document_number}, skipping`)
      skipped++
      continue
    }

    // Fetch from API
    const apiData = await fetchFromApi(apiId)
    if (!apiData) {
      errors++
      continue
    }

    // Log progress every 10 items
    if ((i + 1) % 10 === 0 || i === 0) {
      const pct = (((i + 1) / courtCases.length) * 100).toFixed(1)
      console.log(
        `Progress: ${i + 1}/${courtCases.length} (${pct}%) | Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`
      )
    }

    // Update metadata
    const newMetadata = {
      ...metadata,
      case_type: apiData.typ || null,
      case_name: apiData.benamning || null,
      is_guiding: apiData.arVagledande ?? metadata.is_guiding ?? false,
    }

    if (!config.dryRun) {
      await prisma.legalDocument.update({
        where: { id: doc.id },
        data: { metadata: newMetadata },
      })
    }

    updated++

    // Log sample updates
    if (updated <= 5 || updated % 100 === 0) {
      console.log(
        `  ✅ ${doc.document_number}: typ=${apiData.typ}, benamning=${apiData.benamning || '(none)'}`
      )
    }
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log(`Total checked: ${courtCases.length}`)
  console.log(`Already complete: ${alreadyComplete}`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Errors: ${errors}`)

  if (config.dryRun) {
    console.log('')
    console.log('⚠️ DRY RUN - no changes were made')
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
