import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { prisma } from '../lib/prisma'

async function main() {
  // Recent change events with document info
  const events = await prisma.changeEvent.findMany({
    orderBy: { detected_at: 'desc' },
    take: 20,
    include: {
      document: {
        select: { title: true, document_number: true, effective_date: true },
      },
    },
  })

  console.log('=== RECENT CHANGE EVENTS ===')
  for (const e of events) {
    const sections = (e.changed_sections as string[] | null)?.join(', ') || '-'
    console.log('')
    console.log('ID:', e.id)
    console.log('Type:', e.change_type)
    console.log('Amendment:', e.amendment_sfs || '-')
    console.log(
      'Law:',
      e.document.title,
      '(' + e.document.document_number + ')'
    )
    console.log('Effective:', e.document.effective_date || '-')
    console.log('Sections:', sections)
    console.log('Summary:', (e.ai_summary || '-').substring(0, 200))
    console.log('Detected:', e.detected_at)
    console.log('---')
  }

  console.log('\nTotal:', events.length, 'events')

  // Workspaces
  const workspaces = await prisma.workspace.findMany({
    take: 5,
    select: { id: true, name: true },
  })
  console.log('\n=== WORKSPACES ===')
  for (const w of workspaces) console.log(w.id + ':', w.name)

  // Law lists with item counts
  const lawLists = await prisma.lawList.findMany({
    take: 5,
    include: { _count: { select: { items: true } } },
  })
  console.log('\n=== LAW LISTS ===')
  for (const l of lawLists)
    console.log(l.id + ':', l.name, '(' + l._count.items + ' items)')

  // Law list items that match change event documents
  const eventDocIds = events.map((e) => e.document_id)
  const matchingItems = await prisma.lawListItem.findMany({
    where: { document_id: { in: eventDocIds } },
    include: {
      document: { select: { document_number: true, title: true } },
      law_list: { select: { name: true } },
    },
  })
  console.log('\n=== LAW LIST ITEMS MATCHING CHANGE EVENTS ===')
  for (const item of matchingItems) {
    console.log(
      item.id + ':',
      item.document.document_number,
      '|',
      item.document.title?.substring(0, 60),
      '| List:',
      item.law_list.name,
      '| Ack:',
      item.last_change_acknowledged_at || 'NOT ACKNOWLEDGED'
    )
  }

  // Company profiles
  const profiles = await prisma.companyProfile.findMany({ take: 3 })
  console.log('\n=== COMPANY PROFILES ===')
  for (const p of profiles) {
    console.log(
      p.id + ':',
      p.company_name,
      '|',
      p.industry_label,
      '| SNI:',
      p.sni_code,
      '| Emp:',
      p.employee_count_range
    )
    console.log('  Certifications:', p.certifications?.join(', ') || '-')
    console.log('  Maturity:', p.compliance_maturity)
    console.log('  Flags:', JSON.stringify(p.activity_flags))
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
