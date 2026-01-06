/**
 * Extract Författningskommentar from Riksdag proposition
 * Pairs section text with commentary
 */

import * as cheerio from 'cheerio'

interface SectionCommentary {
  sectionNumber: string
  sectionText: string
  commentary: string
}

interface PropCommentary {
  propRef: string
  dokId: string
  title: string
  law: string
  sections: SectionCommentary[]
}

async function fetchPropCommentary(year: string, number: string): Promise<PropCommentary | null> {
  // Step 1: Get dok_id
  const listUrl = `https://data.riksdagen.se/dokumentlista/?doktyp=prop&rm=${encodeURIComponent(year)}&nr=${number}&utformat=json`
  const listRes = await fetch(listUrl)
  const listData = await listRes.json()
  const doc = listData?.dokumentlista?.dokument?.[0]

  if (!doc) return null

  const dokId = doc.dok_id
  const title = doc.titel

  // Step 2: Fetch HTML
  const htmlUrl = `https://data.riksdagen.se/dokument/${dokId}.html`
  const htmlRes = await fetch(htmlUrl)
  const html = await htmlRes.text()

  const $ = cheerio.load(html)

  // Step 3: Extract paragraphs from Författningskommentar section
  let inFkSection = false
  const fkParagraphs: string[] = []

  $('p').each((_, el) => {
    const text = $(el).text().trim()

    if (text === '14 Författningskommentar') {
      inFkSection = true
      return
    }

    if (text.startsWith('Bilaga 1') || text.startsWith('Bilaga1')) {
      inFkSection = false
      return
    }

    if (inFkSection && text.length > 10) {
      fkParagraphs.push(text)
    }
  })

  // Step 4: Parse section commentaries
  // Pattern: "X §" paragraph followed by "Paragrafen..." commentary
  const sections: SectionCommentary[] = []
  let currentSection: { number: string; text: string } | null = null

  for (let i = 0; i < fkParagraphs.length; i++) {
    const p = fkParagraphs[i]

    // Check if this is a section header (starts with "X §" or "X a §")
    const sectionMatch = p.match(/^(\d+\s*[a-z]?\s*§)\s+(.+)/i)

    if (sectionMatch) {
      // Save the current section
      currentSection = {
        number: sectionMatch[1].trim(),
        text: sectionMatch[2].trim(),
      }
    }

    // Check if this is commentary (starts with "Paragrafen")
    if (currentSection && p.match(/^(Paragrafen|I paragrafen)/i)) {
      sections.push({
        sectionNumber: currentSection.number,
        sectionText: currentSection.text.substring(0, 200),
        commentary: p,
      })
      currentSection = null
    }
  }

  return {
    propRef: `Prop. ${year}:${number}`,
    dokId,
    title,
    law: '35 kap. brottsbalken', // Hardcoded for this example
    sections,
  }
}

async function main() {
  console.log('=== FETCHING PROP. 2024/25:59 ===\n')

  const result = await fetchPropCommentary('2024/25', '59')

  if (!result) {
    console.log('Failed to fetch')
    return
  }

  console.log(`Proposition: ${result.propRef}`)
  console.log(`Title: ${result.title}`)
  console.log(`dok_id: ${result.dokId}`)
  console.log(`\nExtracted ${result.sections.length} section commentaries:\n`)

  // Show all sections
  result.sections.forEach((s, i) => {
    console.log(`--- ${i + 1}. ${s.sectionNumber} ---`)
    console.log(`Law text: ${s.sectionText}...`)
    console.log(`Commentary: ${s.commentary.substring(0, 300)}...`)
    console.log()
  })

  // Show JSON structure for one section
  console.log('\n=== JSON OUTPUT EXAMPLE ===')
  console.log(
    JSON.stringify(
      {
        ...result,
        sections: result.sections.slice(0, 2),
      },
      null,
      2
    )
  )
}

main()
