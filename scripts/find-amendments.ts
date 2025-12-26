// Find recent amendments in the Riksdagen API
async function main() {
  const url =
    'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=100&sort=publicerad&sortorder=desc'
  const res = await fetch(url)
  const data = await res.json()
  const docs = data.dokumentlista.dokument || []

  console.log('Recent SFS amendments (sorted by publicerad):')
  console.log('==============================================')

  let count = 0
  for (const d of docs) {
    if (d.titel.includes('ändring')) {
      console.log(
        `${d.publicerad} | SFS ${d.beteckning.padEnd(10)} | ${d.titel.substring(0, 70)}...`
      )
      count++
      if (count >= 15) break
    }
  }
  console.log(`\nFound ${count} amendments in first 100 documents`)
}
main()
