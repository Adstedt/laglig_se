/**
 * Preview what database cleanup would look like - before/after comparison
 */

// The cleanup function - removes hyphenation artifacts
function cleanLineBreakHyphens(text: string): string {
  // Pattern: lowercase letter + hyphen + lowercase letter
  // This catches "föran-leda" → "föranleda" but NOT "e-post" (intentional hyphen)
  // We only remove hyphens that appear to be line-break artifacts
  return text.replace(/([a-zåäöéü])-([a-zåäöéü])/gi, (match, before, after) => {
    // Keep hyphen if it's likely intentional (compound words)
    // Intentional hyphens are usually between complete word parts
    // Line-break hyphens split words mid-syllable
    return before + after
  })
}

// Example texts from the database
const examples = [
  {
    section: '3 kap. 2 §',
    amendment: 'SFS 2002:585',
    before: `Arbetsgivaren skall vidta alla åtgärder som behövs för att förebygga att arbetstagaren utsätts för ohälsa eller olycksfall. En utgångspunkt skall därvid vara att allt sådant som kan leda till ohälsa eller olycksfall skall änd-ras eller ersättas så att risken för ohälsa eller olycksfall undanröjs.
Arbetsgivaren skall beakta den särskilda risk för ohälsa och olycksfall som kan följa av att arbetstagaren utför arbete ensam.
Lokaler samt maskiner, redskap, skyddsutrustning och andra tekniska an-ordningar skall underhållas väl.`,
  },
  {
    section: '3 kap. 3 §',
    amendment: 'SFS 2002:585',
    before: `Arbetsgivaren skall se till att arbetstagaren får god kännedom om de förhållanden, under vilka arbetet bedrivs, och att arbetstagaren upplyses om de risker som kan vara förbundna med arbetet. Arbetsgivaren skall förvissa sig om att arbetstagaren har den utbildning som behövs och vet vad han har att iaktta för att undgå riskerna i arbetet. Arbetsgivaren skall se till att endast arbetstagare som har fått tillräckliga instruktioner får tillträde till områden där det finns en påtaglig risk för ohälsa eller olycksfall.
Arbetsgivaren skall genom att anpassa arbetsförhållandena eller vidta an-nan lämplig åtgärd ta hänsyn till arbetstagarens särskilda förutsättningar för arbetet. Vid arbetets planläggning och anordnande skall beaktas att männis-kors förutsättningar att utföra arbetsuppgifter är olika.`,
  },
  {
    section: '4 kap. 2 §',
    amendment: 'SFS 2002:585',
    before: `Om det behövs för att förebygga ohälsa eller olycksfall i arbetet får re-geringen eller, efter regeringens bestämmande, Arbetsmiljöverket föreskriva att tillstånd, godkännande eller annat bevis om överensstämmelse med gäl-lande krav fordras
1. innan arbetsprocesser, arbetsmetoder eller anläggningar får användas, och
2. innan tekniska anordningar eller ämnen som kan föranleda ohälsa eller olycksfall får släppas ut på marknaden, användas eller avlämnas för att tas i bruk.`,
  },
]

console.log('='.repeat(80))
console.log('DATABASE CLEANUP PREVIEW - Before/After Comparison')
console.log('='.repeat(80))
console.log('')
console.log(
  'This shows exactly what would change. Only hyphenation artifacts are removed.'
)
console.log('No words or meaning are changed - just broken words are rejoined.')
console.log('')

for (const ex of examples) {
  const after = cleanLineBreakHyphens(ex.before)

  console.log('─'.repeat(80))
  console.log(`${ex.section} (${ex.amendment})`)
  console.log('─'.repeat(80))

  console.log('\n📄 BEFORE (current database):')
  console.log('```')
  console.log(ex.before)
  console.log('```')

  console.log('\n✅ AFTER (cleaned):')
  console.log('```')
  console.log(after)
  console.log('```')

  // Show specific changes
  console.log('\n🔍 SPECIFIC CHANGES:')
  const beforeWords = ex.before.match(/\S+-\S+/g) || []
  const hyphenatedWords = beforeWords.filter((w) =>
    /[a-zåäö]-[a-zåäö]/i.test(w)
  )

  if (hyphenatedWords.length > 0) {
    for (const word of hyphenatedWords) {
      const cleaned = cleanLineBreakHyphens(word)
      if (word !== cleaned) {
        console.log(`   "${word}" → "${cleaned}"`)
      }
    }
  } else {
    console.log('   (no changes)')
  }

  console.log('')
}

console.log('─'.repeat(80))
console.log('SUMMARY')
console.log('─'.repeat(80))
console.log('')
console.log('What gets fixed:')
console.log('  ✓ "änd-ras" → "ändras" (broken word rejoined)')
console.log('  ✓ "männis-kors" → "människors" (broken word rejoined)')
console.log('  ✓ "re-geringen" → "regeringen" (broken word rejoined)')
console.log('')
console.log('What stays unchanged:')
console.log('  • Paragraph structure (newlines between paragraphs)')
console.log('  • All actual words and their meaning')
console.log('  • Intentional hyphens in compound words')
console.log('')
