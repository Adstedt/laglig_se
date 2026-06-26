/**
 * Headless law list generation skill
 * Story 16.4, Task 4 (AC: 1-2, 4-7)
 *
 * Uses generateText() (not streamText()) — no chat UI.
 * Same tool registry as the chat agent, plus skill-specific tools.
 */

import { generateText, stepCountIs, type ModelMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { prisma } from '@/lib/prisma'
import { createAgentTools } from '@/lib/agent/tools'
import { createGetTemplateLawsTool } from '@/lib/agent/tools/get-template-laws'
import { createAddLawsToListTool } from '@/lib/agent/tools/add-laws-to-list'

// Law-list generation runs ONCE per workspace (onboarding) and is the user's
// first impression of the product, so it defaults to the strongest model with a
// high reasoning budget — the per-run cost is negligible at this frequency and
// the task is reasoning-heavy (derive applicable agencies, mine the free-text
// description, judge each föreskrift). Override via LAW_LIST_GENERATION_MODEL
// (e.g. claude-sonnet-4-6 or claude-fable-5) to A/B output quality vs cost.
const GENERATION_MODEL =
  process.env.LAW_LIST_GENERATION_MODEL ?? 'claude-opus-4-8'

// Adaptive thinking budget for the generation call. Mirrors the chat route's
// pattern (lib/agent/thinking-effort.ts, Story 19.14): `thinking.type:'adaptive'`
// lets the model self-regulate how much to reason per step, guided by the
// `effort` ceiling. Set to 'high' here (not capped at chat's 'medium') because
// generation runs under maxDuration=300s, not chat's 90s guardrail. `effort`
// alone does NOT enable thinking — the `thinking` block is required, and
// `display:'summarized'` is set explicitly to avoid the Opus `omitted`-default
// trap documented in thinking-effort.ts.
const GENERATION_THINKING_PROVIDER_OPTIONS = {
  anthropic: {
    thinking: { type: 'adaptive' as const, display: 'summarized' as const },
    effort: 'high' as const,
  },
}

export interface GenerateLawListResult {
  listId: string | null
  itemCount: number
  groups: string[]
  model: string
  tokensUsed: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
  }
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
  search_laws: 'Söker lagar och myndighetsföreskrifter',
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

const SYSTEM_PROMPT = `Du är en erfaren svensk compliance-konsult som bygger en personlig laglista åt ett företag.

Din uppgift är att skapa en DJUPT personaliserad lista — inte en generisk mall. Skillnaden mellan en stark och en svag laglista är att du aktivt använder företagets profil (SNI-kod, bransch, verksamhetsbeskrivning, verksamhetsflaggor) för att hitta exakt de regler som gäller just denna verksamhet. En lista som bara speglar mallarna är en SVAG lista — ditt mervärde ligger i den personliga research-fasen (steg 3).

## Ditt uppdrag
Bygg en heltäckande, personlig laglista som omfattar BÅDE:
1. **Lagar och förordningar (SFS)** — riksdagens och regeringens regler.
2. **Myndighetsföreskrifter** — bindande regler från myndigheter (t.ex. SKOLFS från Skolverket, AFS från Arbetsmiljöverket, LIVSFS, HSLF-FS, BFS, MSBFS, KIFS, FFFS). Dessa är ofta MER konkreta och verksamhetsnära än själva lagarna och är helt avgörande för en användbar lista. En laglista utan relevanta myndighetsföreskrifter är ofullständig.

## Arbetsordning — anropa gärna flera verktyg parallellt i samma steg

### Steg 1 — Förstå företaget (ett anrop)
Anropa \`get_company_context\`. Läs sedan profilen NOGGRANT och bilda dig en uppfattning innan du söker:
- Vad gör företaget konkret? Läs \`businessDescription\` ord för ord — den innehåller de starkaste signalerna om vilka regler som gäller.
- Vilken bransch/SNI-kod och vilka verksamhetsflaggor är satta?
- **Vilka myndigheter reglerar just denna verksamhet?** Härled dem ur profilen och notera dem — de styr vilka föreskrifter du ska söka efter i steg 3. Vägledande exempel (inte uttömmande):
  - Skola/utbildning (SNI 85) → Skolverket (SKOLFS), Skolinspektionen → även skollagen, skolförordningen, gymnasieförordningen
  - Alla arbetsgivare → Arbetsmiljöverket (AFS)
  - Livsmedel/servering → Livsmedelsverket (LIVSFS), kommunal miljö- och hälsoskyddsnämnd
  - Vård/omsorg → Socialstyrelsen/IVO (HSLF-FS, SOSFS)
  - Bygg/fastighet → Boverket (BFS)
  - Brandfarligt/explosivt/kemikalier → MSB (MSBFS), Kemikalieinspektionen (KIFS)
  - Transport → Transportstyrelsen
  - Finans/försäkring → Finansinspektionen (FFFS)

### Steg 2 — Hämta mallar som GRUND (alla malluppslag parallellt i ETT steg)
Anropa \`get_template_laws\` för alla relevanta regelområden parallellt: "arbetsmiljö" (alla arbetsgivare), "bolagsrätt", "skatt", samt "dataskydd"/"miljö"/branschområden utifrån profilen. Behåll det som passar, hoppa över det som tydligt inte gäller. Mallarna är ett golv, inte facit.

### Steg 3 — Personlig research (VIKTIGAST — sök brett och djupt med \`search_laws\`)
Detta steg avgör listans kvalitet. Gör så här (parallellisera sökningarna, använd flera steg om det behövs):

**3a. Branschspecifika SFS-lagar** som mallarna saknar — härledda ur SNI-kod, bransch och verksamhetsbeskrivning.

**3b. Myndighetsföreskrifter — OBLIGATORISKT.** För VARJE myndighet du identifierade i steg 1: gör riktade sökningar med parametern \`contentType: "AGENCY_REGULATION"\` så att föreskrifterna inte trängs undan av lag-träffar. Sök på konkreta sakområden, inte bara myndighetens namn. T.ex. för en skola: "systematiskt kvalitetsarbete skola", "betyg och bedömning", "läroplan grundskolan", "elevhälsa", "kursplaner", "lärarlegitimation". Hoppa ALDRIG över detta steg.

**3c. Signaler ur verksamhetsbeskrivningen.** Varje konkret aktivitet i \`businessDescription\` (t.ex. "skolmåltider", "elevhälsa", "personuppgifter om elever", "minderåriga praktikanter", "fordon", "tillståndspliktig hantering") motsvarar ofta en specifik lag eller föreskrift — sök på var och en.

Sök hellre en gång för mycket än för lite. Den enda begränsningen är att inte upprepa exakt samma sökning.

### Steg 4 — Lägg till allt (1-2 anrop)
Anropa \`add_laws_to_list\` med ALLA tillämpliga dokument, helst i ett enda anrop. Gruppera per regelområde och inkludera myndighetsföreskrifterna i relevanta grupper.

## Krav på business_context

För varje dokument, skriv ett \`businessContext\`-fält (2-3 meningar) som förklarar:
1. **VARFÖR** regeln gäller detta specifika företag
2. **VILKA** processer, avdelningar eller produkter som berörs
3. **KONTEXT** för granskningar, revisioner eller intern kommunikation

Exempel: "Ni omfattas av Arbetsmiljölagen som arbetsgivare med 12 anställda inom restaurangbranschen. Lagen berör era köksprocesser, serveringspersonal och arbetsmiljöansvarig chef. Relevant vid Arbetsmiljöverkets inspektioner och vid ert systematiska arbetsmiljöarbete."

## Redan tillagda lagar (lägg INTE till dessa igen)
Följande grundläggande lagar har redan lagts till automatiskt: Aktiebolagslagen, Årsredovisningslagen, Bokföringslagen, Medbestämmandelagen, Inkomstskattelagen, Skatteförfarandelagen, Mervärdesskattelagen. Fokusera på bransch- och verksamhetsspecifika lagar och föreskrifter istället.

## Regler
- Sikta på en heltäckande lista — typiskt 40-80 dokument, men låt verksamhetens komplexitet styra. En verksamhet med många myndighetsföreskrifter (t.ex. skola, vård) kan med rätta ha fler.
- Inkludera ALLTID relevanta myndighetsföreskrifter — annars är listan ofullständig.
- Lägg INTE till regler som tydligt inte gäller — kvalitet framför kvantitet.
- Använd ALLTID svenska gruppnamn: "Arbetsrätt", "Bolagsrätt", "Skatt & Redovisning", "Miljö & Kemikalier", "Dataskydd", "Arbetsmiljö", "Konsumenträtt", "Byggrätt", "Skola & Utbildning", etc. Skapa INTE överlappande grupper — t.ex. använd "Skatt & Redovisning" istället för separata "Skatt" och "Redovisning".
- **KRITISKT: Använd ENBART documentId som returneras av get_template_laws eller search_laws. Konstruera ALDRIG egna ID:n. Ogiltiga ID:n filtreras bort automatiskt.**
- Om ett dokument redan finns i listan hoppas det över automatiskt.
- Sök INTE efter exakt samma sak mer än en gång — om en sökning inte hittar något, omformulera eller gå vidare.`

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

/**
 * Move the conversation cache breakpoints to the tail of the message list.
 *
 * The agent loop re-sends the entire message history on every step, and the
 * template tool results are huge (the arbetsmiljö template alone is ~90k
 * tokens) — without message-level breakpoints each step re-bills the full
 * history at base input price. Marking the last two messages `ephemeral`
 * makes the next step read the shared prefix from cache at 0.1× price.
 *
 * Two breakpoints (not one) because Anthropic's cache lookup only scans ~20
 * content blocks backwards from each breakpoint — a step with many parallel
 * tool calls can push the previous breakpoint position out of that window.
 * Anthropic allows 4 breakpoints total: 1 on the system prompt + these 2
 * stays within budget. Existing anthropic providerOptions are stripped first
 * so breakpoints never accumulate across steps.
 */
function withTailCacheBreakpoints(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((message, index) => {
    const { anthropic: _stale, ...otherProviderOptions } =
      message.providerOptions ?? {}

    if (index < messages.length - 2) {
      return { ...message, providerOptions: otherProviderOptions }
    }

    return {
      ...message,
      providerOptions: {
        ...otherProviderOptions,
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
    } as ModelMessage
  })
}

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
    model: anthropic(GENERATION_MODEL),
    // Adaptive thinking (high effort) — see GENERATION_THINKING_PROVIDER_OPTIONS.
    // Applies to the model across every step of the agentic loop.
    providerOptions: GENERATION_THINKING_PROVIDER_OPTIONS,
    // Anthropic prompt caching, two tiers (5-min TTL on both):
    //  1. System breakpoint (below): caches tool definitions + SYSTEM_PROMPT
    //     (~2350 tokens, above Sonnet's 1024-token caching minimum). Mirrors
    //     app/api/chat/route.ts.
    //  2. Conversation breakpoints (prepareStep below): each step re-marks the
    //     two newest messages so the growing history — dominated by ~90k-token
    //     template tool results — is read from cache instead of re-billed at
    //     full input price on every one of the up-to-20 steps.
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
    prepareStep: ({ messages }) => ({
      messages: withTailCacheBreakpoints(messages),
    }),
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

  // AI SDK v6 cache-write field location varies by provider/version — same
  // dual lookup as app/api/chat/route.ts (Story 14.26 runtime evidence).
  const usageAsRecord = result.totalUsage as unknown as {
    cacheCreationInputTokens?: number
    inputTokenDetails?: { cacheWriteTokens?: number }
  }

  return {
    listId: lawList?.id ?? null,
    itemCount: lawList?._count.items ?? 0,
    groups: lawList?.groups.map((g) => g.name) ?? [],
    model: GENERATION_MODEL,
    tokensUsed: {
      input: result.totalUsage.inputTokens ?? 0,
      output: result.totalUsage.outputTokens ?? 0,
      cacheRead: result.totalUsage.cachedInputTokens ?? 0,
      cacheWrite:
        usageAsRecord.cacheCreationInputTokens ??
        usageAsRecord.inputTokenDetails?.cacheWriteTokens ??
        0,
    },
    durationMs,
  }
}
