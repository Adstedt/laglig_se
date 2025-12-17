/* eslint-disable no-console */
/**
 * Generate a Swedish notification summary for a law change
 * Similar to Notisum's email format
 *
 * Uses Claude Opus 4.5 to generate human-friendly change descriptions
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { prisma } from '../lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

interface ChangeSummary {
  baseLaw: {
    sfsNumber: string
    title: string
  }
  amendment: {
    sfsNumber: string
    title: string
    effectiveDate: Date | null
    fullText: string | null
    sectionChanges: Array<{
      chapter: string | null
      section: string
      changeType: string
    }>
  }
  detectedAt: Date
  llmDescription?: string
}

/**
 * Generate a human-friendly Swedish description of the change using Claude Opus 4.5
 */
async function generateLlmDescription(summary: ChangeSummary): Promise<string> {
  const sectionList = summary.amendment.sectionChanges
    .map((s) => {
      const ch = s.chapter ? `${s.chapter} kap. ` : ''
      return `${ch}${s.section} § (${s.changeType.toLowerCase()})`
    })
    .join(', ')

  const effectiveDate = summary.amendment.effectiveDate
    ? formatSwedishDate(summary.amendment.effectiveDate)
    : 'okänt datum'

  const prompt = `Du är en juridisk analytiker på Laglig.se. Analysera följande lagändring och skapa en tydlig, informativ sammanfattning för våra användare.

LAGÄNDRING:
Baslag: ${summary.baseLaw.title} (${summary.baseLaw.sfsNumber})
Ändringsförfattning: ${summary.amendment.sfsNumber}
Rubrik: ${summary.amendment.title}
Ändrade bestämmelser: ${sectionList || 'Se fulltext'}
Träder i kraft: ${effectiveDate}

ÄNDRINGSFÖRFATTNINGENS FULLTEXT:
${summary.amendment.fullText?.substring(0, 4000) || 'Text saknas'}

UPPGIFT:
Skriv en koncis sammanfattning (1-2 meningar) som förklarar:
- Vad ändringen innebär i praktiken
- Vilka bestämmelser som berörs
- När ändringen träder i kraft

Skriv på professionell svenska. Var konkret och undvik juridisk jargong där det är möjligt.

Sammanfattning:`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return content.text.trim()
    }
  } catch (error) {
    console.error('LLM error:', error)
  }

  // Fallback if LLM fails
  return `Ändring i ${sectionList || 'lagen'}. Ikraftträdande ${effectiveDate}`
}

function formatSwedishDate(date: Date): string {
  const months = [
    'januari',
    'februari',
    'mars',
    'april',
    'maj',
    'juni',
    'juli',
    'augusti',
    'september',
    'oktober',
    'november',
    'december',
  ]
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

function formatChangeType(type: string): string {
  const types: Record<string, string> = {
    AMENDED: 'ändrad',
    NEW: 'ny',
    REPEALED: 'upphävd',
    RENUMBERED: 'omnumrerad',
  }
  return types[type] || type.toLowerCase()
}

function formatSectionChanges(
  changes: ChangeSummary['amendment']['sectionChanges']
): string {
  if (changes.length === 0) return ''

  // Group by change type
  const byType: Record<string, string[]> = {}
  for (const c of changes) {
    const type = formatChangeType(c.changeType)
    if (!byType[type]) byType[type] = []
    const section = c.chapter
      ? `${c.chapter} kap. ${c.section} §`
      : `${c.section} §`
    byType[type].push(section)
  }

  // Format as "ändr. 5 §, 7 §; ny 8 §"
  const parts: string[] = []
  if (byType['ändrad']) parts.push(`ändr. ${byType['ändrad'].join(', ')}`)
  if (byType['ny']) parts.push(`ny ${byType['ny'].join(', ')}`)
  if (byType['upphävd']) parts.push(`upph. ${byType['upphävd'].join(', ')}`)
  if (byType['omnumrerad'])
    parts.push(`omnum. ${byType['omnumrerad'].join(', ')}`)

  return parts.join('; ')
}

function generateNotificationText(summary: ChangeSummary): string {
  const { baseLaw, amendment, detectedAt } = summary

  const effectiveDateStr = amendment.effectiveDate
    ? formatSwedishDate(amendment.effectiveDate)
    : 'datum ej angivet'

  const sectionSummary = formatSectionChanges(amendment.sectionChanges)

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAGÄNDRING UPPTÄCKT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Svensk Författningssamling, SFS

${baseLaw.title} (${baseLaw.sfsNumber.replace('SFS ', '')})
${baseLaw.sfsNumber} har nu uppdateringsinformationen ${amendment.sfsNumber}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Senaste ändring
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• ${amendment.sfsNumber}
  ${amendment.title}
  ${sectionSummary}

┌─────────────────────────────────────────────────────────────┐
│ ${summary.llmDescription || (sectionSummary ? `Ändring i ${sectionSummary}. Ikraftträdande ${effectiveDateStr}` : `Ändring i lagen. Ikraftträdande ${effectiveDateStr}`)}
└─────────────────────────────────────────────────────────────┘

Upptäckt: ${formatSwedishDate(detectedAt)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim()
}

async function main() {
  const amendmentSfs = process.argv[2] || 'SFS 2025:1445'

  // Fetch amendment data
  const amendment = await prisma.amendmentDocument.findUnique({
    where: { sfs_number: amendmentSfs },
    include: {
      section_changes: {
        orderBy: { sort_order: 'asc' },
      },
    },
  })

  if (!amendment) {
    console.log(`Amendment ${amendmentSfs} not found`)
    await prisma.$disconnect()
    return
  }

  // Fetch base law
  const baseLaw = amendment.base_law_sfs
    ? await prisma.legalDocument.findUnique({
        where: { document_number: amendment.base_law_sfs },
      })
    : null

  // Fetch change event
  const changeEvent = baseLaw
    ? await prisma.changeEvent.findFirst({
        where: {
          document_id: baseLaw.id,
          amendment_sfs: amendmentSfs,
        },
      })
    : null

  const summary: ChangeSummary = {
    baseLaw: {
      sfsNumber: amendment.base_law_sfs || 'Okänd',
      title: baseLaw?.title || amendment.base_law_name || 'Okänd lag',
    },
    amendment: {
      sfsNumber: amendment.sfs_number,
      title: amendment.title || `Ändring i ${amendment.base_law_name}`,
      effectiveDate: amendment.effective_date,
      fullText: amendment.full_text,
      sectionChanges: amendment.section_changes.map((s) => ({
        chapter: s.chapter,
        section: s.section,
        changeType: s.change_type,
      })),
    },
    detectedAt: changeEvent?.detected_at || amendment.created_at,
  }

  // Generate LLM description
  console.log('Generating AI summary with Claude Opus 4.5...\n')
  summary.llmDescription = await generateLlmDescription(summary)

  console.log(generateNotificationText(summary))

  await prisma.$disconnect()
}

main()
