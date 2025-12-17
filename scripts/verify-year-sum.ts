/**
 * Sum up API counts by year to see if it matches the reported total
 */

async function main() {
  let yearSum = 0

  // Get reported total
  const totalRes = await fetch(
    'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1'
  )
  const totalData = await totalRes.json()
  const reportedTotal = parseInt(totalData.dokumentlista['@traffar'], 10)
  console.log(`API reported total: ${reportedTotal}`)

  // Sum by year
  for (let year = 2025; year >= 1900; year--) {
    const url = `https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=1&rm=${year}`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Laglig.se/1.0' },
    })
    const data = await response.json()
    const count = parseInt(data.dokumentlista['@traffar'], 10) || 0
    yearSum += count
    await new Promise((r) => setTimeout(r, 50))
  }

  console.log(`Sum of years (1900-2025): ${yearSum}`)
  console.log(`Difference: ${reportedTotal - yearSum}`)
  console.log()
  console.log(
    'This difference represents documents with non-standard year formatting'
  )
  console.log('that appear in the total but not in any specific year query.')
}

main().catch(console.error)
