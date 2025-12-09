/* eslint-disable no-console */
/**
 * Show all data created for a law
 */

import { prisma } from '../lib/prisma'

const DOC_NUMBER = process.argv[2] || 'SFS 1977:1160'

async function showData() {
  const law = await prisma.legalDocument.findFirst({
    where: { document_number: { contains: DOC_NUMBER.replace('SFS ', '') } },
    select: {
      id: true,
      document_number: true,
      title: true,
    },
  })

  if (!law) {
    console.log('Law not found')
    return
  }

  console.log('═'.repeat(70))
  console.log('LAW:', law.title)
  console.log('Document Number:', law.document_number)
  console.log('ID:', law.id)
  console.log('═'.repeat(70))

  // Get version records
  console.log('\n📄 DOCUMENT VERSIONS (document_versions table)')
  console.log('-'.repeat(70))
  const versions = await prisma.documentVersion.findMany({
    where: { document_id: law.id },
    orderBy: { version_number: 'asc' },
    select: {
      id: true,
      version_number: true,
      amendment_sfs: true,
      source_systemdatum: true,
      created_at: true,
      full_text: true,
    },
  })

  if (versions.length === 0) {
    console.log('  (none)')
  } else {
    for (const v of versions) {
      console.log(`  Version ${v.version_number}:`)
      console.log(`    ID: ${v.id}`)
      console.log(`    Amendment SFS: ${v.amendment_sfs || '(initial)'}`)
      console.log(`    Systemdatum: ${v.source_systemdatum || 'N/A'}`)
      console.log(`    Text length: ${v.full_text?.length || 0} chars`)
      console.log(`    Created: ${v.created_at}`)
    }
  }

  // Get amendments
  console.log('\n📝 AMENDMENTS (amendments table)')
  console.log('-'.repeat(70))
  const amendments = await prisma.amendment.findMany({
    where: { base_document_id: law.id },
    orderBy: { amending_law_title: 'desc' },
    select: {
      id: true,
      amending_law_title: true,
      effective_date: true,
      affected_sections: true,
      detected_method: true,
      summary: true,
    },
  })

  if (amendments.length === 0) {
    console.log('  (none)')
  } else {
    console.log(`  Total: ${amendments.length} amendments\n`)
    for (const a of amendments.slice(0, 10)) {
      const sections = a.affected_sections as { amended?: string[] } | null
      const sectionList = sections?.amended?.slice(0, 5).join(', ') || 'N/A'
      console.log(`  ${a.amending_law_title}:`)
      console.log(`    Sections: ${sectionList}${(sections?.amended?.length || 0) > 5 ? '...' : ''}`)
      console.log(`    Method: ${a.detected_method}`)
    }
    if (amendments.length > 10) {
      console.log(`  ... and ${amendments.length - 10} more`)
    }
  }

  // Get change events
  console.log('\n🔔 CHANGE EVENTS (change_events table)')
  console.log('-'.repeat(70))
  const changeEvents = await prisma.changeEvent.findMany({
    where: { document_id: law.id },
    orderBy: { detected_at: 'desc' },
    select: {
      id: true,
      change_type: true,
      amendment_sfs: true,
      detected_at: true,
      ai_summary: true,
    },
  })

  if (changeEvents.length === 0) {
    console.log('  (none - populated when daily sync detects changes)')
  } else {
    for (const e of changeEvents) {
      console.log(`  ${e.change_type}: ${e.amendment_sfs || 'N/A'}`)
      console.log(`    Detected: ${e.detected_at}`)
      if (e.ai_summary) console.log(`    Summary: ${e.ai_summary.substring(0, 100)}...`)
    }
  }

  console.log('\n' + '═'.repeat(70))
  console.log('HOW TO USE THIS DATA:')
  console.log('═'.repeat(70))
  console.log(`
1. VERSION HISTORY
   - Shows the law's content at different points in time
   - Future: Compare versions to see what changed
   - Future: "View as of date X" feature

2. AMENDMENTS
   - List all laws that have modified this law
   - Shows which sections were affected by each amendment
   - Can be displayed on the law page: "Senaste ändringar"
   - Future: Generate AI summaries of what changed

3. CHANGE EVENTS (future use)
   - Created by daily sync when law is updated
   - Powers user notifications: "Law X was updated"
   - Feeds into change monitoring dashboard
`)

  await prisma.$disconnect()
}

showData()
