import * as fs from 'fs'
import * as path from 'path'

const amendmentRe = /^(?:Lag|Förordning)\s+\(\d{4}:\d+[a-z]?\)\.?$/
const evalDir = 'data/parser-eval'
const files = fs.readdirSync(evalDir).filter((f) => f.endsWith('.json'))

let shown = 0
for (const f of files) {
  const json = JSON.parse(fs.readFileSync(path.join(evalDir, f), 'utf-8'))
  for (const ch of json.chapters) {
    for (const p of ch.paragrafer) {
      for (let i = 0; i < p.stycken.length; i++) {
        const s = p.stycken[i]
        if (s.role === 'STYCKE' && amendmentRe.test(s.text) && shown < 8) {
          shown++
          console.log(`\n${f} — ch ${ch.number} § ${p.number}`)
          console.log(`  amendedBy: ${p.amendedBy}`)
          console.log(`  stycken count: ${p.stycken.length}`)
          console.log(
            `  leak at index ${i}/${p.stycken.length - 1}: "${s.text}"`
          )
          // Show what comes after
          if (i < p.stycken.length - 1) {
            const next = p.stycken[i + 1]
            console.log(
              `  next: [${next.role}] "${next.text.substring(0, 80)}"`
            )
          }
          // Show what comes before
          if (i > 0) {
            const prev = p.stycken[i - 1]
            console.log(
              `  prev: [${prev.role}] "${prev.text.substring(0, 80)}"`
            )
          }
        }
      }
    }
  }
}
