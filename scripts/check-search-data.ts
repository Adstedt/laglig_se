/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function main() {
  // Check column data
  const stats = await prisma.$queryRaw`
    SELECT
      content_type::text,
      COUNT(*)::int as total,
      COUNT(full_text)::int as has_full_text,
      COUNT(CASE WHEN full_text IS NOT NULL AND full_text != '' THEN 1 END)::int as has_non_empty_full_text,
      COUNT(summary)::int as has_summary,
      COUNT(search_vector)::int as has_search_vector
    FROM legal_documents
    GROUP BY content_type
  `
  console.log('Data stats by content_type:')
  console.log(JSON.stringify(stats, null, 2))

  // Check schema for relevant columns
  const columns = await prisma.$queryRaw`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'legal_documents'
    AND (column_name LIKE '%html%' OR column_name LIKE '%text%' OR column_name = 'summary' OR column_name = 'title')
  `
  console.log('\nRelevant columns in schema:')
  console.log(JSON.stringify(columns, null, 2))

  // Sample a few rows to see actual data
  const sample = await prisma.$queryRaw`
    SELECT
      id,
      content_type::text,
      title,
      LEFT(full_text, 100) as full_text_preview,
      LEFT(summary, 100) as summary_preview,
      search_vector IS NOT NULL as has_search_vector
    FROM legal_documents
    LIMIT 3
  `
  console.log('\nSample rows:')
  console.log(JSON.stringify(sample, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
