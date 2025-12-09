/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function validate() {
  console.log('=== Validering av REPEALED-status ===\n')

  // Visa 10 slumpmässiga REPEALED-dokument med header
  const repealedSamples = await prisma.$queryRaw<any[]>`
    SELECT
      document_number,
      title,
      LEFT(full_text, 500) as header
    FROM legal_documents
    WHERE status = 'REPEALED'
    AND content_type = 'SFS_LAW'
    ORDER BY RANDOM()
    LIMIT 10
  `

  console.log('--- 10 slumpmässiga REPEALED-dokument ---\n')
  for (const doc of repealedSamples) {
    console.log(`📄 ${doc.document_number}: ${doc.title}`)
    // Extrahera Upphävd-datum om det finns
    const upphavdMatch = doc.header.match(/Upphävd:\s*\n?(\d{4}-\d{2}-\d{2})/i)
    const genomMatch = doc.header.match(/Författningen har upphävts genom:\s*\n?(SFS \d{4}:\d+)/i)
    if (upphavdMatch) console.log(`   Upphävd: ${upphavdMatch[1]}`)
    if (genomMatch) console.log(`   Genom: ${genomMatch[1]}`)
    console.log('')
  }

  // Kolla några kända gällande lagar för att säkerställa de INTE är REPEALED
  console.log('\n--- Verifiering av kända GÄLLANDE lagar ---\n')
  const knownActive = [
    'SFS 1982:80',   // LAS
    'SFS 1976:580',  // MBL
    'SFS 2005:551',  // Aktiebolagslagen
    'SFS 2018:218',  // Dataskyddslagen (GDPR)
    'SFS 1999:1078', // Bokföringslagen
    'SFS 2010:110',  // Socialförsäkringsbalken
  ]

  for (const sfs of knownActive) {
    const doc = await prisma.legalDocument.findFirst({
      where: { document_number: sfs },
      select: { title: true, status: true }
    })
    if (doc) {
      const icon = doc.status === 'ACTIVE' ? '✅' : '❌'
      console.log(`${icon} ${sfs}: ${doc.status} - ${doc.title}`)
    } else {
      console.log(`⚠️  ${sfs}: Finns ej i databasen`)
    }
  }

  // Statistik
  console.log('\n--- Statistik ---')
  const stats = await prisma.legalDocument.groupBy({
    by: ['status', 'content_type'],
    _count: true,
    orderBy: { _count: { _all: 'desc' } }
  })

  const sfsStats = stats.filter(s => s.content_type === 'SFS_LAW')
  console.log('\nSFS-lagar:')
  sfsStats.forEach(s => console.log(`  ${s.status}: ${s._count}`))
}

validate().finally(() => prisma.$disconnect())
