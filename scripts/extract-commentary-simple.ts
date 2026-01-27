/**
 * Simple extraction: Get all text after "14 Författningskommentar" header
 */

import * as cheerio from 'cheerio'

async function main() {
  const url = 'https://data.riksdagen.se/dokument/HC0359.html'
  const res = await fetch(url)
  const html = await res.text()

  const $ = cheerio.load(html)

  // Find all <p> elements after the Författningskommentar section
  let inFkSection = false
  const fkContent: string[] = []

  $('p').each((_, el) => {
    const text = $(el).text().trim()

    // Start capturing when we hit the section header
    if (text === '14 Författningskommentar') {
      inFkSection = true
      return
    }

    // Stop at Bilaga
    if (text.startsWith('Bilaga 1') || text.startsWith('Bilaga1')) {
      inFkSection = false
      return
    }

    if (inFkSection && text.length > 10) {
      fkContent.push(text)
    }
  })

  console.log(
    `Extracted ${fkContent.length} paragraphs from Författningskommentar\n`
  )

  // Show first 20 paragraphs to understand format
  console.log('=== FIRST 20 PARAGRAPHS ===\n')
  fkContent.slice(0, 20).forEach((p, i) => {
    console.log(
      `[${i + 1}] ${p.substring(0, 150)}${p.length > 150 ? '...' : ''}`
    )
    console.log()
  })

  // Search for "§" patterns
  console.log('\n=== PARAGRAPHS CONTAINING "§" ===\n')
  const withSection = fkContent.filter((p) => p.includes('§') && p.length < 100)
  withSection.slice(0, 10).forEach((p) => console.log(`- ${p}`))

  // Search for "Paragrafen" patterns
  console.log('\n=== PARAGRAPHS STARTING WITH "Paragrafen" ===\n')
  const withPara = fkContent.filter(
    (p) => p.startsWith('Paragrafen') || p.startsWith('I paragrafen')
  )
  withPara
    .slice(0, 5)
    .forEach((p) => console.log(`- ${p.substring(0, 200)}...`))
}

main()
