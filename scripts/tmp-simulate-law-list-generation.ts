/**
 * Simulate the full law list generation skill for Kontorab.
 * Creates a temporary workspace, populates company profile, runs the skill,
 * and prints the results.
 *
 * Run: npx tsx scripts/tmp-simulate-law-list-generation.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

// Set required env vars for modules that check them at import time
process.env.SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
process.env.SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  ''

import { PrismaClient } from '@prisma/client'
import { generateText, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createSearchLawsTool } from '../lib/agent/tools/search-laws'
import { createGetCompanyContextTool } from '../lib/agent/tools/get-company-context'
import { createGetTemplateLawsTool } from '../lib/agent/tools/get-template-laws'
import { createAddLawsToListTool } from '../lib/agent/tools/add-laws-to-list'

const prisma = new PrismaClient()

const COMPANY_PROFILE = {
  company_name: 'Öresundslinjen AB',
  org_number: '556990-7198',
  sni_code: '50102',
  industry_label: 'Sjötrafik, kustfart och oceantrafik, passagerare',
  legal_form: 'AB',
  organization_type: 'AB' as const,
  employee_count: 45,
  employee_count_range: 'RANGE_10_49' as const,
  business_description:
    'Öresundslinjen bedriver passagerarfärjetrafik mellan Helsingborg och Helsingör. ' +
    'Verksamheten omfattar drift av passagerarfärjor, biljettförsäljning, ombordservice ' +
    'inklusive café/restaurang och tax-free-försäljning. Företaget hanterar fartyg, ' +
    'bränslehantering, sjösäkerhet, passagerarsäkerhet och har personal som arbetar ' +
    'ombord (sjöpersonal) och i land (biljettförsäljning, administration). ' +
    'Internationell trafik mellan Sverige och Danmark.',
  municipality: 'Helsingborg',
  website_url: 'https://www.oresundslinjen.se',
  address: 'Kungsgatan 2, 252 21 Helsingborg',
  data_source: 'simulation',
  profile_completeness: 88,
  has_compliance_officer: false,
  foreign_owned: false,
  fi_regulated: false,
  has_collective_agreement: true,
  collective_agreement_name: 'SEKO Sjöfolk',
  activity_flags: {
    chemicals: true,
    construction: false,
    food: true,
    personalData: true,
    publicSector: false,
    heavyMachinery: true,
    minorEmployees: false,
    internationalOperations: true,
  },
  tax_status: {
    fSkatt: true,
    momsRegistered: true,
    arbetsgivarRegistered: true,
  },
}

const SYSTEM_PROMPT = `Du är en erfaren svensk compliance-konsult som bygger en personlig laglista åt ett nytt företag.

## Ditt uppdrag
Skapa en heltäckande, personlig laglista baserat på företagets profil. Målet är 40-80 lagar beroende på företagets komplexitet.

## Arbetsordning

1. **Förstå företaget**: Börja med att anropa \`get_company_context\` för att hämta företagsprofilen — bransch, storlek, verksamhetsflaggor, SNI-kod, m.m.

2. **Kontrollera kurerade mallar**: För varje relevant regelområde, anropa \`get_template_laws\` för att hämta expertrekommendationer:
   - "arbetsmiljö" (gäller alla arbetsgivare)
   - "miljö" (om miljöflaggor finns)
   - "dataskydd" (om personuppgifter hanteras)
   - "bolagsrätt" (gäller alla företag)
   - "skatt" (gäller alla företag)
   - Andra relevanta områden baserat på företagsprofilen

   **Utvärdera varje föreslagen lag mot företagsprofilen**:
   - Behåll lagar som tydligt gäller detta specifika företag
   - Hoppa över lagar som inte är tillämpliga (t.ex. tunga maskindirektiv för ett mjukvaruföretag)
   - En bra konsult vet vad som ska lämnas bort

3. **Sök kompletterande lagar**: För områden utan mallar, eller branschspecifika lagar som mallarna inte täcker, använd \`search_laws\` för att hitta tillämpliga lagar. Fokusera på:
   - Branschspecifika föreskrifter (baserat på SNI-kod)
   - Verksamhetsflaggor (kemikalier, bygg, livsmedel, etc.)
   - Storlek- och organisationsspecifika krav

4. **Lägg till lagar**: Anropa \`add_laws_to_list\` med omgångar av tillämpliga lagar. Gruppera per regelområde.

## Krav på business_context

För varje lag, skriv ett \`businessContext\`-fält (2-3 meningar) som förklarar:
1. **VARFÖR** lagen gäller detta specifika företag
2. **VILKA** processer, avdelningar eller produkter som berörs
3. **KONTEXT** för granskningar, revisioner eller intern kommunikation

Exempel: "Ni omfattas av Arbetsmiljölagen som arbetsgivare med 12 anställda inom restaurangbranschen. Lagen berör era köksprocesser, serveringspersonal och arbetsmiljöansvarig chef. Relevant vid Arbetsmiljöverkets inspektioner och vid ert systematiska arbetsmiljöarbete."

## Regler
- Lägg INTE till lagar som tydligt inte gäller — kvalitet framför kvantitet
- Använd ALLTID svenska gruppnamn: "Arbetsrätt", "Bolagsrätt", "Skatt", "Miljö", "Dataskydd", etc.
- Alla documentId måste komma från get_template_laws eller search_laws — hitta inte på egna
- Målintervall: 40-80 lagar beroende på företagets komplexitet
- Om en lag redan finns i listan hoppas den över automatiskt`

async function main() {
  console.log(
    '🏢 Simulating law list generation for Öresundslinjen (556990-7198)'
  )
  console.log('='.repeat(70))

  // Find a user
  const user = await prisma.user.findFirst({
    select: { id: true, email: true },
  })
  if (!user) {
    console.error('❌ No user found in the database.')
    process.exit(1)
  }
  console.log(`👤 Using user: ${user.email}`)

  // Create temp workspace
  const slug = `oresundslinjen-sim-${Date.now()}`
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Öresundslinjen AB',
      slug,
      owner_id: user.id,
      subscription_tier: 'TRIAL',
      status: 'ACTIVE',
      org_number: '556990-7198',
      company_legal_name: 'Öresundslinjen AB',
      sni_code: '82990',
      law_list_generation_status: 'in_progress',
    },
  })
  console.log(`🏗️  Created workspace: ${workspace.id}`)

  await prisma.workspaceMember.create({
    data: {
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'OWNER',
      joined_at: new Date(),
    },
  })

  await prisma.companyProfile.create({
    data: { workspace_id: workspace.id, ...COMPANY_PROFILE },
  })

  console.log('📋 Company profile created')
  console.log(
    `   SNI: ${COMPANY_PROFILE.sni_code} (${COMPANY_PROFILE.industry_label})`
  )
  console.log(`   Anställda: ${COMPANY_PROFILE.employee_count}`)
  console.log(
    `   Personuppgifter: ${COMPANY_PROFILE.activity_flags.personalData ? 'Ja' : 'Nej'}`
  )
  console.log(
    `   Kemikalier: ${COMPANY_PROFILE.activity_flags.chemicals ? 'Ja' : 'Nej'}`
  )
  console.log(
    `   Minderåriga: ${COMPANY_PROFILE.activity_flags.minorEmployees ? 'Ja' : 'Nej'}`
  )
  console.log(`   Utlandsägd: ${COMPANY_PROFILE.foreign_owned ? 'Ja' : 'Nej'}`)
  console.log('')
  console.log('🤖 Running generation skill...')
  console.log('-'.repeat(70))

  // Build tools (only the ones we need — avoids auth module chain)
  const tools = {
    search_laws: createSearchLawsTool(workspace.id),
    get_company_context: createGetCompanyContextTool(workspace.id),
    get_template_laws: createGetTemplateLawsTool(),
    add_laws_to_list: createAddLawsToListTool(workspace.id, user.id),
  }

  const startTime = Date.now()

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content:
            'Bygg en heltäckande personlig laglista åt detta företag. Börja med att hämta företagsprofilen.',
        },
      ],
      tools,
      stopWhen: stepCountIs(20),
      onStepFinish: async (event) => {
        for (const tc of event.toolCalls) {
          const input = 'input' in tc ? tc.input : undefined
          const inputStr = input ? JSON.stringify(input).slice(0, 100) : ''
          console.log(`  🔧 ${tc.toolName}(${inputStr})`)
        }
      },
    })

    const durationMs = Date.now() - startTime

    console.log('')
    console.log('='.repeat(70))
    console.log('✅ GENERATION COMPLETE')
    console.log('='.repeat(70))
    console.log(
      `🪙 Tokens: ${result.usage.inputTokens} input / ${result.usage.outputTokens} output`
    )
    console.log(`⏱️  Duration: ${(durationMs / 1000).toFixed(1)}s`)

    const inputCost = ((result.usage.inputTokens ?? 0) / 1_000_000) * 3
    const outputCost = ((result.usage.outputTokens ?? 0) / 1_000_000) * 15
    console.log(`💰 Estimated cost: $${(inputCost + outputCost).toFixed(4)}`)

    // Print the law list
    const list = await prisma.lawList.findFirst({
      where: { workspace_id: workspace.id, is_default: true },
      include: {
        groups: {
          orderBy: { position: 'asc' },
          include: {
            items: {
              orderBy: { position: 'asc' },
              include: {
                document: { select: { title: true, document_number: true } },
              },
            },
          },
        },
      },
    })

    if (list) {
      const totalItems = list.groups.reduce((sum, g) => sum + g.items.length, 0)
      console.log(`\n📋 Total laws: ${totalItems}`)
      console.log(`📁 Groups: ${list.groups.map((g) => g.name).join(', ')}`)

      console.log('')
      console.log('='.repeat(70))
      console.log('📜 GENERATED LAW LIST: "Er laglista"')
      console.log('='.repeat(70))

      for (const group of list.groups) {
        console.log(`\n## ${group.name} (${group.items.length} lagar)`)
        console.log('-'.repeat(50))

        for (const item of group.items) {
          console.log(
            `  ${item.document.document_number} — ${item.document.title}`
          )
          if (item.business_context) {
            const lines = item.business_context.match(/.{1,76}/g) ?? [
              item.business_context,
            ]
            for (const line of lines) {
              console.log(`    ${line}`)
            }
          }
          console.log('')
        }
      }
    } else {
      console.log('⚠️  No law list was created')
    }

    // Print the agent's final text response
    if (result.text) {
      console.log('='.repeat(70))
      console.log('💬 AGENT SUMMARY:')
      console.log(result.text)
    }
  } catch (error) {
    console.error('❌ Generation failed:', error)
  } finally {
    console.log('')
    console.log('🧹 Cleaning up temporary workspace...')
    await prisma.workspace.delete({ where: { id: workspace.id } })
    console.log('✅ Cleanup complete')
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
