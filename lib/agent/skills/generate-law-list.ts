/**
 * Headless law list generation skill
 * Story 16.4, Task 4 (AC: 1-2, 4-7)
 *
 * Uses generateText() (not streamText()) — no chat UI.
 * Same tool registry as the chat agent, plus skill-specific tools.
 */

import { generateText, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { prisma } from '@/lib/prisma'
import { createAgentTools } from '@/lib/agent/tools'
import { createGetTemplateLawsTool } from '@/lib/agent/tools/get-template-laws'
import { createAddLawsToListTool } from '@/lib/agent/tools/add-laws-to-list'

export interface GenerateLawListResult {
  listId: string | null
  itemCount: number
  groups: string[]
  tokensUsed: { input: number; output: number }
  durationMs: number
}

interface ProgressStep {
  label: string
  status: 'done' | 'active' | 'pending'
  detail?: string
}

const TOOL_STEP_LABELS: Record<string, string> = {
  get_company_context: 'Analyserar ert företag',
  get_template_laws: 'Kontrollerar regelområde',
  search_laws: 'Söker branschspecifika regler',
  get_document_details: 'Hämtar dokumentdetaljer',
  add_laws_to_list: 'Lägger till lagar i er lista',
}

async function updateProgress(
  workspaceId: string,
  stepLabel: string,
  status: 'done' | 'active',
  detail?: string
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { law_list_generation_progress: true },
  })

  const steps: ProgressStep[] = Array.isArray(
    workspace?.law_list_generation_progress
  )
    ? (workspace.law_list_generation_progress as unknown as ProgressStep[])
    : []

  // Mark any currently active step as done
  for (const step of steps) {
    if (step.status === 'active') {
      step.status = 'done'
    }
  }

  // Find existing step with this label or add new
  const existing = steps.find((s) => s.label === stepLabel)
  if (existing) {
    existing.status = status
    if (detail) existing.detail = detail
  } else {
    steps.push({ label: stepLabel, status, ...(detail ? { detail } : {}) })
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      law_list_generation_progress:
        steps as unknown as import('@prisma/client').Prisma.InputJsonValue,
    },
  })
}

const SYSTEM_PROMPT = `Du är en erfaren svensk compliance-konsult som bygger en personlig laglista åt ett nytt företag.

## Ditt uppdrag
Skapa en heltäckande, personlig laglista baserat på företagets profil. Målet är 40-80 lagar beroende på företagets komplexitet.

## Arbetsordning — VIKTIGT: Minimera antal steg genom att anropa FLERA verktyg samtidigt

### Steg 1 (ett anrop):
Anropa \`get_company_context\` för att förstå företaget.

### Steg 2 (ALLA malluppslag samtidigt i ETT steg):
Anropa \`get_template_laws\` för ALLA relevanta regelområden PARALLELLT i samma svar:
- "arbetsmiljö" (alla arbetsgivare)
- "miljö" (om miljöflaggor)
- "dataskydd" (om personuppgifter)
- "bolagsrätt" (alla företag)
- "skatt" (alla företag)
- Ytterligare områden baserat på profilen

### Steg 3 (ALLA sökningar samtidigt i ETT steg):
Baserat på mallresultaten, anropa \`search_laws\` för ALLA luckor PARALLELLT:
- Branschspecifika lagar som saknas i mallarna
- Lagar kopplade till verksamhetsflaggor (kemikalier, minderåriga, etc.)
- Bolagsrätt, skatterätt, redovisning om mallar saknade dem
- Sök INTE efter lagar som redan hittats via mallar
- Max 8-10 sökningar totalt

### Steg 4 (lägg till allt i 1-2 anrop):
Anropa \`add_laws_to_list\` med ALLA tillämpliga lagar. Skicka helst alla i ett enda anrop. Gruppera per regelområde.

## Krav på business_context

För varje lag, skriv ett \`businessContext\`-fält (2-3 meningar) som förklarar:
1. **VARFÖR** lagen gäller detta specifika företag
2. **VILKA** processer, avdelningar eller produkter som berörs
3. **KONTEXT** för granskningar, revisioner eller intern kommunikation

Exempel: "Ni omfattas av Arbetsmiljölagen som arbetsgivare med 12 anställda inom restaurangbranschen. Lagen berör era köksprocesser, serveringspersonal och arbetsmiljöansvarig chef. Relevant vid Arbetsmiljöverkets inspektioner och vid ert systematiska arbetsmiljöarbete."

## Redan tillagda lagar (lägg INTE till dessa igen)
Följande grundläggande lagar har redan lagts till automatiskt: Aktiebolagslagen, Årsredovisningslagen, Bokföringslagen, Medbestämmandelagen, Inkomstskattelagen, Skatteförfarandelagen, Mervärdesskattelagen. Fokusera på bransch- och verksamhetsspecifika lagar istället.

## Regler
- Lägg INTE till lagar som tydligt inte gäller — kvalitet framför kvantitet
- Använd ALLTID svenska gruppnamn: "Arbetsrätt", "Bolagsrätt", "Skatt & Redovisning", "Miljö & Kemikalier", "Dataskydd", "Arbetsmiljö", "Konsumenträtt", "Byggrätt", etc. Skapa INTE överlappande grupper — t.ex. använd "Skatt & Redovisning" istället för separata "Skatt" och "Redovisning".
- **KRITISKT: Använd ENBART documentId som returneras av get_template_laws eller search_laws. Konstruera ALDRIG egna ID:n. Ogiltiga ID:n filtreras bort automatiskt.**
- Målintervall: 40-80 lagar beroende på företagets komplexitet
- Om en lag redan finns i listan hoppas den över automatiskt
- Sök INTE efter samma lag mer än en gång — om en sökning inte hittar den, gå vidare`

