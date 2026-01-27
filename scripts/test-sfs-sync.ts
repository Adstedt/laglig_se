/**
 * Test script to validate SFS sync logic
 * Run with: pnpm tsx scripts/test-sfs-sync.ts
 */

import { prisma } from '../lib/prisma'

async function testSfsSync() {
  console.log('=== SFS Sync Validation Test ===\n')

  // 1. Check database state
  console.log('1. Checking database state...')
  const totalDocs = await prisma.legalDocument.count({
    where: { content_type: 'SFS_LAW' },
  })
  console.log(`   Total SFS documents in DB: ${totalDocs}`)

  const recentDocs = await prisma.legalDocument.findMany({
    where: { content_type: 'SFS_LAW' },
    orderBy: { updated_at: 'desc' },
    take: 5,
    select: {
      document_number: true,
      title: true,
      updated_at: true,
      metadata: true,
    },
  })

  if (recentDocs.length > 0) {
    console.log('\n   Most recently updated SFS docs:')
    for (const doc of recentDocs) {
      const meta = doc.metadata as { systemdatum?: string } | null
      console.log(
        `   - ${doc.document_number}: ${doc.title.substring(0, 50)}...`
      )
      console.log(`     Updated: ${doc.updated_at?.toISOString()}`)
      console.log(`     Systemdatum: ${meta?.systemdatum || 'N/A'}`)
    }
  }

  // 2. Check Riksdagen API for latest updates
  console.log('\n2. Fetching latest from Riksdagen API...')
  const apiUrl =
    'https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=5&sort=systemdatum&sortorder=desc'

  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Laglig.se/1.0 (test script)',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    console.log(`   ERROR: API returned ${response.status}`)
    return
  }

  const data = await response.json()
  const apiDocs = data.dokumentlista.dokument || []

  console.log(`   Total SFS in API: ${data.dokumentlista['@traffar']}`)
  console.log('\n   Latest 5 updated in API:')

  for (const doc of apiDocs) {
    const sfsNumber = `SFS ${doc.beteckning}`
    console.log(`   - ${sfsNumber}: ${doc.titel.substring(0, 50)}...`)
    console.log(`     Systemdatum: ${doc.systemdatum}`)

    // Check if we have this in DB
    const existing = await prisma.legalDocument.findUnique({
      where: { document_number: sfsNumber },
      select: {
        id: true,
        metadata: true,
        updated_at: true,
      },
    })

    if (existing) {
      const meta = existing.metadata as { systemdatum?: string } | null
      const dbSystemdatum = meta?.systemdatum
      const needsUpdate = !dbSystemdatum || doc.systemdatum > dbSystemdatum
      console.log(`     In DB: YES (systemdatum: ${dbSystemdatum || 'N/A'})`)
      console.log(`     Needs update: ${needsUpdate ? 'YES' : 'NO'}`)
    } else {
      console.log(`     In DB: NO - would be INSERTED`)
    }
  }

  // 3. Check change events
  console.log('\n3. Checking recent ChangeEvents...')
  const recentChanges = await prisma.changeEvent.count({
    where: {
      content_type: 'SFS_LAW',
      detected_at: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
  })
  console.log(`   SFS change events in last 7 days: ${recentChanges}`)

  // 4. Summary
  console.log('\n=== Summary ===')
  if (totalDocs === 0) {
    console.log('WARNING: No SFS documents in database!')
    console.log(
      'The cron job will try to insert all documents, which will timeout.'
    )
    console.log('You need to run the initial ingestion script first.')
  } else if (totalDocs < 10000) {
    console.log(`WARNING: Only ${totalDocs} SFS docs in DB (API has ~11,400)`)
    console.log('The cron job may timeout trying to catch up.')
  } else {
    console.log('Database looks healthy for incremental sync.')
  }

  await prisma.$disconnect()
}

testSfsSync().catch(console.error)
