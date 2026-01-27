#!/usr/bin/env npx tsx

/**
 * Check for any gaps in our SFS document coverage by publication date
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function checkDateGaps() {
  console.log('🔍 Checking for gaps in SFS document coverage...\n')

  // Get latest 100 documents from API to check a wider range
  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('sz', '100')
  url.searchParams.set('sort', 'publicerad')
  url.searchParams.set('sortorder', 'desc')

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Laglig.se/1.0 (Legal research; contact@laglig.se)',
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`❌ API error: ${response.status}`)
      return
    }

    const data = await response.json()
    const documents = data.dokumentlista.dokument || []

    console.log(`📊 Checking ${documents.length} latest documents from API\n`)

    // Import prisma
    const { prisma } = await import('@/lib/prisma')

    let missingCount = 0
    const missingDocs: Array<{
      sfsNumber: string
      title: string
      publicerad: string
      datum: string
    }> = []

    for (const doc of documents) {
      if (!doc.beteckning) continue

      const sfsNumber = `SFS ${doc.beteckning}`
      const exists = await prisma.legalDocument.findUnique({
        where: { document_number: sfsNumber },
        select: { id: true },
      })

      if (!exists) {
        missingCount++
        missingDocs.push({
          sfsNumber,
          title: doc.titel,
          publicerad: doc.publicerad,
          datum: doc.datum,
        })
      }
    }

    console.log(`📈 Coverage Report:`)
    console.log(
      `  - Total checked: ${documents.filter((d) => d.beteckning).length}`
    )
    console.log(
      `  - In database: ${documents.filter((d) => d.beteckning).length - missingCount}`
    )
    console.log(`  - Missing: ${missingCount}`)
    console.log(
      `  - Coverage: ${((1 - missingCount / documents.filter((d) => d.beteckning).length) * 100).toFixed(1)}%\n`
    )

    if (missingDocs.length > 0) {
      console.log('❌ Missing documents:')
      missingDocs.forEach((doc) => {
        console.log(`  - ${doc.sfsNumber}`)
        console.log(`    Title: ${doc.title.substring(0, 60)}...`)
        console.log(`    Published: ${doc.publicerad}`)
        console.log(`    Date: ${doc.datum}`)
      })

      // Check date pattern
      console.log('\n📅 Date Analysis:')
      const sortedByDate = missingDocs.sort(
        (a, b) =>
          new Date(b.publicerad).getTime() - new Date(a.publicerad).getTime()
      )

      if (sortedByDate.length > 0) {
        const newest = new Date(sortedByDate[0].publicerad)
        const oldest = new Date(
          sortedByDate[sortedByDate.length - 1].publicerad
        )

        console.log(`  Newest missing: ${sortedByDate[0].publicerad}`)
        console.log(
          `  Oldest missing: ${sortedByDate[sortedByDate.length - 1].publicerad}`
        )
        console.log(
          `  Date range: ${Math.ceil((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))} days`
        )
      }
    } else {
      console.log('✅ Perfect coverage - no missing documents!')
    }

    // Check our most recent additions
    console.log('\n📊 Our Recent Additions:')
    const recentDocs = await prisma.legalDocument.findMany({
      where: { content_type: 'SFS_LAW' },
      orderBy: { created_at: 'desc' },
      take: 5,
      select: {
        document_number: true,
        title: true,
        created_at: true,
      },
    })

    recentDocs.forEach((doc) => {
      console.log(
        `  - ${doc.document_number} (added ${doc.created_at.toISOString()})`
      )
    })
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Run the check
checkDateGaps()
  .then(() => {
    console.log('\n✨ Gap analysis complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
