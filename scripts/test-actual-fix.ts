import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const INTENTIONAL_CONJUNCTIONS = new Set(['och', 'eller', 'samt', 'respektive'])
const INTENTIONAL_PREFIXES = new Set([
  'e',
  'f',
  'i',
  'a',
  'u',
  'n',
  'eu',
  'it',
  'tv',
  'ce',
  'uk',
  'us',
  'icke',
  'själv',
  'semi',
  'anti',
  'pre',
  'post',
  'ex',
  'vice',
  'lss',
  'mrv',
  'aif',
  'euf',
  'nis',
  'dna',
  'rna',
  'hiv',
  'bnp',
  'gdp',
  'csirt',
  'safe',
  'glp',
  'goc',
  'roc',
  'otc',
  'esf',
  'euf',
  'fatca',
  'atpl',
  'nace',
  'pair',
  'novo',
  'dals',
  'öster',
])

function applyFixes(text: string): string {
  let result = text

  // Fix hyphen+space directly
  result = result.replace(
    /([a-zåäöéü]+)- ([a-zåäöéü]+)/gi,
    (match, left, right) => {
      if (INTENTIONAL_CONJUNCTIONS.has(right.toLowerCase())) {
        return match
      }
      if (INTENTIONAL_PREFIXES.has(left.toLowerCase())) {
        return match
      }
      console.log(`  Fixing: "${match}" → "${left}${right}"`)
      return left + right
    }
  )

  return result
}

async function main() {
  const section = await prisma.sectionChange.findFirst({
    where: {
      amendment: { sfs_number: 'SFS 2008:934' },
      chapter: '3',
      section: '6',
    },
    select: { id: true, new_text: true },
  })

  if (!section?.new_text) {
    console.log('Section not found')
    return
  }

  console.log('=== Testing on actual database text ===')
  console.log('Text length:', section.new_text.length)

  // Check for hyphen+space patterns
  const patterns = section.new_text.match(/[a-zåäö]+- [a-zåäö]+/gi) || []
  console.log('Hyphen+space patterns found:', patterns.length)
  console.log('Patterns:', patterns)

  console.log('\nApplying fix...')
  const fixed = applyFixes(section.new_text)

  if (fixed !== section.new_text) {
    console.log('\n✓ Text was changed!')
    console.log('Would need to update database')
  } else {
    console.log('\n✗ No changes detected')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
