import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Try exact match and partial matches
  const exact = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS N2025:20' },
    select: {
      id: true,
      document_number: true,
      title: true,
      content_type: true,
      html_content: true,
      slug: true,
      source_url: true,
      metadata: true,
      created_at: true,
      updated_at: true,
    },
  })

  if (exact) {
    console.log('FOUND exact match:')
    console.log(`  id: ${exact.id}`)
    console.log(`  document_number: ${exact.document_number}`)
    console.log(`  title: ${(exact.title || '').substring(0, 80)}`)
    console.log(`  content_type: ${exact.content_type}`)
    console.log(`  slug: ${exact.slug}`)
    console.log(`  source_url: ${exact.source_url}`)
    console.log(
      `  html_content: ${exact.html_content ? `${exact.html_content.length} chars` : 'NULL'}`
    )
    console.log(`  metadata: ${JSON.stringify(exact.metadata, null, 2)}`)
    console.log(`  created: ${exact.created_at.toISOString()}`)
    console.log(`  updated: ${exact.updated_at.toISOString()}`)

    if (exact.html_content) {
      console.log(`\n  First 800 chars of HTML:`)
      console.log(
        '  ' + exact.html_content.substring(0, 800).replace(/\n/g, '\n  ')
      )
    }
  } else {
    console.log('No exact match for "SFS N2025:20"')

    // Search with LIKE
    const similar = await prisma.legalDocument.findMany({
      where: {
        document_number: { contains: 'N2025:20' },
      },
      select: {
        document_number: true,
        title: true,
        content_type: true,
        html_content: true,
        slug: true,
      },
      take: 5,
    })

    if (similar.length > 0) {
      console.log(`\nSimilar matches:`)
      for (const d of similar) {
        console.log(
          `  ${d.document_number} | ${d.content_type} | slug=${d.slug} | html=${d.html_content ? d.html_content.length + ' chars' : 'NULL'}`
        )
      }
    }

    // Also check if there are any "N20" pattern docs
    const nDocs = await prisma.legalDocument.findMany({
      where: {
        document_number: { startsWith: 'SFS N' },
      },
      select: {
        document_number: true,
        title: true,
        html_content: true,
        slug: true,
      },
      take: 10,
    })

    if (nDocs.length > 0) {
      console.log(`\nDocs starting with "SFS N":`)
      for (const d of nDocs) {
        console.log(
          `  ${d.document_number} | slug=${d.slug} | html=${d.html_content ? d.html_content.length + ' chars' : 'NULL'} | ${(d.title || '').substring(0, 50)}`
        )
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
