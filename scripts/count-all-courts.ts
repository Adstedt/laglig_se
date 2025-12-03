/* eslint-disable no-console */
/**
 * Count all court cases by court type
 */

const courts = [
  { code: ['ADO'], name: 'AD (Arbetsdomstolen)' },
  { code: ['HDO'], name: 'HD (Högsta domstolen)' },
  { code: ['HFD'], name: 'HFD (Högsta förvaltningsdomstolen)' },
  { code: ['HSV'], name: 'Svea hovrätt' },
  { code: ['HGO'], name: 'Göta hovrätt' },
  { code: ['HVS'], name: 'Hovrätten för Västra Sverige' },
  { code: ['HSB'], name: 'Hovrätten över Skåne och Blekinge' },
  { code: ['HNN'], name: 'Hovrätten för Nedre Norrland' },
  { code: ['HON'], name: 'Hovrätten för Övre Norrland' },
  { code: ['MMOD'], name: 'Mark- och miljööverdomstolen' },
  { code: ['MIOD'], name: 'Migrationsöverdomstolen' },
  { code: ['KST'], name: 'Kammarrätten Stockholm' },
  { code: ['KGG'], name: 'Kammarrätten Göteborg' },
  { code: ['PMOD'], name: 'Patent- och marknadsöverdomstolen' },
]

async function main() {
  console.log('=== Court Case Counts ===\n')

  let total = 0
  let _totalTextSize = 0

  for (const court of courts) {
    const response = await fetch(
      'https://rattspraxis.etjanst.domstol.se/api/v1/sok',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sidIndex: 0,
          antalPerSida: 1,
          filter: { domstolKodLista: court.code },
        }),
      }
    )
    const data = await response.json()
    const count = data.total || 0
    total += count
    console.log(`${court.name}: ${count.toLocaleString()}`)
  }

  console.log(`\n--- TOTAL: ${total.toLocaleString()} cases ---`)

  // Estimate storage based on sample
  // From our test: avg ~11,000 chars full text + ~12,000 chars HTML = ~23KB per case
  const avgSizeKB = 25 // conservative estimate including metadata
  const totalSizeMB = (total * avgSizeKB) / 1024
  const totalSizeGB = totalSizeMB / 1024

  console.log(`\n=== Storage Estimate ===`)
  console.log(`Avg size per case: ~${avgSizeKB}KB`)
  console.log(`Estimated total: ~${totalSizeMB.toFixed(0)}MB (${totalSizeGB.toFixed(2)}GB)`)
}

main()
