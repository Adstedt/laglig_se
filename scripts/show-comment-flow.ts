/**
 * Demo: Show the flow from amendment → legislative refs → Riksdag API
 * This is the foundation for Story 9.1 Legal Comment Generation
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Step 1: Get an amendment
  const amendment = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 2025:151' },
    select: { id: true, document_number: true, title: true },
  })

  if (!amendment) {
    console.log('Amendment not found')
    return
  }

  console.log('=' .repeat(70))
  console.log('STEP 1: AMENDMENT')
  console.log('=' .repeat(70))
  console.log(`Document: ${amendment.document_number}`)
  console.log(`Title: ${amendment.title}`)

  // Step 2: Get legislative references
  const refs = await prisma.legislativeRef.findMany({
    where: { legal_document_id: amendment.id },
    select: { ref_type: true, reference: true, year: true, number: true },
  })

  console.log('\n' + '=' .repeat(70))
  console.log('STEP 2: LEGISLATIVE REFERENCES (from legislative_refs table)')
  console.log('=' .repeat(70))
  console.log('ref_type | reference            | year     | number')
  console.log('-'.repeat(60))
  for (const r of refs) {
    console.log(`${r.ref_type.padEnd(8)} | ${r.reference.padEnd(20)} | ${r.year.padEnd(8)} | ${r.number}`)
  }

  // Step 3: Build Riksdag API URLs
  console.log('\n' + '=' .repeat(70))
  console.log('STEP 3: RIKSDAG API URLS')
  console.log('=' .repeat(70))

  for (const r of refs) {
    const doktyp = r.ref_type.toLowerCase()
    const rm = encodeURIComponent(r.year)

    let url: string
    if (doktyp === 'bet') {
      url = `https://data.riksdagen.se/dokumentlista/?doktyp=${doktyp}&rm=${rm}&bet=${r.number}&utformat=json`
    } else {
      url = `https://data.riksdagen.se/dokumentlista/?doktyp=${doktyp}&rm=${rm}&nr=${r.number}&utformat=json`
    }

    console.log(`\n${r.ref_type} (${r.reference}):`)
    console.log(`  List: ${url}`)
    console.log(`  HTML: https://data.riksdagen.se/dokument/{dok_id}.html`)
  }

  // Step 4: What we'd extract
  console.log('\n' + '=' .repeat(70))
  console.log('STEP 4: SECTIONS TO EXTRACT FROM PROP')
  console.log('=' .repeat(70))
  console.log(`
From Prop. ${refs.find(r => r.ref_type === 'PROP')?.reference || '2024/25:59'}:
  - "Författningskommentar" → Detailed commentary per section
  - "Skälen för regeringens förslag" → Government's reasoning
  - "Lagförslaget" → The proposed law text

From Bet. ${refs.find(r => r.ref_type === 'BET')?.reference || '2024/25:JuU22'}:
  - "Utskottets överväganden" → Committee's considerations
  - "Reservationer" → Minority opinions (if any)
`)

  // Step 5: Example output
  console.log('=' .repeat(70))
  console.log('STEP 5: GENERATED COMMENT (example output)')
  console.log('=' .repeat(70))
  console.log(`
## Kommentar till ändringarna i brottsbalken (SFS 2025:151)

Denna ändringsförfattning genomför flera skärpningar av straff för
våldsbrott, i enlighet med regeringens proposition 2024/25:59.

**Bakgrund och syfte**
Regeringen konstaterade i propositionen att det finns behov av...
[extracted from Prop. 2024/25:59, avsnitt 5.2]

**Utskottets bedömning**
Justitieutskottet tillstyrkte regeringens förslag utan ändringar...
[extracted from Bet. 2024/25:JuU22, s. 12-15]

**Ikraftträdande**
Ändringarna träder i kraft den 1 juli 2025.

---
*Källor: Prop. 2024/25:59, Bet. 2024/25:JuU22, Rskr. 2024/25:150*
`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
