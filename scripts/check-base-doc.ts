// Check what the API returns for a base document that was amended
async function main() {
  const sfsNumber = process.argv[2] || '2014:425'
  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&beteckning=${sfsNumber}&utformat=json`

  const res = await fetch(url)
  const data = await res.json()
  const doc = data.dokumentlista.dokument?.[0]

  if (!doc) {
    console.log('Document not found:', sfsNumber)
    return
  }

  console.log('='.repeat(60))
  console.log('API Response for SFS', sfsNumber)
  console.log('='.repeat(60))
  console.log('beteckning:', doc.beteckning)
  console.log('titel:', doc.titel)
  console.log('undertitel:', doc.undertitel || '(none)')
  console.log('systemdatum:', doc.systemdatum)
  console.log('publicerad:', doc.publicerad)
  console.log('datum:', doc.datum)
  console.log('')
  console.log('→ The "undertitel" field shows the latest amendment!')
}
main()
