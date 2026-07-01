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
import {
  baselineFormLabel,
  resolveBaselineForm,
  resolveBaselineLaws,
} from '@/lib/agent/skills/baseline-laws'

// Law-list generation runs ONCE per workspace (onboarding) and is the user's
// first impression of the product, so it defaults to the strongest model with a
// high reasoning budget — the per-run cost is negligible at this frequency and
// the task is reasoning-heavy (derive applicable agencies, mine the free-text
// description, judge each föreskrift). Override via LAW_LIST_GENERATION_MODEL
// (e.g. claude-sonnet-5 or claude-fable-5) to A/B output quality vs cost.
// NB: claude-sonnet-5 was A/B'd 2026-07-01 and under-discovered badly on this
// flow (31 vs 71 items for the Nordvik school fixture; 0 SKOLFS vs 4) — Opus 4.8
// stays the default; Sonnet is also worse per-discovered-law here.
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
// Adaptive-thinking provider options at a given effort tier. See
// thinking-effort.ts for why `thinking.type:'adaptive'` + explicit
// `display:'summarized'` are required (effort alone = thinking off; Opus
// defaults display to 'omitted').
function thinkingProviderOptions(effort: 'medium' | 'high' | 'xhigh') {
  return {
    anthropic: {
      thinking: { type: 'adaptive' as const, display: 'summarized' as const },
      effort,
    },
  }
}

