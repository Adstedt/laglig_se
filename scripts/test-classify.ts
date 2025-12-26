import { classifyLawType } from '../lib/sfs'

const titles = [
  'Förordning om ändring i förordningen (2014:425) om bekämpningsmedel',
  'Förordning om ändring i förordningen (2013:63) om bekämpningsmedelsavgifter',
  'Förordning om ändring i förordningen (1998:940) om avgifter',
  'Förordning (2014:425) om bekämpningsmedel', // New - for comparison
  'Lag (2025:100) om ändring i arbetsmiljölagen (1977:1160)', // Law amendment
]

console.log('Testing classification of förordning amendments:\n')

for (const title of titles) {
  const result = classifyLawType(title)
  console.log(
    'Title:',
    title.substring(0, 65) + (title.length > 65 ? '...' : '')
  )
  console.log(
    '  → Type:',
    result.type,
    '| Category:',
    result.category,
    '| Target:',
    result.targetSfs
  )
  console.log('')
}
