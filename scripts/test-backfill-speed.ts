/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function test() {
  const start = Date.now()

  // Test med 100 dokument
  const result = await prisma.$executeRaw`
    UPDATE legal_documents
    SET search_vector =
      setweight(to_tsvector('pg_catalog.swedish', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('pg_catalog.swedish', coalesce(document_number, '')), 'A') ||
      setweight(to_tsvector('pg_catalog.swedish', coalesce(summary, '')), 'B') ||
      setweight(to_tsvector('pg_catalog.swedish', coalesce(full_text, '')), 'C')
    WHERE id IN (
      SELECT id FROM legal_documents
      WHERE search_vector IS NULL
      LIMIT 100
    )
  `

  const elapsed = Date.now() - start
  console.log('Updated', result, 'rows in', elapsed, 'ms')
  console.log('Per row:', (elapsed / 100).toFixed(1), 'ms')
  console.log(
    'Estimated time for remaining ~27,680 docs:',
    Math.round(((elapsed / 100) * 27680) / 1000),
    'seconds'
  )
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
