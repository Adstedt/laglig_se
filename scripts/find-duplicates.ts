/* eslint-disable no-console */
/**
 * Find all duplicate beteckning entries in the API data
 */

import * as fs from 'fs'

const fullList = fs.readFileSync(
  'data/sfs-comparison/api-sfs-full-list.txt',
  'utf-8'
)
const lines = fullList.split('\n').filter((l) => l && !l.startsWith('#'))

const byBeteckning = new Map<
  string,
  { dok_id: string; date: string; title: string }[]
>()

for (const line of lines) {
  const [beteckning, date, dok_id, ...titleParts] = line.split('\t')
  if (!byBeteckning.has(beteckning)) {
    byBeteckning.set(beteckning, [])
  }
  byBeteckning
    .get(beteckning)!
    .push({ dok_id, date, title: titleParts.join('\t') })
}

console.log('=== SFS numbers with multiple dok_ids (duplicates) ===\n')

const duplicates: {
  beteckning: string
  entries: { dok_id: string; date: string; title: string }[]
}[] = []

for (const [beteckning, entries] of byBeteckning) {
  if (entries.length > 1) {
    duplicates.push({ beteckning, entries })
  }
}

// Sort by beteckning
duplicates.sort((a, b) => a.beteckning.localeCompare(b.beteckning))

let totalDupeEntries = 0
for (const dup of duplicates) {
  totalDupeEntries += dup.entries.length - 1
  console.log(`${dup.beteckning} (${dup.entries.length} entries):`)
  for (const e of dup.entries) {
    const shortTitle =
      e.title.length > 60 ? e.title.substring(0, 60) + '...' : e.title
    console.log(`  - ${e.dok_id} [${e.date}]: ${shortTitle}`)
  }
  console.log('')
}

console.log('='.repeat(60))
console.log(`Total unique beteckning: ${byBeteckning.size}`)
console.log(`SFS numbers with duplicates: ${duplicates.length}`)
console.log(`Total duplicate entries: ${totalDupeEntries}`)
console.log(`Total documents: ${lines.length}`)
console.log(
  `Expected: ${byBeteckning.size} + ${totalDupeEntries} = ${byBeteckning.size + totalDupeEntries}`
)

// Write to file
fs.writeFileSync(
  'data/sfs-comparison/duplicates.txt',
  duplicates
    .map((d) => {
      return `${d.beteckning}:\n${d.entries.map((e) => `  ${e.dok_id}\t${e.date}\t${e.title}`).join('\n')}`
    })
    .join('\n\n') + '\n'
)
console.log('\nWritten: data/sfs-comparison/duplicates.txt')
