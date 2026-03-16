import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'
const p = new PrismaClient()

async function main() {
  console.log('Starting...')
  const doc = await p.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: { html_content: true, document_number: true },
  })
  console.log(
    'Doc found:',
    !!doc,
    'html length:',
    doc?.html_content?.length || 0
  )
  if (!doc || !doc.html_content) {
    console.log('No document or no html_content found')
    return
  }
  const html = doc.html_content
  const ch = cheerio.load(html)

  console.log('=== ALL section.kapitel elements ===')
  ch('section.kapitel').each((i, el) => {
    const id = ch(el).attr('id') || '(no id)'
    const h2 = ch(el).find('h2').first()
    const h2Text = h2.text().trim() || '(no h2 text)'
    const h2Class = h2.attr('class') || '(no class)'
    const h3Count = ch(el).find('h3').length
    const childTags: string[] = []
    ch(el)
      .children()
      .each((_: number, c: any) => {
        childTags.push(
          ch(c).prop('tagName') + (ch(c).attr('class') || '').substring(0, 30)
        )
      })
    console.log(
      '  [' +
        i +
        '] id=' +
        id +
        '  h2=' +
        h2Text.substring(0, 60) +
        '  h2class=' +
        h2Class +
        '  h3s=' +
        h3Count
    )
    console.log('       children: ' + childTags.slice(0, 8).join(', '))
  })

  console.log('')
  console.log('=== h3 elements with id inside section.kapitel (first 10) ===')
  ch('section.kapitel h3[id]')
    .slice(0, 10)
    .each((i: number, el: any) => {
      const id = ch(el).attr('id')
      const text = ch(el).text().trim().substring(0, 40)
      const cls = ch(el).attr('class') || ''
      console.log('  h3 id=' + id + ' class=' + cls + ' text=' + text)
    })

  console.log('')
  console.log('=== h3 WITHOUT id inside section.kapitel (first 10) ===')
  ch('section.kapitel h3:not([id])')
    .slice(0, 10)
    .each((i: number, el: any) => {
      const text = ch(el).text().trim().substring(0, 40)
      const cls = ch(el).attr('class') || ''
      const aId = ch(el).find('a.paragraf').attr('id') || '(no a.paragraf id)'
      console.log(
        '  h3 class=' + cls + ' text=' + text + ' a.paragraf.id=' + aId
      )
    })

  console.log('')
  console.log('=== Raw HTML of first section.kapitel (800 chars) ===')
  const firstSection = ch('section.kapitel').first()
  const rawHtml = ch.html(firstSection)
  console.log(rawHtml.substring(0, 800))
}
main()
  .catch((e) => console.error('ERROR:', e))
  .finally(() => p.$disconnect())
