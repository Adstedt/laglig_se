import * as fs from 'fs'
import * as cheerio from 'cheerio'

// Check why AFS 2023:2 doesn't split — look at body structure
const html = fs.readFileSync('data/afs-review/AFS-2023-2.html', 'utf-8')
const $ = cheerio.load(html, { xml: false })

const $body = $('div.body')
console.log('div.body found:', $body.length)

if ($body.length === 0) {
  // Check what top-level structure exists
  console.log(
    'Top-level tags:',
    $('article')
      .children()
      .toArray()
      .map((n) => n.tagName || n.type)
      .join(', ')
  )
  process.exit(0)
}

// Check direct children
const children = $body.children().toArray()
console.log('body direct children:', children.length)

for (const node of children) {
  const tag = (node as any).tagName || ''
  const text = $(node).text().substring(0, 60).replace(/\n/g, ' ')
  if (tag === 'h2' || tag === 'h3' || tag === 'section') {
    console.log(
      `  <${tag}${$(node).attr('class') ? ' class="' + $(node).attr('class') + '"' : ''}> ${text}`
    )
  }
}

// Now check: does the splitter use .contents() or .children()?
// The splitter uses $body.contents().toArray() which includes text nodes
const contents = $body.contents().toArray()
console.log('\nbody contents (incl text):', contents.length)

// Check if h2s are wrapped in sections
const sections = $body.find('section')
console.log('sections in body:', sections.length)
sections.each((i, el) => {
  const cls = $(el).attr('class') || ''
  const firstChild = $(el).children().first()
  const tag = (firstChild[0] as any)?.tagName || ''
  const text = firstChild.text().substring(0, 50)
  console.log(`  section.${cls}: first child <${tag}> "${text}"`)
})
