import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'

async function main() {
  const client = new Anthropic()

  const jsonlContent = readFileSync('batches/lagar-test-100.jsonl', 'utf-8')
  const requests = jsonlContent
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))

  console.log(`Submitting batch with ${requests.length} lagar...`)

  const batch = await client.messages.batches.create({
    requests: requests.map((r) => ({
      custom_id: r.custom_id,
      params: r.params,
    })),
  })

  console.log('\nBatch submitted!')
  console.log('  Batch ID:', batch.id)
  console.log('  Status:', batch.processing_status)
  console.log('\nTo check status:')
  console.log(
    `  pnpm tsx scripts/batch-process-amendments.ts status ${batch.id}`
  )
}

main().catch(console.error)
