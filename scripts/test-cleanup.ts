import { cleanPdfArtifacts } from '../lib/sfs/clean-pdf-artifacts'

const text = `enhet i 6 § första stycket 1 Prop. 2025/26:22, bet. 2025/26:SkU5, rskr. 2025/26:95. 2 Senaste lydelse av 7 kap. 25 § 2024:1248 7 kap. 63 d § 2024:1248. 3 Senaste lydelse 2024:1248. SFS 2025:1461 Publicerad den 10 december 2025 SFS 2025:14612 fast driftställe i 7 kap. 17 §`

console.log('=== ORIGINAL ===')
console.log(text)
console.log('')
console.log('=== CLEANED ===')
console.log(cleanPdfArtifacts(text))
