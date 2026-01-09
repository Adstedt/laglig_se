/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, existsSync, readFileSync } from 'fs'

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

  const succeededSfs = new Set<string>()
  const expiredSfs = new Set<string>()

  console.log('Downloading and analyzing batch results...\n')

  for (const batchId of BATCH_IDS) {
    const resultsFile = `results/${batchId}.jsonl`

    // Download if not exists
    if (!existsSync(resultsFile)) {
      try {
        console.log(`Downloading ${batchId.slice(-8)}...`)
        const results = await client.messages.batches.results(batchId)

        const lines: string[] = []
        for await (const result of results) {
          lines.push(JSON.stringify(result))
        }

        if (lines.length > 0) {
          writeFileSync(resultsFile, lines.join('\n'))
          console.log(`  Saved ${lines.length} results`)
        }
      } catch (e: any) {
        console.log(`  Skip ${batchId.slice(-8)}: ${e.message}`)
        continue
      }
    } else {
      console.log(`Using cached ${batchId.slice(-8)}`)
    }

    // Parse results
    try {
      const content = readFileSync(resultsFile, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)

      for (const line of lines) {
        const result = JSON.parse(line)
        const sfsNumber = result.custom_id

        if (result.result?.type === 'succeeded') {
          succeededSfs.add(sfsNumber)
        } else if (result.result?.type === 'expired') {
          expiredSfs.add(sfsNumber)
        }
      }
    } catch (e: any) {
      console.log(`  Error parsing ${batchId.slice(-8)}: ${e.message}`)
    }
  }

  console.log('\n=== RESULTS ===')
  console.log(`Succeeded: ${succeededSfs.size}`)
  console.log(`Expired: ${expiredSfs.size}`)

  // Save lists
  writeFileSync(
    'batches/succeeded-sfs-round2.txt',
    [...succeededSfs].sort().join('\n')
  )
  writeFileSync(
    'batches/expired-sfs-to-reprocess.txt',
    [...expiredSfs].sort().join('\n')
  )

  console.log('\nSaved:')
  console.log('  batches/succeeded-sfs-round2.txt')
  console.log('  batches/expired-sfs-to-reprocess.txt')
}

main()