// Phase A (build) runs at HIGH effort. Phase B effort is set per-pass in
// AUDIT_PASSES: the discovery pass earns the top tier (it does the hard
// regime-finding reasoning — e.g. spotting that a school's health team is
// healthcare under HSL), while the mechanical consolidation pass stays at
// medium. This split keeps the deep catches without blowing the ~600s budget.
const GENERATION_THINKING_PROVIDER_OPTIONS = thinkingProviderOptions('high')

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
  /**
   * Agentic step counts per phase. Recorded so "did we hit stepCountIs?" is an
   * observable number instead of inference from the deduped progress trace.
   * `audit` is the SUM across all loop-until-dry passes (null when Phase B is
   * disabled); `auditPasses` is how many audit passes ran (0 when disabled).
   */
  steps: {
    generation: number
    audit: number | null
    auditPasses: number
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
De grundläggande bolags-, skatte- och redovisningslagarna för företagets juridiska form har redan lagts till automatiskt (bl.a. bokförings-, skatte- och bolagsformslagar). Fokusera på bransch- och verksamhetsspecifika lagar och föreskrifter istället. Om du ändå råkar lägga till en redan tillagd lag hoppas den över automatiskt.

## Regler
- Sikta på en heltäckande lista — typiskt 40-80 dokument, men låt verksamhetens komplexitet styra. En verksamhet med många myndighetsföreskrifter (t.ex. skola, vård) kan med rätta ha fler.
- Inkludera ALLTID relevanta myndighetsföreskrifter — annars är listan ofullständig.
- Lägg INTE till regler som tydligt inte gäller — kvalitet framför kvantitet.
- Använd ALLTID svenska gruppnamn: "Arbetsrätt", "Bolagsrätt", "Skatt & Redovisning", "Miljö & Kemikalier", "Dataskydd", "Arbetsmiljö", "Konsumenträtt", "Byggrätt", "Skola & Utbildning", etc. Skapa INTE överlappande grupper — t.ex. använd "Skatt & Redovisning" istället för separata "Skatt" och "Redovisning".
- **KRITISKT: Använd ENBART documentId som returneras av get_template_laws eller search_laws. Konstruera ALDRIG egna ID:n. Ogiltiga ID:n filtreras bort automatiskt.**
- Om ett dokument redan finns i listan hoppas det över automatiskt.
- Sök INTE efter exakt samma sak mer än en gång — om en sökning inte hittar något, omformulera eller gå vidare.`

// Phase B (gap audit) kill-switch. On by default; set LAW_LIST_GAP_AUDIT=false
// to skip the second pass (e.g. to A/B its contribution or cut latency/cost).
const GAP_AUDIT_ENABLED = process.env.LAW_LIST_GAP_AUDIT !== 'false'

// System prompt for the independent gap-audit pass (Phase B). Deliberately a
// SEPARATE call with fresh context, not in-loop self-review: a model that
// anchored on the company's headline industry while building (e.g. "school" ->
// Skolverket/Arbetsmiljöverket) carries the same blind spot into self-critique,
// so its errors are correlated. A cold pass that sees only (profile + finished
// list) and is told to hunt for ABSENT regimes decorrelates those errors — the
// same reason a fresh human reviewer catches what the author missed. The
// role/regime checklist below is the auditor's explicit mandate.
const GAP_AUDIT_SYSTEM_PROMPT = `Du är en oberoende compliance-granskare. En kollega har redan byggt ett utkast till laglista åt företaget. Din ENDA uppgift är att hitta vad som SAKNAS — inte att bekräfta det som redan finns.

Du har en fördel kollegan saknade: du ser den färdiga listan med fräscha ögon. Utgå INTE från listans struktur — utgå från företaget och fråga vilket helt regelområde som inte är representerat. Svenska företag lyder samtidigt under flera parallella regelverk; en lista som täcker branschen men missar t.ex. miljö/hälsoskydd eller barnrätt är ofullständig.

## Arbetsordning
1. Anropa \`get_company_context\` och läs verksamhetsbeskrivningen noggrant.
2. Gå igenom rollerna nedan. För VARJE roll företaget har: finns minst ett regelverk i den befintliga listan som täcker den? Om inte — det är en lucka.
3. Anropa \`search_laws\` för varje lucka (parallellt). Använd \`contentType: "AGENCY_REGULATION"\` när du letar efter myndighetsföreskrifter så de inte trängs undan.
4. Anropa \`add_laws_to_list\` med det som FAKTISKT gäller. Dubbletter hoppas över automatiskt — men lägg ALDRIG till sådant som tydligt inte gäller.

## Roller att kontrollera (härled utifrån profilen, inte branschen)
- **Har anställda?** → arbetsrätt, arbetsmiljö (AML + AFS), diskriminering, visselblåsarlag (≥50 anst.)
- **Egna/förhyrda lokaler eller bedriver verksamhet?** → miljöbalken (egenkontroll, ofta anmälnings-/tillståndsplikt till kommunens miljö- och hälsoskyddsnämnd), avfallshantering (avfallsförordningen + kommunens renhållnings-/avfallsföreskrifter; sorteringskrav inkl. matavfall — gäller i princip ALL verksamhet, inte bara kemikalieintensiv), brandskydd (LSO + systematiskt brandskyddsarbete), plan- och bygglag/OVK, elsäkerhet, tillgänglighet
- **Behandlar personuppgifter?** → GDPR + dataskyddslagen + ev. registerförfattningar
- **Arbetar med barn, elever, patienter eller andra skyddsvärda grupper?** → registerkontroll, barnkonventionen (lag 2018:1197), sekretess/tystnadsplikt
- **Bedriver hälso- eller sjukvård som del av verksamheten?** (t.ex. skolhälsovård/elevhälsans medicinska insats, företagshälsovård, vård/omsorg) → hälso- och sjukvårdslagen, patientsäkerhetslagen, patientdatalagen
- **Privat aktör med offentlig finansiering (friskola, privat vård/omsorg)?** → meddelarskydd i enskild verksamhet (lag 2017:151)
- **Hanterar livsmedel?** → livsmedelslag + EU 852/2004 + LIVSFS (operativa hygienregler)
- **Hanterar kemikalier/farligt avfall?** → REACH, KIFS, avfallsförordning
Vägledande, inte uttömmande — härled ytterligare regelområden ur profilen.

## Rätt nivå — kontrollera åt BÅDA hållen
- Finns en lag men saknas dess bindande föreskrifter? Lägg till föreskrifterna. (livsmedelslagen → EU 852/2004 + LIVSFS; arbetsmiljölagen → AFS.)
- Finns föreskrifter men saknas den lag eller förordning de meddelats med stöd av? Lägg till den. (T.ex. om förordningar under miljöbalken finns i listan men miljöbalken 1998:808 saknas — lägg till balken.)
En lag utan sina föreskrifter, ELLER föreskrifter utan sin överordnade författning, är en lucka.

## Regler
- Använd ENBART documentId från search_laws. Konstruera ALDRIG egna ID:n.
- Återanvänd den befintliga listans svenska gruppnamn när det passar (t.ex. "Arbetsmiljö", "Miljö & Kemikalier", "Skola & Utbildning").
- Är listan redan heltäckande: lägg inte till något. Det är ett giltigt resultat.`

// Pass 2 of Phase B — a NARROW consolidation pass, deliberately different from
// the broad discovery pass above. Its only job is structural pairing (anchor a
// föreskrift's parent statute, or a statute's missing core föreskrift) — the
// gaps that the discovery pass's OWN additions create. It is told NOT to hunt
// new regelområden and to default to adding nothing. This is what prevents the
// precision decay that open-ended loop-until-dry would cause on an additive
// task: later passes can only consolidate, never pad.
const CONSOLIDATION_SYSTEM_PROMPT = `Du är en granskare som gör en sista konsolidering. En laglista har redan byggts och genomgått en första luckanalys. Detta är en SISTA, SNÄV kontroll — INTE en ny genomgång av luckor.

Din uppgift är ENBART att para ihop lagar och föreskrifter som redan finns i listan:
1. Finns föreskrifter i listan men saknas den lag eller förordning de meddelats med stöd av? Lägg till den. (T.ex. om förordningar under miljöbalken finns men miljöbalken 1998:808 saknas → lägg till balken. Om Boverkets föreskrifter finns men plan- och bygglagen 2010:900 saknas → lägg till PBL.)
2. Finns en lag vars centrala bindande föreskrift uppenbart saknas? Lägg till just den föreskriften.

Gör INGET annat. Leta INTE efter nya regelområden. Lägg INTE till lagar "för säkerhets skull". Om allt redan är ihopparat: lägg till INGET och avsluta direkt — det är det vanligaste och helt korrekta utfallet.

## Regler
- Anropa \`get_company_context\` bara om du behöver bekräfta att en överordnad lag verkligen gäller.
- Använd ENBART documentId från search_laws. Konstruera ALDRIG egna ID:n.
- Återanvänd den befintliga listans gruppnamn.
- Standardläge: lägg till noll. Lägg bara till det som DIREKT förankrar något som redan finns i listan.`

// Baseline laws are now resolved per företagsform in lib/agent/skills/baseline-laws.ts
// (universal + form-specific + fact-gated conditionals) and pre-seeded in generateLawList.

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

/**
 * AI SDK v6 cache-write field location varies by provider/version — same dual
 * lookup as app/api/chat/route.ts (Story 14.26 runtime evidence).
 */
function cacheWriteTokens(totalUsage: unknown): number {
  const u = totalUsage as {
    cacheCreationInputTokens?: number
    inputTokenDetails?: { cacheWriteTokens?: number }
  }
  return (
    u.cacheCreationInputTokens ?? u.inputTokenDetails?.cacheWriteTokens ?? 0
  )
}

/**
 * Render the workspace's current default list as grouped plain text, so the
 * Phase B auditor sees EXACTLY which regelverk already exist (and can reason
 * about which whole regimes are absent). Cheaper and more precise than handing
 * it a tool to read the list back.
 */
async function formatCurrentListForAudit(workspaceId: string): Promise<{
  text: string
  count: number
}> {
  const lawList = await prisma.lawList.findFirst({
    where: { workspace_id: workspaceId, is_default: true },
    select: { id: true },
  })
  if (!lawList) return { text: '(listan är tom)', count: 0 }

  const items = await prisma.lawListItem.findMany({
    where: { law_list_id: lawList.id },
    select: {
      document: { select: { document_number: true, title: true } },
      group: { select: { name: true } },
    },
    orderBy: { position: 'asc' },
  })

  const byGroup = new Map<string, string[]>()
  for (const i of items) {
    const g = i.group?.name ?? 'Övrigt'
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup
      .get(g)!
      .push(`${i.document.document_number} — ${i.document.title ?? ''}`)
  }

  let text = ''
  for (const [group, docs] of byGroup) {
    text += `\n## ${group}\n${docs.map((d) => `- ${d}`).join('\n')}\n`
  }
  return { text: text.trim(), count: items.length }
}

async function countListItems(workspaceId: string): Promise<number> {
  const lawList = await prisma.lawList.findFirst({
    where: { workspace_id: workspaceId, is_default: true },
    select: { _count: { select: { items: true } } },
  })
  return lawList?._count.items ?? 0
}

interface AuditPassConfig {
  /** Pass label for the audit stage (discover vs consolidate). */
  stage: 'discover' | 'consolidate'
  /** System prompt for this pass. */
  system: string
  /** Step budget. */
  maxSteps: number
  /** Adaptive-thinking effort for this pass. */
  effort: 'medium' | 'high' | 'xhigh'
}

// Phase B is a fixed two-stage pipeline, NOT an open-ended loop-until-dry:
//  1. discover — broad role/regime gap hunt (may add whole new regelområden)
//  2. consolidate — narrow structural anchoring of pass-1's own additions
// The consolidate pass has a deliberately limited mandate (pair statutes with
// föreskrifter, add nothing else), which is what bounds the precision decay an
// uncapped additive loop would cause. The pipeline stops early if a pass adds
// nothing (e.g. discover finds no gaps → consolidate never runs).
const AUDIT_PASSES: AuditPassConfig[] = [
  {
    stage: 'discover',
    system: GAP_AUDIT_SYSTEM_PROMPT,
    maxSteps: 16,
    // Medium, not high/xhigh: with known regimes encoded in the checklist
    // below, the discovery pass doesn't need to *re-infer* them, so the top
    // tiers buy little and overrun the ~600s budget (xhigh measured at 703s).
    // High/xhigh remain available via the `effort` knob for novel cases.
    effort: 'medium',
  },
  {
    stage: 'consolidate',
    system: CONSOLIDATION_SYSTEM_PROMPT,
    maxSteps: 8,
    effort: 'medium',
  },
]

/**
 * A single Phase B audit pass. Returns the generateText result plus the
 * before/after item counts so the pipeline can decide whether to run the next
 * stage. Null when there's nothing to audit (empty list).
 */
async function runGapAuditPass(
  workspaceId: string,
  tools: NonNullable<Parameters<typeof generateText>[0]['tools']>,
  config: AuditPassConfig
) {
  const current = await formatCurrentListForAudit(workspaceId)
  if (current.count === 0) return null

  const progressLabel =
    config.stage === 'discover'
      ? 'Granskar listan efter luckor'
      : 'Kopplar ihop lagar och föreskrifter'
  await updateProgress(workspaceId, progressLabel, 'active')

  const result = await generateText({
    model: anthropic(GENERATION_MODEL),
    providerOptions: thinkingProviderOptions(config.effort),
    system: {
      role: 'system' as const,
      content: config.system,
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' as const } },
      },
    },
    messages: [
      {
        role: 'user',
        content: `Här är företagets nuvarande laglista (${current.count} regelverk):\n\n${current.text}\n\nGranska den mot företagsprofilen och fyll luckorna. Börja med att hämta profilen via get_company_context.`,
      },
    ],
    tools,
    stopWhen: stepCountIs(config.maxSteps),
    prepareStep: ({ messages }) => ({
      messages: withTailCacheBreakpoints(messages),
    }),
    onStepFinish: async (event) => {
      for (const toolCall of event.toolCalls) {
        const label = TOOL_STEP_LABELS[toolCall.toolName] ?? toolCall.toolName
        await updateProgress(workspaceId, label, 'done')
      }
    },
  })

  await updateProgress(workspaceId, progressLabel, 'done')
  const after = await countListItems(workspaceId)
  return { result, before: current.count, after }
}

