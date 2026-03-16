import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
import * as cheerio from 'cheerio'
import { scrapeAfsPage } from '../lib/agency/afs-scraper'
import { transformAfsHtml } from '../lib/agency/afs-html-transformer'
import { AFS_REGISTRY } from '../lib/agency/afs-registry'

async function main() {
  const doc = AFS_REGISTRY.find((d) => d.documentNumber === 'AFS 2023:10')
  if (!doc) throw new Error('Not found in registry')

  const outcome = await scrapeAfsPage(
    'https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/afs-202310/'
  )
  if (!outcome.success) throw new Error(outcome.error)
  const { html } = transformAfsHtml(outcome.data.provisionHtml, doc)

  const $ = cheerio.load(html)
  console.log('=== After transform, BEFORE split ===')
  console.log('section.kapitel:', $('section.kapitel').length)
  console.log('section.avdelning:', $('section.avdelning').length)
  console.log('h2.avdelning-rubrik:', $('h2.avdelning-rubrik').length)
  console.log('h3.kapitel-rubrik:', $('h3.kapitel-rubrik').length)
  console.log('h3.paragraph:', $('h3.paragraph').length)
  console.log('a.paragraf:', $('a.paragraf').length)
  console.log('p.text:', $('p.text').length)
  console.log('p (no class):', $('p:not([class])').length)

  // Check div.body direct children
  const bodyChildren = $('div.body').children()
  console.log('\ndiv.body direct children:', bodyChildren.length)
  bodyChildren.each((i, el) => {
    if (i < 10) {
      const tag = el.type === 'tag' ? (el as cheerio.Element).tagName : el.type
      const cls = $(el).attr('class') || ''
      const id = $(el).attr('id') || ''
      console.log(
        `  [${i}] <${tag} class="${cls}" id="${id}"> — text: ${$(el).text().substring(0, 60)}`
      )
    }
  })
}

main().catch(console.error)
