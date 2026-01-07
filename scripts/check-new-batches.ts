/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import Anthropic from '@anthropic-ai/sdk'

const BATCH_IDS = [
  'msgbatch_01D8vtiCFJV1NaScdhWVz9a7',
  'msgbatch_01HL1AMAwFw8cqxFaSu8Q4b4',
  'msgbatch_01PyZQMgAEWK3w4PWVtMxMhB',
  'msgbatch_01HmZHPx2UrfGw1Q8bCTTfGz',
  'msgbatch_01CeQz3JMJp9JfNMHy72VdDh',
  'msgbatch_01XL9tVLZdyxn1qLrj9eJafW',
  'msgbatch_01VyfTfycS5a6N7witrWYqSB',
  'msgbatch_01JJrE2JRxcoNFURGoHGU4ea',
  'msgbatch_01C6aFwHNLiFJaq9kNSB7vc5',
  'msgbatch_01SSrcj6k9E9pBse3mSGw6vx',
  'msgbatch_01F6h3sFgzQKRsK1JDsAvAn6',
  'msgbatch_015Z2zP1KGPHW9qCoUdSYsai',
  'msgbatch_01BiiehNYbvesKPCwGJqkG7E',
  'msgbatch_0198kx5qtExjmZUsZDW8GxXG',
  'msgbatch_014dX2fSqiUhRCbvGWUFdPvX',
  'msgbatch_018DryTmTHNNKCkWYoEqSM1Q',
  'msgbatch_01Mf4nqcexkH8jS4Cdy3JgEu',
  'msgbatch_016cao5b6eGqw8Fe3kQSQpLP',
  'msgbatch_01AtYy4QtDNUTW2tGWLFoPEM',
  'msgbatch_01HfkjJbYzunCwJ9zgQGngzF',
  'msgbatch_0171hQkpdq9sUoRTvUg4ZKRh',
  'msgbatch_01ND817Xi5sMRgs1Kvwo9NDc',
  'msgbatch_017TB6pjBVdQzLbPFa6ydyY9',
  'msgbatch_019B6iZEumADA34mNaUBrRBx',
  'msgbatch_01BL7aAMK3TAZmD9hGgPmuUj',
]

async function main() {
  const client = new Anthropic()

  let totalSucceeded = 0
  let totalErrored = 0
  let totalProcessing = 0
  let totalCanceled = 0

  console.log('ID (last 8) | Status      | Succeeded | Errored | Processing')
  console.log('------------|-------------|-----------|---------|----------')

  for (const batchId of BATCH_IDS) {
    try {
      const batch = await client.messages.batches.retrieve(batchId)
      const c = batch.request_counts
      const shortId = batchId.slice(-8)
      const status = batch.processing_status.padEnd(11)

      console.log(
        `${shortId} | ${status} | ${String(c.succeeded).padStart(9)} | ${String(c.errored).padStart(7)} | ${c.processing}`
      )

      totalSucceeded += c.succeeded
      totalErrored += c.errored
      totalProcessing += c.processing
      totalCanceled += c.canceled
    } catch (e: any) {
      console.log(`${batchId.slice(-8)} | ERROR: ${e.message.slice(0, 40)}`)
    }
  }

  console.log('------------|-------------|-----------|---------|----------')
  console.log(
    `TOTAL       |             | ${String(totalSucceeded).padStart(9)} | ${String(totalErrored).padStart(7)} | ${totalProcessing}`
  )
  console.log('')
  console.log('Summary:')
  console.log('  Succeeded:', totalSucceeded)
  console.log('  Errored:', totalErrored)
  console.log('  Processing:', totalProcessing)
  console.log('  Canceled:', totalCanceled)
}

main()
