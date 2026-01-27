#!/usr/bin/env npx tsx

/**
 * Check the latest laws from Riksdagen API directly
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function checkRiksdagenApi() {
  console.log('🔍 Checking latest laws from Riksdagen API...\n')

  const url = new URL('https://data.riksdagen.se/dokumentlista/')
  url.searchParams.set('doktyp', 'sfs')
  url.searchParams.set('utformat', 'json')
  url.searchParams.set('sz', '10') // Get latest 10
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
    const totalCount = parseInt(data.dokumentlista['@traffar'], 10) || 0

    console.log(`📊 Total SFS documents in API: ${totalCount}`)
    console.log(`📋 Showing latest ${documents.length} by publication date:\n`)

    documents.forEach(
      (
        doc: {
          beteckning?: string
          titel: string
          publicerad: string
          datum: string
          systemdatum: string
        },
        index: number
      ) => {
        console.log(`${index + 1}. SFS ${doc.beteckning || '(no number)'}`)
        console.log(`   Title: ${doc.titel}`)
        console.log(`   Published: ${doc.publicerad}`)
        console.log(`   Date: ${doc.datum}`)
        console.log(`   System date: ${doc.systemdatum}`)
        console.log('')
      }
    )

    // Now check our database
    console.log('📂 Checking our database for these documents...\n')

    // Import prisma dynamically
    const { prisma } = await import('@/lib/prisma')

    for (const doc of documents) {
      if (!doc.beteckning) continue

      const sfsNumber = `SFS ${doc.beteckning}`
      const exists = await prisma.legalDocument.findUnique({
        where: { document_number: sfsNumber },
        select: {
          id: true,
          document_number: true,
          created_at: true,
          updated_at: true,
        },
      })

      if (exists) {
        console.log(`✅ ${sfsNumber} - EXISTS in DB`)
        console.log(`   Created: ${exists.created_at.toISOString()}`)
      } else {
        console.log(`❌ ${sfsNumber} - MISSING from DB`)
        console.log(`   Title: ${doc.titel}`)
      }
    }

    // Check the oldest in our recent fetch
    console.log('\n📆 Checking date range coverage...')
    const oldestPublicerad = documents[documents.length - 1]?.publicerad
    if (oldestPublicerad) {
      console.log(`Oldest in this batch: ${oldestPublicerad}`)

      // Check how many we have from the last week
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const recentCount = await prisma.legalDocument.count({
        where: {
          content_type: 'SFS_LAW',
          created_at: {
            gte: oneWeekAgo,
          },
        },
      })

      console.log(`Documents added in last 7 days: ${recentCount}`)
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Run the check
checkRiksdagenApi()
  .then(() => {
    console.log('\n✨ Check complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
