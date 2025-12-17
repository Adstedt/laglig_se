/**
 * Test the hyphenation fix logic on actual patterns
 */

const INTENTIONAL_CONJUNCTIONS = new Set(['och', 'eller', 'samt', 'respektive'])

const testText = `arbetsmiljö-
frågor, får Ar verk-
samhet där ska arbets-
stället byggnads- eller`

console.log('='.repeat(60))
console.log('Testing hyphenation fix logic')
console.log('='.repeat(60))

console.log('\nOriginal text:')
console.log(JSON.stringify(testText))

// Apply the fix
const fixed = testText.replace(
  /([a-zåäöéü]+)-\n([a-zåäöéü]+)/gi,
  (match, left, right) => {
    console.log(`\n  Match: "${match.replace('\n', '↵')}"`)
    console.log(`    Left: "${left}", Right: "${right}"`)

    if (INTENTIONAL_CONJUNCTIONS.has(right.toLowerCase())) {
      console.log('    -> PRESERVE (conjunction)')
      return match // Keep original including newline for conjunctions
    }
    console.log(`    -> FIX to "${left}${right}"`)
    return left + right
  }
)

console.log('\n' + '='.repeat(60))
console.log('Fixed text:')
console.log(JSON.stringify(fixed))

console.log('\n' + '='.repeat(60))
console.log('Verification:')
console.log('='.repeat(60))

const checks = [
  {
    before: 'arbetsmiljö-↵frågor',
    after: 'arbetsmiljöfrågor',
    shouldFix: true,
  },
  { before: 'verk-↵samhet', after: 'verksamhet', shouldFix: true },
  { before: 'arbets-↵stället', after: 'arbetsstället', shouldFix: true },
  { before: 'byggnads- eller', after: 'byggnads- eller', shouldFix: false },
]

for (const check of checks) {
  if (check.shouldFix) {
    const ok = fixed.includes(check.after)
    console.log(`${ok ? '✓' : '✗'} "${check.before}" → "${check.after}"`)
  } else {
    // For preserved patterns, check it wasn't merged
    const ok = fixed.includes(check.after)
    console.log(
      `${ok ? '✓' : '✗'} "${check.before}" preserved as "${check.after}"`
    )
  }
}
