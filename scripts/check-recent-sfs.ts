// Quick check of recent SFS documents
async function main() {
  const url =
    'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=20&sort=systemdatum&sortorder=desc'
  const res = await fetch(url)
  const data = await res.json()
  const docs = data.dokumentlista.dokument || []

  console.log('Recent SFS documents by systemdatum:')
  console.log('=====================================')
  for (const d of docs) {
    const title =
      d.titel.length > 55 ? d.titel.substring(0, 55) + '...' : d.titel
    console.log(`${d.systemdatum} | SFS ${d.beteckning.padEnd(10)} | ${title}`)
  }
}
main()
