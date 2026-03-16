import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // How many docs have these styled-component classes?
  const reactDocs = await prisma.$queryRaw<any[]>`
    SELECT document_number, title, LENGTH(html_content) as size,
      created_at, updated_at
    FROM legal_documents
    WHERE content_type = 'SFS_LAW'
      AND html_content LIKE '%sc-%'
      AND html_content LIKE '%class="sc-%'
    ORDER BY document_number
    LIMIT 20
  `

  console.log(`Docs with styled-component classes: ${reactDocs.length}`)
  for (const d of reactDocs) {
    console.log(
      `  ${d.document_number}: ${(d.title || '').substring(0, 50)} (${Number(d.size)} chars) created=${d.created_at.toISOString().substring(0, 10)}`
    )
  }

  // Also check: what does the raw API actually return for this doc?
  const num = '1907:15 s.1'
  const dokId = `sfs-${num.replace(':', '-').replace(/ /g, '-')}`
  console.log(`\nFetching from Riksdag API: dok_id = "${dokId}"`)
  const url = `https://data.riksdagen.se/dokument/${dokId}.html`
  console.log(`URL: ${url}`)

  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/html', 'User-Agent': 'Laglig.se/1.0' },
    })
    console.log(`HTTP ${res.status}`)
    if (res.ok) {
      const html = await res.text()
      console.log(`Raw response size: ${html.length}`)
      console.log(`Contains sc- classes: ${html.includes('class="sc-')}`)
      console.log(
        `Contains <a class="paragraf": ${html.includes('class="paragraf"')}`
      )
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      const body = bodyMatch?.[1] || html
      console.log(`\nBody (first 800 chars):`)
      console.log(body.substring(0, 800))
    }
  } catch (e: any) {
    console.log(`Error: ${e.message}`)
  }

  // Try the source_url from the DB record
  const dbDoc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1907:15 s.1' },
    select: { source_url: true, metadata: true },
  })
  console.log(`\nDB source_url: ${dbDoc?.source_url}`)
  console.log(`DB metadata: ${JSON.stringify(dbDoc?.metadata, null, 2)}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