/**
 * Universal laws that apply to every Swedish aktiebolag.
 * Pre-seeded deterministically — no LLM steps wasted on these.
 */
const UNIVERSAL_AB_LAWS: Array<{
  documentId: string
  group: string
  businessContext: string
}> = [
  {
    documentId: '3a1a8e98-2628-4282-8950-a330a3913cdb', // ABL
    group: 'Bolagsrätt',
    businessContext:
      'Aktiebolagslagen reglerar bolagets organisation, styrelseansvar, bolagsstämma, kapitalskydd och utdelning. Grundläggande för all bolagsstyrning.',
  },
  {
    documentId: '653b9d3d-6e14-4481-a975-43f28dde5047', // ÅRL
    group: 'Bolagsrätt',
    businessContext:
      'Årsredovisningslagen ställer krav på bokslut, årsredovisning, förvaltningsberättelse och revision. Gäller alla aktiebolag.',
  },
  {
    documentId: '35df26f0-ffed-46ff-b9e1-9fb1d6c5841b', // BFL
    group: 'Bolagsrätt',
    businessContext:
      'Bokföringslagen kräver löpande bokföring, verifikationer och arkivering av räkenskapsinformation. Grundläggande för ekonomiavdelningen.',
  },
  {
    documentId: '3ea0659a-282e-4669-8aa9-827bd23babc8', // MBL
    group: 'Arbetsrätt',
    businessContext:
      'Medbestämmandelagen reglerar informations- och förhandlingsskyldighet gentemot fackliga organisationer. Relevant vid alla större förändringar i verksamheten.',
  },
  {
    documentId: 'f4cd631b-8c7c-4708-afc4-c863974f4d16', // IL
    group: 'Skatt & Redovisning',
    businessContext:
      'Inkomstskattelagen reglerar bolagsskatt, tjänstebeskattning och kapitalinkomster. Berör bolagets skatteplanering och deklaration.',
  },
  {
    documentId: 'b3301284-c87e-4c1f-bf69-3c642fc8249b', // SFL
    group: 'Skatt & Redovisning',
    businessContext:
      'Skatteförfarandelagen reglerar deklarationsskyldighet, arbetsgivaravgifter, skatteavdrag och Skatteverkets kontroller.',
  },
  {
    documentId: '620d076d-8095-4963-92d2-43ff542513cb', // ML
    group: 'Skatt & Redovisning',
    businessContext:
      'Mervärdesskattelagen reglerar moms på varor och tjänster. Berör fakturering, momsredovisning och avdragsrätt.',
  },
]

export async function generateLawList(
  workspaceId: string,
  userId: string
): Promise<GenerateLawListResult> {
  const startTime = Date.now()

  // Initialize progress
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { law_list_generation_progress: [] },
  })

  // Pre-seed universal AB laws deterministically
  const addTool = createAddLawsToListTool(workspaceId, userId)
  await addTool.execute!(
    { laws: UNIVERSAL_AB_LAWS },
    {
      toolCallId: 'pre-seed',
      messages: [],
      abortSignal: undefined as unknown as AbortSignal,
    }
  )
  await updateProgress(
    workspaceId,
    'Grundläggande bolagslagar tillagda',
    'done',
    '7 lagar'
  )

  const chatTools = createAgentTools(workspaceId, userId)
  const tools = {
    ...chatTools,
    get_template_laws: createGetTemplateLawsTool(),
    add_laws_to_list: createAddLawsToListTool(workspaceId, userId),
  }

  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    // Anthropic prompt caching v1. Wrap the system prompt in a
    // SystemModelMessage so we can attach `cacheControl: { type: 'ephemeral' }`
    // (5-min TTL). The Anthropic provider reads cache_control from
    // message-level providerOptions — top-level options aren't sufficient.
    //
    // Why this matters: the agent loop runs UP TO 20 steps (stepCountIs(20)
    // below) and each step re-sends the system prompt + tool definitions at
    // full price. SYSTEM_PROMPT is ~7700 chars (~2350 tokens, well above the
    // 1024-token minimum Sonnet 4.6 requires for caching) — caching cuts
    // 30-40% off per-generation cost. Mirrors the same pattern in
    // app/api/chat/route.ts:241-252.
    system: {
      role: 'system' as const,
      content: SYSTEM_PROMPT,
      providerOptions: {
        anthropic: {
          cacheControl: { type: 'ephemeral' as const },
        },
      },
    },
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
      for (const toolCall of event.toolCalls) {
        const label = TOOL_STEP_LABELS[toolCall.toolName] ?? toolCall.toolName

        let detail: string | undefined
        if (toolCall.toolName === 'get_template_laws') {
          const input = 'input' in toolCall ? toolCall.input : undefined
          if (typeof input === 'object' && input !== null && 'area' in input) {
            detail = String((input as { area: string }).area)
          }
        }

        await updateProgress(workspaceId, label, 'done', detail)
      }
    },
  })

  // Final progress step
  await updateProgress(workspaceId, 'Skriver anpassade beskrivningar', 'done')

  // Get result summary from the law list
  const lawList = await prisma.lawList.findFirst({
    where: {
      workspace_id: workspaceId,
      is_default: true,
    },
    select: {
      id: true,
      _count: { select: { items: true } },
      groups: { select: { name: true } },
    },
  })

  const durationMs = Date.now() - startTime

  return {
    listId: lawList?.id ?? null,
    itemCount: lawList?._count.items ?? 0,
    groups: lawList?.groups.map((g) => g.name) ?? [],
    tokensUsed: {
      input: result.totalUsage.inputTokens ?? 0,
      output: result.totalUsage.outputTokens ?? 0,
    },
    durationMs,
  }
}
