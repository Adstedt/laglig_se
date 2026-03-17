/**
 * Verify SFS law normalization by fetching fresh from Riksdag API
 * and comparing with what's stored in DB.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function fetchFromRiksdag(sfsNumber: string): Promise<string | null> {
  // Convert "SFS 1977:1160" to riksdag dok_id format "sfs-1977-1160"
  const num = sfsNumber.replace('SFS ', '')
  const dokId = `sfs-${num.replace(':', '-')}`
  const url = `https://data.riksdagen.se/dokument/${dokId}.html`

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Laglig.se/1.0 (https://laglig.se)',
      },
    })
    if (!res.ok) {
      console.log(`  HTTP ${res.status} for ${url}`)
      return null
    }
    const html = await res.text()
    // Extract body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    return (bodyMatch?.[1] || html).trim()
  } catch (e: any) {
    console.log(`  Fetch error: ${e.message}`)
    return null
  }
}

function structuralFingerprint(html: string) {
  return {
    size: html.length,
    hasArticleWrapper: html.includes('<article class="legal-document"'),
    hasOldSfsWrapper: html.includes('<article class="sfs"'),
    hasLovhead: html.includes('class="lovhead"'),
    hasBody: html.includes('class="body"'),
    hasSectionKapitel: html.includes('class="kapitel"'),
    hasKapitelRubrik: html.includes('class="kapitel-rubrik"'),
    hasH3Paragraph: html.includes('class="paragraph"'),
    hasAParagraf: html.includes('class="paragraf"'),
    hasPText: html.includes('class="text"'),
    hasFooterBack: html.includes('class="back"'),
    // Old Riksdag patterns
    hasOldBoldParagraf: /<b>\d+[a-z]?\s*§<\/b>/.test(html),
    hasOldNameK: /<a\s+name="K\d/.test(html),
    hasOldNameS: /<a\s+name="K\d+P\d+S\d/.test(html),
    // Count structural elements
    paragrafCount: (html.match(/class="paragraf"/g) || []).length,
    kapitelCount: (html.match(/class="kapitel"/g) || []).length,
    pTextCount: (html.match(/class="text"/g) || []).length,
  }
}

async function compareDoc(sfsNumber: string) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`${sfsNumber}`)
  console.log('='.repeat(70))

  // Fetch from DB
  const dbDoc = await prisma.legalDocument.findFirst({
    where: { document_number: sfsNumber },
    select: { html_content: true, title: true },
  })

  if (!dbDoc?.html_content) {
    console.log('  NOT IN DB')
    return
  }

  // Fetch fresh from Riksdag
  const rawHtml = await fetchFromRiksdag(sfsNumber)
  if (!rawHtml) {
    console.log('  COULD NOT FETCH FROM RIKSDAG')
    return
  }

  const raw = structuralFingerprint(rawHtml)
  const db = structuralFingerprint(dbDoc.html_content)

  console.log(`  Title: ${(dbDoc.title || '').substring(0, 60)}`)
  console.log('')
  console.log('  Property                 Riksdag (raw)     DB (normalized)')
  console.log('  ' + '-'.repeat(66))
  console.log(
    `  Size                     ${String(raw.size).padEnd(18)}${db.size}`
  )
  console.log(
    `  article.legal-document   ${String(raw.hasArticleWrapper).padEnd(18)}${db.hasArticleWrapper}`
  )
  console.log(
    `  div.lovhead              ${String(raw.hasLovhead).padEnd(18)}${db.hasLovhead}`
  )
  console.log(
    `  div.body                 ${String(raw.hasBody).padEnd(18)}${db.hasBody}`
  )
  console.log(
    `  section.kapitel          ${String(raw.hasSectionKapitel).padEnd(18)}${db.hasSectionKapitel}`
  )
  console.log(
    `  h2.kapitel-rubrik        ${String(raw.hasKapitelRubrik).padEnd(18)}${db.hasKapitelRubrik}`
  )
  console.log(
    `  h3.paragraph             ${String(raw.hasH3Paragraph).padEnd(18)}${db.hasH3Paragraph}`
  )
  console.log(
    `  a.paragraf               ${String(raw.hasAParagraf).padEnd(18)}${db.hasAParagraf}`
  )
  console.log(
    `  p.text                   ${String(raw.hasPText).padEnd(18)}${db.hasPText}`
  )
  console.log(
    `  footer.back              ${String(raw.hasFooterBack).padEnd(18)}${db.hasFooterBack}`
  )
  console.log(
    `  Old <b>§</b>             ${String(raw.hasOldBoldParagraf).padEnd(18)}${db.hasOldBoldParagraf}`
  )
  console.log(
    `  Old <a name="K..">       ${String(raw.hasOldNameK).padEnd(18)}${db.hasOldNameK}`
  )
  console.log(
    `  Old <a name="K..P..S.."> ${String(raw.hasOldNameS).padEnd(18)}${db.hasOldNameS}`
  )
  console.log(
    `  # paragraf anchors       ${String(raw.paragrafCount).padEnd(18)}${db.paragrafCount}`
  )
  console.log(
    `  # kapitel sections       ${String(raw.kapitelCount).padEnd(18)}${db.kapitelCount}`
  )
  console.log(
    `  # p.text elements        ${String(raw.pTextCount).padEnd(18)}${db.pTextCount}`
  )

  // Show first 500 chars of each
  console.log('\n  --- RAW (first 500 chars) ---')
  console.log('  ' + rawHtml.substring(0, 500).replace(/\n/g, '\n  '))
  console.log('\n  --- DB (first 500 chars) ---')
  console.log(
    '  ' + dbDoc.html_content.substring(0, 500).replace(/\n/g, '\n  ')
  )
}

async function main() {
  // Mix of doc types:
  // 1. Big chaptered law
  // 2. Medium chaptered law
  // 3. Small flat law
  // 4. One of the "partial" 47
  const testDocs = [
    'SFS 1977:1160', // Arbetsmiljölagen - big, chaptered
    'SFS 2018:1472', // Lag om entreprenörsansvar - medium
    'SFS 1962:516', // Small flat law
    'SFS 2020:1010', // One of the 47 partial
    'SFS 2010:110', // Socialförsäkringsbalken - huge, avdelningar
  ]

  for (const doc of testDocs) {
    await compareDoc(doc)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
