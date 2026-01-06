import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:1461' },
    select: { full_text: true }
  })

  if (doc?.full_text) {
    // Test the regex directly on the definition section
    const start = doc.full_text.indexOf('nedan angivna paragrafer:')
    const end = doc.full_text.indexOf('Värdet beträffande tilläggsskatt')
    if (start !== -1 && end !== -1) {
      const defSection = doc.full_text.substring(start + 25, end)

      console.log('=== Testing regex on definition section ===\n')

      // The pattern from the parser
      const defPattern = /([a-zåäö][a-zåäö\s\-–]+?)\s+i\s+((?:\d+\s*kap\.\s*)?\d+(?:\s*[a-z])?\s*(?:–\d+(?:\s*[a-z])?\s*)?§§?(?:\s+(?:första|andra|tredje)\s+stycket)?)/gi

      let match
      let count = 0
      while ((match = defPattern.exec(defSection)) !== null) {
        count++
        if (count <= 20) {
          console.log(`${count}. "${match[1].trim()}" → ${match[2].trim()}`)
        }
      }
      console.log(`\nTotal matches: ${count}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(console.error)
