import * as fs from 'fs'

const oldJson = JSON.parse(
  fs.readFileSync('data/sfs-1977-1160-json.json', 'utf-8')
)
const newJson = JSON.parse(
  fs.readFileSync('data/sfs-1977-1160-json-improved.json', 'utf-8')
)

console.log('=== OLD (current DB) vs NEW (improved parser) ===')
console.log('')

// Ch1 §1 - amendment ref handling
const oldCh1 = oldJson.chapters[0]
const newCh1 = newJson.chapters[0]

console.log('--- Chapter 1, § 1 ---')
const oldS1 = oldCh1.sections[0]
const newS1 = newCh1.sections[0]
console.log('OLD:')
console.log('  amendedBy:', oldS1.amendedBy)
console.log(
  '  content:',
  JSON.stringify(oldS1.content || '(empty)').substring(0, 80)
)
console.log('  paragraphs:', oldS1.paragraphs.length)
for (const p of oldS1.paragraphs) {
  console.log(`    [${p.role}] #${p.number}: ${p.text.substring(0, 100)}`)
}
console.log('NEW:')
console.log('  amendedBy:', newS1.amendedBy)
console.log('  content:', JSON.stringify(newS1.content).substring(0, 80))
console.log('  paragraphs:', newS1.paragraphs.length)
for (const p of newS1.paragraphs) {
  console.log(`    [${p.role}] #${p.number}: ${p.text.substring(0, 100)}`)
}

console.log('')

// Ch1 §3 - list items
console.log('--- Chapter 1, § 3 (has list items) ---')
const oldS3 = oldCh1.sections.find((s: any) => s.number === '3')
const newS3 = newCh1.sections.find((s: any) => s.number === '3')
console.log('OLD:')
console.log('  amendedBy:', oldS3?.amendedBy)
console.log('  paragraphs:', oldS3?.paragraphs.length)
for (const p of (oldS3?.paragraphs || []).slice(0, 7)) {
  console.log(`    [${p.role}] #${p.number}: ${p.text.substring(0, 100)}`)
}
console.log('NEW:')
console.log('  amendedBy:', newS3?.amendedBy)
console.log('  paragraphs:', newS3?.paragraphs.length)
for (const p of (newS3?.paragraphs || []).slice(0, 7)) {
  console.log(`    [${p.role}] #${p.number}: ${p.text.substring(0, 100)}`)
}

// Stats comparison
console.log('')
console.log('=== STATS COMPARISON ===')

function getStats(json: any) {
  let sections = 0
  let amended = 0
  let listItems = 0
  let numberedP = 0
  let withContent = 0
  for (const ch of json.chapters) {
    for (const s of ch.sections) {
      sections++
      if (s.amendedBy) amended++
      if (s.content && s.content.length > 0) withContent++
      for (const p of s.paragraphs) {
        if (p.role === 'LIST_ITEM') listItems++
        if (p.role === 'PARAGRAPH' && p.number !== null) numberedP++
      }
    }
  }
  return { sections, amended, listItems, numberedP, withContent }
}

const oldStats = getStats(oldJson)
const newStats = getStats(newJson)
console.log('                    OLD    NEW')
console.log(
  'Sections:          ',
  String(oldStats.sections).padStart(4),
  '  ',
  String(newStats.sections).padStart(4)
)
console.log(
  'With amendedBy:    ',
  String(oldStats.amended).padStart(4),
  '  ',
  String(newStats.amended).padStart(4)
)
console.log(
  'With content:      ',
  String(oldStats.withContent).padStart(4),
  '  ',
  String(newStats.withContent).padStart(4)
)
console.log(
  'List items:        ',
  String(oldStats.listItems).padStart(4),
  '  ',
  String(newStats.listItems).padStart(4)
)
console.log(
  'Numbered stycken:  ',
  String(oldStats.numberedP).padStart(4),
  '  ',
  String(newStats.numberedP).padStart(4)
)