/**
 * Phase B — the discover→consolidate audit pipeline (see AUDIT_PASSES). The
 * consolidate stage exists because the discover pass's OWN additions can create
 * a new gap the bidirectional "rätt nivå" rule only catches on the next look —
 * e.g. adding miljö-förordningar exposes that Miljöbalken (their parent statute)
 * is absent. Stops early if a stage adds nothing. Exported so a harness can run
 * it standalone. Returns one generateText result per stage that ran.
 */
export async function runGapAudit(workspaceId: string, userId: string) {
  const tools = {
    ...createAgentTools(workspaceId, userId),
    get_template_laws: createGetTemplateLawsTool(),
    add_laws_to_list: createAddLawsToListTool(workspaceId, userId),
  }

  const results: Awaited<ReturnType<typeof generateText>>[] = []
  for (const config of AUDIT_PASSES) {
    const passResult = await runGapAuditPass(workspaceId, tools, config)
    if (!passResult) break
    results.push(passResult.result)
    // Stop early once a stage adds nothing new — no point consolidating a
    // discover pass that found no gaps.
    if (passResult.after <= passResult.before) break
  }
  return results
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

  // Pre-seed the per-företagsform baseline laws deterministically (universal +
  // form-specific corporate/registration + fact-gated conditionals). Keyed on the
  // raw CompanyProfile.legal_form so KB gets HB's law base, not AB's.
  const profile = await prisma.companyProfile.findUnique({
    where: { workspace_id: workspaceId },
    select: { legal_form: true, employee_count: true },
  })
  const baselineForm = resolveBaselineForm(profile?.legal_form ?? null)
  const baselineLaws = resolveBaselineLaws({
    form: baselineForm,
    employeeCount: profile?.employee_count ?? null,
  })

  const addTool = createAddLawsToListTool(workspaceId, userId)
  await addTool.execute!(
    { laws: baselineLaws },
    {
      toolCallId: 'pre-seed',
      messages: [],
      abortSignal: undefined as unknown as AbortSignal,
    }
  )
  await updateProgress(
    workspaceId,
    `Grundläggande lagar för ${baselineFormLabel(baselineForm)} tillagda`,
    'done',
    `${baselineLaws.length} lagar`
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

  // Generation (Phase A) complete.
  await updateProgress(workspaceId, 'Skriver anpassade beskrivningar', 'done')

  // ── Phase B: independent gap audit ──────────────────────────────────────
  // A second, fresh-context pass that sees only (profile + finished list) and
  // hunts for ABSENT regelområden — the decorrelated-error rationale is in
  // GAP_AUDIT_SYSTEM_PROMPT. Adds whatever genuinely-applicable regelverk the
  // build pass missed (dedup is automatic in add_laws_to_list).
  const auditResults = GAP_AUDIT_ENABLED
    ? await runGapAudit(workspaceId, userId)
    : []

  // Get result summary from the law list (reflects Phase A + B additions).
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

  // Token usage is summed across Phase A + every Phase B pass (shared cost pool).
  const sumUsage = (
    key: 'inputTokens' | 'outputTokens' | 'cachedInputTokens'
  ) =>
    (result.totalUsage[key] ?? 0) +
    auditResults.reduce((s, r) => s + (r.totalUsage[key] ?? 0), 0)

  return {
    listId: lawList?.id ?? null,
    itemCount: lawList?._count.items ?? 0,
    groups: lawList?.groups.map((g) => g.name) ?? [],
    model: GENERATION_MODEL,
    tokensUsed: {
      input: sumUsage('inputTokens'),
      output: sumUsage('outputTokens'),
      cacheRead: sumUsage('cachedInputTokens'),
      cacheWrite:
        cacheWriteTokens(result.totalUsage) +
        auditResults.reduce((s, r) => s + cacheWriteTokens(r.totalUsage), 0),
    },
    steps: {
      generation: result.steps.length,
      audit: auditResults.length
        ? auditResults.reduce((s, r) => s + r.steps.length, 0)
        : null,
      auditPasses: auditResults.length,
    },
    durationMs,
  }
}
