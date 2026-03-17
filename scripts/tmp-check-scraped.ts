import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import { scrapeAfsPage } from '../lib/agency/afs-scraper'
import * as cheerio from 'cheerio'

async function main() {
  const outcome = await scrapeAfsPage(
    'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202310/'
  )
  if (!outcome.success) {
    console.log('ERROR:', outcome.error)
    return
  }
  const html = outcome.data.provisionHtml
  const $ = cheerio.load(html)
  console.log('div.rules:', $('div.rules').length)
  console.log('div.preamble:', $('div.preamble').length)
  console.log(
    'div.transitionalregulations:',
    $('div.transitionalregulations').length
  )
  console.log('div.appendices:', $('div.appendices').length)

  // Show first few top-level children
  const topChildren = $.root().children().first().children()
  console.log('\nTop-level children:', topChildren.length)
  topChildren.each((i, el) => {
    if (i < 5) {
      const tag = el.type === 'tag' ? (el as cheerio.Element).tagName : el.type
      const cls = $(el).attr('class') || ''
      console.log(`  [${i}] <${tag} class="${cls}">`)
    }
  })
}

main().catch(console.error)
