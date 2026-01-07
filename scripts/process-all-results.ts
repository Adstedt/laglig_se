/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { readdirSync, readFileSync } from 'fs'
import { execSync } from 'child_process'

async function main() {
  const resultsDir = 'results'
  const files = readdirSync(resultsDir).filter((f) => f.endsWith('.jsonl'))

  console.log(`Found ${files.length} result files to process\n`)

  let totalProcessed = 0
  let totalSucceeded = 0

  for (const file of files) {
    const filePath = `${resultsDir}/${file}`

    // Count succeeded in this file
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const succeeded = lines.filter((l) =>
      l.includes('"type":"succeeded"')
    ).length

    if (succeeded === 0) {
      console.log(`Skip ${file}: 0 succeeded`)
      continue
    }

    console.log(`Processing ${file} (${succeeded} succeeded)...`)

    try {
      const cmd = `pnpm tsx scripts/batch-process-amendments.ts process --results-file ${filePath} 2>&1`
      const output = execSync(cmd, {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 300000,
      }).toString()

      // Extract results
      const match = output.match(/Succeeded: (\d+)/)
      if (match) {
        const processed = parseInt(match[1])
        totalSucceeded += processed
        console.log(`  Done: ${processed} succeeded`)
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message.slice(0, 100)}`)
    }

    totalProcessed++
  }

  console.log(`\n=== DONE ===`)
  console.log(`Files processed: ${totalProcessed}`)
  console.log(`Total succeeded: ${totalSucceeded}`)
}

main()
