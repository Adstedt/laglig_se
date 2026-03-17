import * as fs from 'fs'
import * as path from 'path'

const evalDir = 'data/parser-eval'
const files = fs.readdirSync(evalDir).filter((f) => f.endsWith('.json'))

const allFiles = [
  ...files.map((f) => path.join(evalDir, f)),
  'data/sfs-1977-1160-json-improved.json',
]

let totalPar = 0
let headingsPopulated = 0
let headingsOnStycken = 0
let dashListItems = 0
let letterListItems = 0
let numberedListItems = 0
let amendmentLeaks = 0
const headingExamples: string[] = []
const leakExamples: string[] = []

const amendmentRe = /^(?:Lag|Förordning)\s+\(\d{4}:\d+[a-z]?\)\.?$/

for (const filePath of allFiles) {
  const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const fileName = path.basename(filePath)

  const allChapters = json.divisions
    ? json.divisions.flatMap((d: any) => d.chapters)
    : json.chapters

  for (const ch of allChapters) {
    for (const p of ch.paragrafer) {
      totalPar++

      if (p.heading) {
        headingsPopulated++
        if (headingExamples.length < 10) {
          headingExamples.push(
            `${fileName} ${ch.number || '-'} kap § ${p.number}: "${p.heading}"`
          )
        }
      }

      for (const s of p.stycken) {
        if (s.role === 'HEADING') headingsOnStycken++
      }

      for (const s of p.stycken) {
        if (s.role === 'LIST_ITEM') {
          if (s.text.startsWith('- ')) dashListItems++
          else if (/^[a-z]\)\s/.test(s.text)) letterListItems++
          else numberedListItems++
        }
      }

      for (const s of p.stycken) {
        if (s.role === 'STYCKE' && amendmentRe.test(s.text)) {
          amendmentLeaks++
          if (leakExamples.length < 5) {
            leakExamples.push(`${fileName} § ${p.number}: "${s.text}"`)
          }
        }
      }
    }
  }
}

console.log('=== P0: HEADING FIX ===')
console.log(`Total paragrafer: ${totalPar}`)
console.log(`heading field populated: ${headingsPopulated}`)
console.log(`Residual HEADING stycken: ${headingsOnStycken}`)
console.log('\nExamples:')
for (const ex of headingExamples) console.log(`  ${ex}`)

console.log('\n=== P1: LIST ITEMS ===')
console.log(`Numbered (1. 2. 3.): ${numberedListItems}`)
console.log(`Dash (- ): ${dashListItems}`)
console.log(`Letter (a) b)): ${letterListItems}`)
console.log(`Total: ${numberedListItems + dashListItems + letterListItems}`)

console.log('\n=== AMENDMENT LEAKS ===')
console.log(`Still in stycken: ${amendmentLeaks}`)
for (const ex of leakExamples) console.log(`  ${ex}`)
