/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, existsSync, readFileSync } from 'fs'

const ALL_BATCH_IDS = [
  'msgbatch_01SZaPffS9EPotYvtYA62sLc', // part1
  'msgbatch_01W6xUb9aYkvB87q1ecC9nVw', // part2
  'msgbatch_01QFbm2CitHZEifp9WAfGa71', // part4
  'msgbatch_014PBGx8vLEn5pfM6iAx4Ryi', // part3-aa
  'msgbatch_011R9PVEGYEx4nQiuCGfmP5M', // part3-ab
  'msgbatch_01JkzjfMc6RLvgJAEd5zhGTC', // part5-aa
  'msgbatch_01EfwXkwMUYoxT3XgUHJya9M', // part5-ab
  'msgbatch_01ErwvjkPTAahh1taSQmVRiv', // part5-ac-resplit
  'msgbatch_01S3n4BYTYHrk8vRgRZ1PASF', // part5-final-aa
  'msgbatch_01Dokk6jTuDBGZQ1BGMGPbT5', // part5-final-ab
  'msgbatch_014D3WwXopG97RR7RJwhV4M2', // part6-aa
  'msgbatch_01HnKHZi7GJ4XAQpctJHdNcS', // part6-ab
  'msgbatch_01Vb5BHNgjRDEYSL7pvc7ZvA', // part6-ac
  'msgbatch_01QSFbv7ha2G3QzRCx4Smiog', // part6-ad
  'msgbatch_01EoVwA9FGy9AX6oGi7MMU2E', // part6-ae
  'msgbatch_019vibjeKAM325ZaneyXZ7sL', // part6-af
  'msgbatch_01WUDhmPUH9niUnVw5Tnx9bc', // part6-ag
  'msgbatch_01Fvw1LoqKBgx41B3PuKqUbv', // part6-ah
  'msgbatch_01AMhyRazd8vcS2c9i9AKzRG', // part6-ai
  'msgbatch_016EtyueKFC8zz114aMAjwgm', // part6-aj
  'msgbatch_014vD1REomDEmwB5FkTzTC9F', // part6-ak
  'msgbatch_01RDuZgiD3L13Nc66MHnxoz8', // part6-al
  'msgbatch_01UaqojqBSs2eoUqgtbBXU81', // part6-am
  'msgbatch_014GjTiuXskRWHcXhWoqESE9', // part6-an
  'msgbatch_01U3u8TQiRTR8aYNSPk5uxYX', // part6-ao
  'msgbatch_01LTXaHbw4qdPKQgwtWhSs7J', // part6-ap
  'msgbatch_01FUf65zex4M18pUKiicGv8n', // part7-aa
  'msgbatch_01NNJvabwmQz5PaCADd4YqCh', // part7-ab
  'msgbatch_01HULQCsVSrNaYNZXUuWoGUL', // part7-ac
  'msgbatch_01QnJpkv5CNKfoj1b1Y4p8Qu', // part7-ad
  'msgbatch_0168zsMRsYmDSm8dxHSmuL29', // part7-ae
  'msgbatch_01UFz3PuZsqkVcnpdusCGZxx', // part7-af
  'msgbatch_01Uv6iVydYNk5Q5wJUeeZQr6', // part7-ag
  'msgbatch_01WEThkCVSaWBLFvqdamgHKC', // part7-ah
  'msgbatch_01L4ewup9fTnz3feC1Ps4Fzj', // failed-aa
  'msgbatch_01K1Gn6aMxLtir7qrAFRoiEW', // failed-ab
  'msgbatch_0187rXmRqpZ5KezHivyKQcqb', // failed-ac
  'msgbatch_0145WhRYHLco9mkA37Ckb4Fh', // failed-ad
]

async function main() {
  const client = new Anthropic()

  const succeededSfs = new Set<string>()
  const failedSfs = new Set<string>()

  console.log('Downloading and analyzing all batch results...\n')

  for (const batchId of ALL_BATCH_IDS) {
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
        const sfsNumber = result.custom_id // e.g., "SFS2022-1109"

        if (result.result?.type === 'succeeded') {
          succeededSfs.add(sfsNumber)
        } else {
          failedSfs.add(sfsNumber)
        }
      }
    } catch (e: any) {
      console.log(`  Error parsing ${batchId.slice(-8)}: ${e.message}`)
    }
  }

  // Remove succeeded from failed (in case of duplicates)
  for (const sfs of succeededSfs) {
    failedSfs.delete(sfs)
  }

  console.log('\n=== RESULTS ===')
  console.log(`Succeeded: ${succeededSfs.size}`)
  console.log(`Failed/Canceled: ${failedSfs.size}`)

  // Save lists
  writeFileSync(
    'batches/succeeded-sfs.txt',
    [...succeededSfs].sort().join('\n')
  )
  writeFileSync(
    'batches/failed-sfs-to-reprocess.txt',
    [...failedSfs].sort().join('\n')
  )

  console.log('\nSaved:')
  console.log('  batches/succeeded-sfs.txt')
  console.log('  batches/failed-sfs-to-reprocess.txt')
}

main()
