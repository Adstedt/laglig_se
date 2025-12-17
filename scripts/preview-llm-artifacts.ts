/**
 * Preview what LLM artifact patterns would be fixed/skipped
 */
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
  // Common Swedish legal/regulatory abbreviations
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
const brokenWordEndings = [
  'mitté',
  'ning',
  'het',
  'else',
  'ande',
  'tion',
  'erna',
  'aren',
  'arna',
  'ighet',
]

async function main() {
  console.log('Scanning section changes for LLM artifact patterns...\n')

  const changes = await prisma.sectionChange.findMany({
    where: { new_text: { not: null } },
    select: { new_text: true },
    take: 5000,
  })

  const wouldFix = new Map<string, number>()
  const wouldSkip = new Map<string, string>()

  for (const c of changes) {
    if (!c.new_text) continue
    const pattern = /([a-zåäöéü]{3,})-([a-zåäöéü]{3,})/gi
    let match
    while ((match = pattern.exec(c.new_text)) !== null) {
      const left = match[1].toLowerCase()
      const right = match[2].toLowerCase()
      const full = `${left}-${right}`

      if (INTENTIONAL_CONJUNCTIONS.has(right)) {
        wouldSkip.set(full, `conjunction: ${right}`)
        continue
      }
      if (INTENTIONAL_PREFIXES.has(left)) {
        wouldSkip.set(full, `prefix: ${left}`)
        continue
      }

      const looksLikeBrokenWord = brokenWordEndings.some((e) =>
        right.endsWith(e)
      )
      if (looksLikeBrokenWord) {
        wouldFix.set(full, (wouldFix.get(full) || 0) + 1)
      } else {
        wouldSkip.set(full, 'no broken ending')
      }
    }
  }

  console.log('='.repeat(60))
  console.log('WOULD FIX (top 30)')
  console.log('='.repeat(60))
  const sorted = [...wouldFix.entries()].sort((a, b) => b[1] - a[1])
  for (const [word, count] of sorted.slice(0, 30)) {
    console.log(`  "${word}" → "${word.replace('-', '')}" (${count}x)`)
  }
  console.log(`\nTotal unique patterns to fix: ${wouldFix.size}`)

  console.log('\n' + '='.repeat(60))
  console.log('WOULD SKIP (samples)')
  console.log('='.repeat(60))
  const skipped = [...wouldSkip.entries()].slice(0, 30)
  for (const [word, reason] of skipped) {
    console.log(`  "${word}" - ${reason}`)
  }
  console.log(`\nTotal unique patterns skipped: ${wouldSkip.size}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
