import { config } from 'dotenv'
config({ path: '.env.local' })
import Anthropic from '@anthropic-ai/sdk'
import { createWriteStream, existsSync, mkdirSync } from 'fs'

const anthropic = new Anthropic()

// Backfill batch IDs (5860 requests for remaining no-html documents)
const ids = [
  // Part 1 (4999 requests, 10 sub-batches)
  'msgbatch_01SgCmvk2c6NHdWCnEHafTv7',
  'msgbatch_01BYzogMq4eedSePcxzAZ7iQ',
  'msgbatch_01TfUQ1tbiAbyro6HKnoeth3',
  'msgbatch_01PJYhPTH1G6yvpCbHSz5bB5',
  'msgbatch_01EoJQ7Vh5vKGRzbqAghxpN7',
  'msgbatch_011FUrbajqjACWZdEEJqg6bD',
  'msgbatch_01MnpprxkpB16g1i9ofLfrw4',
  'msgbatch_01Efyp2qua2zk5fQCx7tHRuZ',
  'msgbatch_01A3JwkxWJa6kLRVhYKW3U2p',
  'msgbatch_012Xvqo7U2nfJZj41wvfjVac',
  // Part 2 (861 requests, 6 sub-batches)
  'msgbatch_01Ctv4Z3boMy4JMqt2mkduL3',
  'msgbatch_012hMbUo54eb2nE95Euwx1XG',
  'msgbatch_012wmcJmQyCsSL7yZR3MGATu',
  'msgbatch_01BDAPP8RudGdrZGkKYhSGhx',
  'msgbatch_01MFXL3FeFQabfTWxePqHkfj',
  'msgbatch_01AR95ZJH9abNKLF6NbicDWL',
]

const mode = process.argv[2] || 'status'

async function checkStatus() {
  let totalSucceeded = 0
  let totalErrored = 0
  let totalProcessing = 0
  let totalRequests = 0
  let ended = 0

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const b = await anthropic.messages.batches.retrieve(id)
    const rc = b.request_counts
    const total =
      rc.processing + rc.succeeded + rc.errored + rc.canceled + rc.expired
    totalSucceeded += rc.succeeded
    totalErrored += rc.errored
    totalProcessing += rc.processing
    totalRequests += total
    if (b.processing_status === 'ended') ended++
    const s = b.processing_status === 'ended' ? 'DONE' : 'WAIT'
    const num = (i + 1).toString().padStart(2)
    const errStr = rc.errored ? `  err:${rc.errored}` : ''
    const procStr = rc.processing ? `  proc:${rc.processing}` : ''
    console.log(`${s} #${num}  ${rc.succeeded}/${total}${errStr}${procStr}`)
  }

  console.log('')
  console.log(
    `TOTAL: ${ended}/${ids.length} ended | ${totalSucceeded}/${totalRequests} succeeded | ${totalProcessing} processing | ${totalErrored} errored`
  )
}

async function downloadAll() {
  if (!existsSync('results')) mkdirSync('results')

  const mergedPath = 'results/backfill-merged.jsonl'
  const ws = createWriteStream(mergedPath)
  let totalDownloaded = 0
  let skippedBatches = 0

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const num = i + 1
    const b = await anthropic.messages.batches.retrieve(id)
    const rc = b.request_counts
    if (rc.succeeded === 0) {
      console.log(`#${num}: 0 succeeded, skipping`)
      skippedBatches++
      continue
    }
    console.log(`#${num}: downloading ${rc.succeeded} results...`)
    const resultsStream = await anthropic.messages.batches.results(id)
    let count = 0
    for await (const result of resultsStream) {
      const r = result as any
      if (r.result?.type === 'succeeded') {
        ws.write(JSON.stringify(result) + '\n')
        count++
      }
    }
    totalDownloaded += count
    console.log(`  -> ${count} results written`)
  }

  ws.end()
  console.log(`\nDone! ${totalDownloaded} results merged into ${mergedPath}`)
  console.log(`Skipped ${skippedBatches} batches with 0 successes`)
  console.log(
    `\nProcess with:\n  npx tsx scripts/batch-process-amendments.ts process --results-file ${mergedPath}`
  )
}

if (mode === 'download') {
  downloadAll()
} else {
  checkStatus()
}
