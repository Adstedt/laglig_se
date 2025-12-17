/* eslint-disable no-console */
/**
 * Investigate the difference between API's 11,397 count and our 11,256 unique SFS
 *
 * Hypothesis: Some documents have the same beteckning (SFS number) but different dok_id
 */

import * as fs from 'fs'
import * as path from 'path'

const OUTPUT_DIR = 'data/sfs-comparison'

async function main() {
  const outputDir = path.join(process.cwd(), OUTPUT_DIR)

  // Read full list
  const fullPath = path.join(outputDir, 'api-sfs-full-list.txt')
  const fullRaw = fs.readFileSync(fullPath, 'utf-8')

  const byBeteckning = new Map<
    string,
    { dok_id: string; title: string; date: string }[]
  >()
  const byDokId = new Map<
    string,
    { beteckning: string; title: string; date: string }[]
  >()

  let lineCount = 0
  for (const line of fullRaw.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue
    lineCount++

    const [beteckning, date, dok_id, ...titleParts] = line.split('\t')
    const title = titleParts.join('\t')

    if (!byBeteckning.has(beteckning)) {
      byBeteckning.set(beteckning, [])
    }
    byBeteckning.get(beteckning)!.push({ dok_id, title, date })

    if (!byDokId.has(dok_id)) {
      byDokId.set(dok_id, [])
    }
    byDokId.get(dok_id)!.push({ beteckning, title, date })
  }

  console.log(`Total lines processed: ${lineCount}`)
  console.log(`Unique beteckning (SFS numbers): ${byBeteckning.size}`)
  console.log(`Unique dok_id: ${byDokId.size}`)
  console.log('')

  // Find duplicates by beteckning
  const duplicateBeteckning: string[] = []
  for (const [beteckning, entries] of byBeteckning) {
    if (entries.length > 1) {
      duplicateBeteckning.push(beteckning)
    }
  }

  if (duplicateBeteckning.length > 0) {
    console.log(
      `SFS numbers with multiple dok_id entries: ${duplicateBeteckning.length}`
    )
    console.log('Examples:')
    for (const sfs of duplicateBeteckning.slice(0, 10)) {
      const entries = byBeteckning.get(sfs)!
      console.log(`  ${sfs}:`)
      for (const e of entries) {
        console.log(
          `    - ${e.dok_id} (${e.date}): ${e.title.substring(0, 50)}`
        )
      }
    }
  }

  // Find duplicates by dok_id
  const duplicateDokId: string[] = []
  for (const [dok_id, entries] of byDokId) {
    if (entries.length > 1) {
      duplicateDokId.push(dok_id)
    }
  }

  if (duplicateDokId.length > 0) {
    console.log(
      `\ndok_id with multiple beteckning entries: ${duplicateDokId.length}`
    )
    for (const dok_id of duplicateDokId.slice(0, 10)) {
      const entries = byDokId.get(dok_id)!
      console.log(`  ${dok_id}:`)
      for (const e of entries) {
        console.log(
          `    - ${e.beteckning} (${e.date}): ${e.title.substring(0, 50)}`
        )
      }
    }
  }

  // Now, let's also check: what does the year stats file show as total?
  const yearStatsPath = path.join(outputDir, 'api-year-stats.json')
  const yearStats = JSON.parse(fs.readFileSync(yearStatsPath, 'utf-8'))

  const sumByYear = yearStats.years.reduce(
    (acc: number, y: { count: number }) => acc + y.count,
    0
  )
  console.log(`\nSum of all year counts: ${sumByYear}`)
  console.log(`API reported total: 11397`)
  console.log(`Difference: ${11397 - sumByYear}`)
}

main().catch(console.error)
