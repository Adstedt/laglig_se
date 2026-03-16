/**
 * Compare two chunking strategies for GDPR:
 * A) Current: one paragraph per <p> (flat, noisy)
 * B) Article-level: merge all content within each article into one text block
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import { parseCanonicalHtml } from '../lib/transforms/canonical-html-parser'
import { writeFileSync } from 'fs'

const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: { contains: '32016R0679' } },
    select: { html_content: true },
  })

  if (!doc?.html_content) {
    console.log('NOT FOUND')
    return
  }

  // Strategy A: current parser output (as-is)
  const rawJson = parseCanonicalHtml(doc.html_content)
  writeFileSync(
    resolve(process.cwd(), 'data/eu-gdpr-strategy-a-raw.json'),
    JSON.stringify(rawJson, null, 2),
    'utf-8'
  )

  // Strategy B: article-level chunks
  // Each section becomes one chunk with merged text, clean metadata
  interface ArticleChunk {
    chunkId: string
    chapter: { number: string | null; title: string | null }
    article: { number: string; heading: string | null }
    text: string // all content merged, cleaned
    wordCount: number
    roles: string[] // what roles were present
  }

  const chunks: ArticleChunk[] = []

  for (const chapter of rawJson.chapters) {
    for (const section of chapter.sections) {
      // Merge all paragraph texts, skip empties
      const lines: string[] = []
      const roles = new Set<string>()

      for (const p of section.paragraphs) {
        roles.add(p.role)
        const t = p.text.trim()
        if (!t) continue

        // If previous line is a bare sub-point label like "a)", "b)", "iv)",
        // merge this line onto it instead of adding a new line
        const lastLine = lines[lines.length - 1]
        if (lastLine && /^[a-z]{1,4}\)$/.test(lastLine)) {
          lines[lines.length - 1] = `${lastLine} ${t}`
        } else if (lastLine && /^[ivxlc]+\)$/i.test(lastLine)) {
          lines[lines.length - 1] = `${lastLine} ${t}`
        } else {
          lines.push(t)
        }
      }

      const mergedText = lines.join('\n')
      const wordCount = mergedText.split(/\s+/).filter(Boolean).length

      chunks.push({
        chunkId: `gdpr_ch${chapter.number}_${section.number}`,
        chapter: { number: chapter.number, title: chapter.title },
        article: { number: section.number, heading: section.heading },
        text: mergedText,
        wordCount,
        roles: [...roles],
      })
    }
  }

  writeFileSync(
    resolve(process.cwd(), 'data/eu-gdpr-strategy-b-article-chunks.json'),
    JSON.stringify(chunks, null, 2),
    'utf-8'
  )

  // Stats
  const wordCounts = chunks.map((c) => c.wordCount)
  const avg = Math.round(
    wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
  )
  const max = Math.max(...wordCounts)
  const min = Math.min(...wordCounts)
  const over500 = wordCounts.filter((w) => w > 500).length

  console.log(
    `Strategy A (raw): ${rawJson.chapters.length} chapters, ${rawJson.chapters.reduce((a, c) => a + c.sections.reduce((b, s) => b + s.paragraphs.length, 0), 0)} paragraphs`
  )
  console.log(`Strategy B (article chunks): ${chunks.length} chunks`)
  console.log(`  Words: avg=${avg}, min=${min}, max=${max}`)
  console.log(`  Chunks >500 words: ${over500} (may need splitting)`)
  console.log(`\nFiles saved to data/`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
