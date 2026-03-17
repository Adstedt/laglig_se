import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  // Use Riksdag document API to get raw HTML
  const apiUrl = 'https://data.riksdagen.se/dokument/sfs-2025-1535.html'
  console.log('Fetching from Riksdag API...')
  const res = await fetch(apiUrl)
  const html = await res.text()
  console.log(`Got ${html.length} chars`)

  // Find the overgang anchor
  const overgangIdx = html.indexOf('name="overgang"')
  if (overgangIdx > -1) {
    console.log('\n=== Around overgang anchor (500 before, 1000 after) ===')
    console.log(html.substring(overgangIdx - 500, overgangIdx + 1000))
  } else {
    console.log('No overgang anchor found')
    // Show last 2000 chars
    console.log('\n=== Last 2000 chars ===')
    console.log(html.substring(html.length - 2000))
  }
}
main().catch(console.error)
