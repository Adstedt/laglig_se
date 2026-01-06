/**
 * Analyze HTML structure of proposition for Författningskommentar extraction
 */

import * as cheerio from 'cheerio'

async function main() {
  const url = 'https://data.riksdagen.se/dokument/HC0359.html'
  console.log(`Fetching: ${url}\n`)

  const res = await fetch(url)
  const html = await res.text()

  const $ = cheerio.load(html)

  console.log('=== HTML STRUCTURE ANALYSIS ===\n')

  // What elements are there?
  const tagCounts: Record<string, number> = {}
  $('*').each((_, el) => {
    const tag = el.tagName
    tagCounts[tag] = (tagCounts[tag] || 0) + 1
  })

  console.log('Top tags:')
  Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([tag, count]) => console.log(`  ${tag}: ${count}`))

  // Look for heading elements containing "Författningskommentar"
  console.log('\n=== SEARCHING FOR FÖRFATTNINGSKOMMENTAR ===\n')

  $('*').each((_, el) => {
    const $el = $(el)
    const text = $el.text()
    if (text.includes('Författningskommentar') && text.length < 100) {
      console.log(`<${el.tagName} class="${$el.attr('class') || ''}">`)
      console.log(`  Text: "${text.trim()}"`)
    }
  })

  // Look for "35 kap. 1 §" section
  console.log('\n=== SEARCHING FOR "35 kap. 1 §" ===\n')

  let found = false
  $('p, div, span').each((_, el) => {
    if (found) return
    const $el = $(el)
    const text = $el.text().trim()
    if (text.match(/35\s*kap\.\s*1\s*§/) && text.length < 50) {
      console.log(`Found section header:`)
      console.log(`  <${el.tagName} class="${$el.attr('class') || ''}">`)
      console.log(`  Text: "${text}"`)

      // Get the next few siblings
      console.log('\n  Following content:')
      let sibling = $el.next()
      for (let i = 0; i < 3 && sibling.length; i++) {
        const sibText = sibling.text().trim().substring(0, 200)
        console.log(`  - ${sibText}...`)
        sibling = sibling.next()
      }
      found = true
    }
  })

  // Try finding by class patterns
  console.log('\n=== CLASS PATTERNS ===\n')
  const classes = new Set<string>()
  $('[class]').each((_, el) => {
    const cls = $(el).attr('class')
    if (cls) {
      cls.split(' ').forEach((c) => {
        if (c.startsWith('ft') || c.startsWith('p')) classes.add(c)
      })
    }
  })
  console.log('CSS classes found:', [...classes].slice(0, 20).join(', '))
}

main()
