import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find SFS_LAW docs that have json_content but DON'T have canonical HTML wrapper
  const staleJson: Array<{ count: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND json_content IS NOT NULL
      AND (html_content IS NULL OR html_content NOT LIKE '%<article class="legal-document"%')
  `
  console.log(
    `SFS_LAW with json_content but NO canonical HTML: ${staleJson[0]?.count}`
  )

  // Show a few examples
  const examples: Array<{
    document_number: string
    has_html: boolean
    json_version: string
  }> = await prisma.$queryRaw`
      SELECT document_number,
             (html_content IS NOT NULL) as has_html,
             COALESCE(json_content->>'schemaVersion', 'unknown') as json_version
      FROM legal_documents
      WHERE content_type = 'SFS_LAW'
        AND json_content IS NOT NULL
        AND (html_content IS NULL OR html_content NOT LIKE '%<article class="legal-document"%')
      ORDER BY document_number
      LIMIT 20
    `
  console.log('\nExamples:')
  for (const ex of examples) {
    console.log(
      `  ${ex.document_number} — has_html: ${ex.has_html}, json schema: ${ex.json_version}`
    )
  }

  // Also check: how many SFS_LAW have json_content with the OLD schema (no schemaVersion or wrong naming)?
  const oldSchema: Array<{ count: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND json_content IS NOT NULL
      AND (json_content->>'schemaVersion' IS NULL OR json_content->>'schemaVersion' != '1.0')
  `
  console.log(
    `\nSFS_LAW with json but missing/wrong schemaVersion: ${oldSchema[0]?.count}`
  )

  // Check for old naming: 'sections' instead of 'paragrafer'
  const oldNaming: Array<{ count: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint as count
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND json_content IS NOT NULL
      AND json_content::text LIKE '%"sections"%'
  `
  console.log(
    `SFS_LAW with old 'sections' naming in json: ${oldNaming[0]?.count}`
  )

  // Same checks for AGENCY_REGULATION
  const agencyStale: Array<{ count: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint as count
    FROM legal_documents
    WHERE content_type = 'AGENCY_REGULATION'
      AND json_content IS NOT NULL
      AND (html_content IS NULL OR html_content NOT LIKE '%<article class="legal-document"%')
  `
  console.log(
    `\nAGENCY_REGULATION with json but NO canonical HTML: ${agencyStale[0]?.count}`
  )

  // SFS_AMENDMENT check
  const amendStale: Array<{ count: bigint }> = await prisma.$queryRaw`
    SELECT COUNT(*)::bigint as count
    FROM legal_documents
    WHERE content_type = 'SFS_AMENDMENT'
      AND json_content IS NOT NULL
      AND (json_content->>'schemaVersion' IS NULL OR json_content->>'schemaVersion' != '1.0')
  `
  console.log(
    `SFS_AMENDMENT with json but missing/wrong schemaVersion: ${amendStale[0]?.count}`
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
