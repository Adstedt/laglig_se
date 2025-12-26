// Check if amendment documents exist in Riksdagen API vs only on svenskforfattningssamling.se
async function main() {
  const amendments = ['2025:1581', '2025:1580', '2025:1579', '2025:1578']

  console.log('Checking if amendment documents exist in Riksdagen API...\n')

  for (const sfs of amendments) {
    // Try to find in Riksdagen API
    const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&sz=10&utformat=json&sok=${sfs}`
    const res = await fetch(url)
    const data = await res.json()
    const count = parseInt(data.dokumentlista['@traffar'] || '0')
    const docs = data.dokumentlista.dokument || []

    // Check if any doc matches exactly
    const exactMatch = docs.find(
      (d: { beteckning: string; titel?: string }) => d.beteckning === sfs
    )

    console.log(`SFS ${sfs}:`)
    console.log(
      `  Riksdagen API: ${exactMatch ? '✓ FOUND' : '✗ NOT FOUND'} (${count} search results)`
    )

    if (exactMatch) {
      console.log(`    Title: ${exactMatch.titel}`)
    }

    // Check svenskforfattningssamling.se
    const sfsUrl = `https://svenskforfattningssamling.se/doc/${sfs.replace(':', '')}.html`
    try {
      const sfsRes = await fetch(sfsUrl, { method: 'HEAD' })
      console.log(
        `  svenskforfattningssamling.se: ${sfsRes.ok ? '✓ EXISTS' : '✗ NOT FOUND'} (${sfsRes.status})`
      )
    } catch (e) {
      console.log(`  svenskforfattningssamling.se: ✗ ERROR`)
    }
    console.log('')
  }

  // Also check a base document to see its undertitel
  console.log('---')
  console.log('Checking base document (2014:425) for undertitel...\n')
  const baseUrl = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&sz=100&utformat=json&sok=2014:425`
  const baseRes = await fetch(baseUrl)
  const baseData = await baseRes.json()
  const baseDocs = baseData.dokumentlista.dokument || []
  const baseDoc = baseDocs.find(
    (d: {
      beteckning: string
      titel?: string
      undertitel?: string
      systemdatum?: string
    }) => d.beteckning === '2014:425'
  )

  if (baseDoc) {
    console.log(`SFS 2014:425 (base document):`)
    console.log(`  Title: ${baseDoc.titel}`)
    console.log(`  Undertitel: ${baseDoc.undertitel || '(none)'}`)
    console.log(`  Systemdatum: ${baseDoc.systemdatum}`)
  }
}

main()
