import fs from 'fs'
import path from 'path'

const dir = 'data/json-eval-batch'
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.json') && !f.includes('raw'))

console.log('=== CROSS-FILE ANALYSIS ===\n')

for (const file of files.sort()) {
  const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
  const allChapters = json.divisions
    ? json.divisions.flatMap((d) => d.chapters)
    : json.chapters || []

  // Collect all roles used
  const roles = new Set()
  let numberedListIssues = 0
  let totalParagraphs = 0
  let totalSections = 0

  for (const ch of allChapters) {
    totalSections += ch.sections?.length || 0
    for (const sec of ch.sections || []) {
      for (const p of sec.paragraphs || []) {
        roles.add(p.role)
        totalParagraphs++
        // Check if numbered list items are separate paragraphs
        if (/^\d+\.\s/.test(p.text)) numberedListIssues++
      }
    }
  }

  // Check document number format
  const docNumPrefix = json.documentNumber?.startsWith('SFS')
    ? 'SFS'
    : 'missing-SFS'

  console.log(`--- ${file} ---`)
  console.log(`  Title: ${json.title}`)
  console.log(`  DocNumber: ${json.documentNumber} [${docNumPrefix}]`)
  console.log(
    `  Chapters: ${allChapters.length}, Sections: ${totalSections}, Paragraphs: ${totalParagraphs}`
  )
  console.log(`  Roles used: ${[...roles].sort().join(', ')}`)
  console.log(`  Numbered list items as paragraphs: ${numberedListIssues}`)
  console.log(
    `  Transition provisions: ${json.transitionProvisions?.length || 0}`
  )

  // Check for leaked amendment refs
  let leakedRefs = 0
  for (const ch of allChapters) {
    for (const sec of ch.sections || []) {
      for (const p of sec.paragraphs || []) {
        if (/^(Lag|Förordning)\s+\(\d{4}:\d+\)\s*\.?\s*$/.test(p.text.trim()))
          leakedRefs++
      }
    }
  }
  if (leakedRefs) console.log(`  ⚠ Leaked amendment refs: ${leakedRefs}`)

  console.log('')
}
