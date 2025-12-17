/**
 * Debug: Check the actual character encoding of hyphenation patterns
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const amendment = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: 'SFS 2002:585' },
    select: { full_text: true },
  })

  if (!amendment?.full_text) {
    console.log('No amendment found')
    return
  }

  const text = amendment.full_text
  console.log('Text length:', text.length)

  // Find position of 'änd-' in text
  const idx = text.indexOf('änd-')
  if (idx === -1) {
    console.log('Pattern "änd-" not found in text')
    console.log('First 300 chars:', JSON.stringify(text.substring(0, 300)))
    return
  }

  console.log('Found "änd-" at index', idx)

  // Get 15 chars around it
  const context = text.substring(idx, idx + 15)
  console.log('Context (JSON):', JSON.stringify(context))
  console.log('\nChar by char:')
  for (let i = 0; i < context.length; i++) {
    const char = context[i]
    const code = context.charCodeAt(i)
    const name = code === 10 ? 'LF' : code === 13 ? 'CR' : char
    console.log(`  [${i}] char="${name}" code=${code}`)
  }

  // Test different newline patterns
  console.log('\n=== Testing regex patterns ===')

  // Pattern with \n only
  const patternLF = /([a-zåäöéü]+)-\n([a-zåäöéü]+)/gi
  const matchesLF = text.match(patternLF)
  console.log('Pattern with \\n:', matchesLF?.length || 0, 'matches')

  // Pattern with \r\n
  const patternCRLF = /([a-zåäöéü]+)-\r\n([a-zåäöéü]+)/gi
  const matchesCRLF = text.match(patternCRLF)
  console.log('Pattern with \\r\\n:', matchesCRLF?.length || 0, 'matches')

  // Pattern with any whitespace
  const patternWS = /([a-zåäöéü]+)-\s+([a-zåäöéü]+)/gi
  const matchesWS = text.match(patternWS)
  console.log('Pattern with \\s+:', matchesWS?.length || 0, 'matches')
  if (matchesWS && matchesWS.length > 0) {
    console.log('First 5:', matchesWS.slice(0, 5))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
