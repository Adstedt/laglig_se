import fs from 'fs'
const json = JSON.parse(fs.readFileSync('data/sfs-law-arbetsmiljolagen-parsed.json', 'utf8'))

let amendRefCount = 0
let singleParagraphSections = 0
const allChapters = json.chapters

for (const ch of allChapters) {
  for (const sec of ch.sections) {
    for (const p of sec.paragraphs) {
      if (/^Lag\s+\(\d{4}:\d+\)$/.test(p.text.trim())) {
        amendRefCount++
      }
    }
    if (sec.paragraphs.length === 1) {
      singleParagraphSections++
    }
  }
}

console.log('Amendment references as paragraphs:', amendRefCount)
console.log('Single-paragraph sections:', singleParagraphSections)

console.log('\nTransition provisions (first 8):')
;(json.transitionProvisions || []).slice(0, 8).forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.text.slice(0, 140)}`)
})

// Chapter 6 details
const ch6 = allChapters.find(c => c.number === '6')
console.log('\nChapter 6:', ch6?.title)
console.log('  Sections:', ch6?.sections.length)
for (const s of ch6?.sections || []) {
  console.log(`  § ${s.number} (${s.paragraphs.length} p)${s.heading ? ' — ' + s.heading : ''}`)
  for (const p of s.paragraphs) {
    if (p.role !== 'PARAGRAPH') {
      console.log(`    [${p.role}] ${p.text.slice(0, 80)}`)
    }
  }
}

// Show the HEADING that was detected
console.log('\nAll non-PARAGRAPH roles:')
for (const ch of allChapters) {
  for (const sec of ch.sections) {
    for (const p of sec.paragraphs) {
      if (p.role !== 'PARAGRAPH') {
        console.log(`  Ch ${ch.number} § ${sec.number}: [${p.role}] ${p.text.slice(0, 80)}`)
      }
    }
  }
}

// Check § 1 of chapter 7 which has Skyddskommitté heading
const ch7 = allChapters.find(c => c.number === '7')
if (ch7) {
  console.log('\nChapter 7:', ch7.title)
  console.log('  Sections:', ch7.sections.length)
  for (const s of ch7.sections.slice(0, 5)) {
    console.log(`  § ${s.number} (${s.paragraphs.length} p)`)
    for (const p of s.paragraphs.slice(0, 2)) {
      console.log(`    [${p.role}] ${p.text.slice(0, 100)}`)
    }
  }
}
