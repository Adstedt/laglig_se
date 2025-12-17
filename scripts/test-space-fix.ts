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

const testText =
  'att arbets- miljösynpunkter beaktas och projekte- ring av och anlägg- ningsarbete'

console.log('Testing hyphen+space fix...')
console.log('Before:', testText)

const fixed = testText.replace(
  /([a-zåäöéü]+)- ([a-zåäöéü]+)/gi,
  (match, left, right) => {
    console.log(`  Match: "${match}" | Left: "${left}" | Right: "${right}"`)
    if (INTENTIONAL_CONJUNCTIONS.has(right.toLowerCase())) {
      console.log('    -> Skip (conjunction)')
      return match
    }
    if (INTENTIONAL_PREFIXES.has(left.toLowerCase())) {
      console.log('    -> Skip (prefix)')
      return match
    }
    console.log(`    -> Fix to: "${left}${right}"`)
    return left + right
  }
)

console.log('\nAfter:', fixed)
