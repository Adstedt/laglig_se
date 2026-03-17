import pg from 'pg'

const client = new pg.Client({
  connectionString:
    'postgresql://postgres.lezdkonjjjbvaghdwpog:A83FsCTFiIR5JsWJ@aws-1-eu-north-1.pooler.supabase.com:5432/postgres',
  // No timeout on the client side
  query_timeout: 0,
  statement_timeout: 0,
  connectionTimeoutMillis: 30000,
})

async function main() {
  console.log('Connecting directly to database...')
  await client.connect()
  console.log('Connected.')

  console.log('Setting performance parameters...')
  await client.query("SET statement_timeout = '0'")
  await client.query("SET maintenance_work_mem = '8GB'")
  await client.query('SET max_parallel_maintenance_workers = 8')
  console.log('  statement_timeout = 0 (no limit)')
  console.log('  maintenance_work_mem = 8GB')
  console.log('  max_parallel_maintenance_workers = 8')

  // Drop any leftover invalid index
  console.log('\nDropping any existing embedding index...')
  await client.query('DROP INDEX IF EXISTS content_chunks_embedding_idx')

  console.log('Creating HNSW index on 228K vectors...')
  const start = Date.now()
  await client.query(`
    CREATE INDEX content_chunks_embedding_idx
    ON content_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
  `)
  const elapsed = ((Date.now() - start) / 1000).toFixed(0)
  console.log(`\nHNSW index created in ${elapsed}s`)

  await client.end()
}

main().catch(async (e) => {
  console.error('ERROR:', e.message)
  await client.end()
  process.exit(1)
})
