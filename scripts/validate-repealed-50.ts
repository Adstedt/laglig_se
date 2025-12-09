/* eslint-disable no-console */
import { prisma } from '../lib/prisma'

async function validate() {
  console.log('=== Validering av 50 slumpmässiga REPEALED-dokument ===\n')

  const repealedSamples = await prisma.$queryRaw<any[]>`
    SELECT
      document_number,
      title,
      LEFT(full_text, 600) as header
    FROM legal_documents
    WHERE status = 'REPEALED'
    AND content_type = 'SFS_LAW'
    ORDER BY RANDOM()
    LIMIT 50
  `

  let valid = 0
  let invalid = 0
  const invalidDocs: string[] = []

  for (const doc of repealedSamples) {
    const hasUpphavd = /Upphävd:\s*\n?\d{4}-\d{2}-\d{2}/i.test(doc.header)
    const hasGenom = /Författningen har upphävts genom:\s*\n?SFS \d{4}:\d+/i.test(doc.header)

    if (hasUpphavd && hasGenom) {
      valid++
      console.log(`✅ ${doc.document_number}`)
    } else {
      invalid++
      invalidDocs.push(doc.document_number)
      console.log(`❌ ${doc.document_number} - Upphävd: ${hasUpphavd}, Genom: ${hasGenom}`)
      console.log(`   Titel: ${doc.title}`)
      console.log(`   Header: ${doc.header.substring(0, 300)}...`)
      console.log('')
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`RESULTAT: ${valid}/50 validerade korrekt (${Math.round(valid/50*100)}%)`)
  console.log(`Ogiltiga: ${invalid}`)
  if (invalidDocs.length > 0) {
    console.log('Ogiltiga dokument:', invalidDocs.join(', '))
  }
}

validate().finally(() => prisma.$disconnect())
