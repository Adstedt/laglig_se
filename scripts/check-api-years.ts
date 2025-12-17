/**
 * Check what Riksdagen API has for specific years
 */

async function checkYear(year: number) {
  const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1&rm=${year}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
      Accept: 'application/json',
    },
  })
  const data = await response.json()
  const count = parseInt(data.dokumentlista['@traffar'], 10) || 0
  return count
}

async function main() {
  const years = [1999, 2000, 2001, 2023, 2024, 2025]

  console.log('SFS laws in Riksdagen API by year:')
  for (const year of years) {
    const count = await checkYear(year)
    console.log(`  ${year}: ${count}`)
  }
}

main().catch(console.error)
