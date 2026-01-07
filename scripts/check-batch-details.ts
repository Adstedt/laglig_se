/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

async function main() {
  const batchIds = [
    'msgbatch_014PBGx8vLEn5pfM6iAx4Ryi', // part3-aa
    'msgbatch_01FUf65zex4M18pUKiicGv8n', // part7-aa
    'msgbatch_01L4ewup9fTnz3feC1Ps4Fzj', // failed-aa
  ]

  for (const batchId of batchIds) {
    try {
      const batch = await client.messages.batches.retrieve(batchId)
      console.log(`\n=== ${batchId.slice(-8)} ===`)
      console.log('  Status:', batch.processing_status)
      console.log('  Created:', batch.created_at)
      console.log('  Expires:', batch.expires_at)
      console.log('  Processing:', batch.request_counts.processing)
      console.log('  Succeeded:', batch.request_counts.succeeded)
      console.log('  Errored:', batch.request_counts.errored)
    } catch (e: any) {
      console.log(`\n=== ${batchId.slice(-8)} ===`)
      console.log('  Error:', e.message)
    }
  }
}

main()
