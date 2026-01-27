/**
 * Fetch proposition in TEXT format (cleaner than HTML)
 */

async function main() {
  const url = 'https://data.riksdagen.se/dokument/HC0359.text'
  console.log(`Fetching: ${url}\n`)

  const res = await fetch(url)
  const text = await res.text()

  console.log(`Total length: ${text.length} chars\n`)

  // Find Författningskommentar section
  const fkStart = text.indexOf('14 Författningskommentar')
  const fkEnd = text.indexOf('Bilaga 1', fkStart)

  if (fkStart > 0) {
    const fkSection = text.substring(
      fkStart,
      fkEnd > 0 ? fkEnd : fkStart + 20000
    )

    console.log('=== FÖRFATTNINGSKOMMENTAR SECTION ===')
    console.log(
      `Found at position ${fkStart}, length: ${fkSection.length} chars\n`
    )

    // Show first 2000 chars
    console.log(fkSection.substring(0, 2000))

    console.log('\n\n=== LOOKING FOR 35 KAP SECTIONS ===\n')

    // Find "35 kap. 1 §" pattern
    const section1Match = fkSection.match(
      /35\s*kap\.\s*1\s*§([\s\S]{0,1000}?)(?=35\s*kap\.\s*2\s*§|$)/i
    )
    if (section1Match) {
      console.log('--- 35 kap. 1 § ---')
      console.log(section1Match[0].substring(0, 600))
    }

    const section2Match = fkSection.match(
      /35\s*kap\.\s*2\s*§([\s\S]{0,1000}?)(?=35\s*kap\.\s*3\s*§|$)/i
    )
    if (section2Match) {
      console.log('\n--- 35 kap. 2 § ---')
      console.log(section2Match[0].substring(0, 600))
    }
  } else {
    console.log('Could not find Författningskommentar section')

    // Show what we have around position 350000
    console.log('\n=== SAMPLE FROM MIDDLE OF DOCUMENT ===')
    console.log(text.substring(200000, 202000))
  }
}

main()
