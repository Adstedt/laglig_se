import * as cheerio from 'cheerio'

async function main() {
  const url = 'https://data.riksdagen.se/dokument/HC0359.html'
  const res = await fetch(url)
  const html = await res.text()

  const $ = cheerio.load(html)
  const fullText = $('body').text()

  console.log(`Total text length: ${fullText.length} chars`)

  // The ToC has "14 Författningskommentar" near the start
  // The actual content has "14 Författningskommentar" again followed by "14.1 Förslaget..."
  // We need to find the SECOND occurrence or look for the actual content pattern

  // Find all occurrences of "Författningskommentar"
  const matches = [...fullText.matchAll(/Författningskommentar/gi)]
  console.log(`Found ${matches.length} occurrences of "Författningskommentar"`)
  matches.forEach((m, i) => {
    console.log(`  ${i + 1}. at position ${m.index}`)
  })

  // Look for the actual content section - it has "14.1 Förslaget till lag om ändring i brottsbalken"
  // followed by actual commentary text starting with "35 kap. Om preskription"
  const contentMatch = fullText.match(/14\.1\s*Förslaget till lag om ändring i brottsbalken\s*([\s\S]*?)(?=14\.2\s*Förslaget|Bilaga\s*1)/i)

  if (contentMatch) {
    console.log('\n=== 14.1 SECTION (actual commentary) ===')
    console.log(contentMatch[1].substring(0, 3000))

    // Look for section patterns in this content
    const text = contentMatch[1]
    console.log('\n=== SECTION PATTERNS ===')

    // Match "35 kap. X §" or just "X §" patterns with their commentary
    const sectionMatches = text.match(/35\s*kap\.[^§]*?\d+\s*§[^3]{100,500}/g)
    if (sectionMatches) {
      console.log(`Found ${sectionMatches.length} section commentaries:`)
      sectionMatches.slice(0, 3).forEach((s, i) => {
        console.log(`\n--- Section ${i + 1} ---`)
        console.log(s.substring(0, 400))
      })
    }
  } else {
    console.log('Could not find 14.1 section')

    // Try alternative: look for "35 kap. Om preskription"
    const altMatch = fullText.match(/35\s*kap\.\s*Om\s*preskription([\s\S]{0,5000})/i)
    if (altMatch) {
      console.log('\n=== Found "35 kap. Om preskription" ===')
      console.log(altMatch[0].substring(0, 2000))
    }
  }
}

main()
