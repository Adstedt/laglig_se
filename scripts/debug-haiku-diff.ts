/**
 * Debug: Check what's different between Haiku and Sonnet results
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const anthropic = new Anthropic()

const PARSE_PROMPT = `You are parsing a Swedish legal amendment document (ändringsförfattning).

Extract the following information from the PDF text:

1. **baseLaw**: The law being amended
   - name: The law's name (e.g., "arbetsmiljölagen", "plan- och bygglagen")
   - sfsNumber: The SFS number (e.g., "1977:1160")

2. **effectiveDate**: When the changes take effect (ISO format YYYY-MM-DD)
   - Look for "träder i kraft den X"

3. **publicationDate**: When published (ISO format YYYY-MM-DD)
   - Look for "Utfärdad den X"

4. **affectedSections**: Array of sections changed
   - chapter: Chapter number if applicable (e.g., "6" for "6 kap."), null otherwise
   - section: Section number (e.g., "17", "17a", "17 a")
   - changeType: One of "AMENDED", "REPEALED", "NEW", "RENUMBERED"
   - newText: Set to null (skip extraction)

Return ONLY valid JSON (no markdown, no explanation):
{
  "baseLaw": { "name": "string", "sfsNumber": "string" },
  "effectiveDate": "YYYY-MM-DD or null",
  "publicationDate": "YYYY-MM-DD or null",
  "affectedSections": [
    { "chapter": "string or null", "section": "string", "changeType": "AMENDED|REPEALED|NEW|RENUMBERED", "newText": null }
  ]
}`

async function main() {
  // Get a specific document - one with section count mismatch
  const doc = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: 'SFS 2019:464' }, // S:28 H:24
    select: {
      sfs_number: true,
      full_text: true,
      base_law_sfs: true,
      base_law_name: true,
      effective_date: true,
      section_changes: {
        select: { chapter: true, section: true, change_type: true },
      },
    },
  })

  if (!doc) {
    console.log('Document not found')
    return
  }

  console.log('='.repeat(60))
  console.log('SONNET RESULTS (from database):')
  console.log('='.repeat(60))
  console.log('base_law_sfs:', doc.base_law_sfs)
  console.log('base_law_name:', doc.base_law_name)
  console.log(
    'effective_date:',
    doc.effective_date?.toISOString().split('T')[0]
  )
  console.log(
    'sections:',
    doc.section_changes
      .map(
        (s) =>
          `${s.chapter ? s.chapter + ' kap. ' : ''}${s.section} § (${s.change_type})`
      )
      .join(', ')
  )

  // Parse with Haiku
  console.log('\n' + '='.repeat(60))
  console.log('HAIKU RESULTS:')
  console.log('='.repeat(60))

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: `${PARSE_PROMPT}\n\n<pdf_text>\n${doc.full_text}\n</pdf_text>`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type === 'text') {
    console.log('Raw response:')
    console.log(content.text)

    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        console.log('\nParsed:')
        console.log('baseLaw:', parsed.baseLaw)
        console.log('effectiveDate:', parsed.effectiveDate)
        console.log(
          'sections:',
          parsed.affectedSections
            ?.map(
              (s: { chapter?: string; section: string; changeType: string }) =>
                `${s.chapter ? s.chapter + ' kap. ' : ''}${s.section} § (${s.changeType})`
            )
            .join(', ')
        )
      }
    } catch (e) {
      console.log('Parse error:', e)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('SOURCE TEXT (first 800 chars):')
  console.log('='.repeat(60))
  console.log(doc.full_text?.substring(0, 800))

  await prisma.$disconnect()
}

main().catch(console.error)
