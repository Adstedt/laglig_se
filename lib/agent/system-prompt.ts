/**
 * Agent System Prompt & Behavioral Design
 * Story 14.9, Task 1 (AC: 1-8, 15-18, 20)
 *
 * Loads the base prompt from system-prompt.md and injects dynamic context.
 * The prompt content lives in a readable markdown file; this module handles
 * loading and runtime injection of company/task context.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { CompanyProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  resolveEffectiveDate,
  getEffectiveDateBadge,
} from '@/lib/utils/effective-date'
// Story 19.7a: file-based skills layer — the context-primary skill is injected
// here (replacing the old ASSESSMENT_WORKFLOW literal) + an available-skills
// catalogue. The loader is registry-agnostic and reads deploy-static files.
import {
  getPrimarySkillForContext,
  loadSkill,
  listSkills,
} from './skill-loader'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SystemPromptOptions {
  companyContext?: string | undefined
  contextType?: 'global' | 'task' | 'law' | 'change' | undefined
  contextId?: string | undefined
  /** Story 19.4a: active LawListItem id — surfaced in the LAW block so the agent
   *  can pass it to the law-item write tools (omitted when undefined). */
  lawListItemId?: string | undefined
  title?: string | undefined
  sfsNumber?: string | undefined
  summary?: string | undefined
  thinkingEnabled?: boolean | undefined
  // Story 14.22: pre-formatted <pending_agent_actions> workflow-state block
  // (built by buildPendingActionsContext). Injected after company context and
  // before subject context so the agent treats it as workflow state.
  pendingActionsBlock?: string | undefined
}

// ---------------------------------------------------------------------------
// Load base prompt from .md file (read once at module load)
// ---------------------------------------------------------------------------

const BASE_PROMPT = readFileSync(
  resolve(process.cwd(), 'lib/agent/system-prompt.md'),
  'utf-8'
).trim()

// ---------------------------------------------------------------------------
// Employee count range display mapping
// ---------------------------------------------------------------------------

const EMPLOYEE_RANGE_LABELS: Record<string, string> = {
  RANGE_1_9: '1–9',
  RANGE_10_49: '10–49',
  RANGE_50_249: '50–249',
  RANGE_250_PLUS: '250+',
  UNKNOWN: 'Okänt',
}

// ---------------------------------------------------------------------------
// Compliance maturity display mapping
// ---------------------------------------------------------------------------

const MATURITY_LABELS: Record<string, string> = {
  BASIC: 'Grundläggande',
  DEVELOPING: 'Under utveckling',
  ESTABLISHED: 'Etablerad',
  ADVANCED: 'Avancerad',
}

// ---------------------------------------------------------------------------
// formatCompanyContext
// ---------------------------------------------------------------------------

/**
 * Formats a CompanyProfile record into a Swedish context string for prompt injection.
 * Returns undefined when profile is null or has no meaningful data.
 *
 * When `workspaceName` is provided and differs from `profile.company_name`,
 * `workspaceName` is used as the authoritative name and a drift warning is
 * logged. The user-facing workspace name wins because that's what the user
 * sees in the UI — a stale CompanyProfile (e.g. from a Bolagsverket lookup
 * that wasn't re-synced after rename) must not let the agent address content
 * to the wrong entity.
 */
export function formatCompanyContext(
  profile: CompanyProfile | null,
  workspaceName?: string
): string | undefined {
  if (!profile) return undefined

  const lines: string[] = []

  const profileName = profile.company_name?.trim()
  const wsName = workspaceName?.trim()
  if (wsName && profileName && wsName !== profileName) {
    console.warn(
      `[company-context drift] workspace.name="${wsName}" ≠ CompanyProfile.company_name="${profileName}" (workspace_id=${profile.workspace_id}). Using workspace.name.`
    )
  }
  const authoritativeName = wsName || profileName
  if (authoritativeName) {
    lines.push(`- Företag: ${authoritativeName}`)
  }
  if (profile.business_description) {
    lines.push(`- Verksamhet: ${profile.business_description}`)
  }
  if (profile.org_number) {
    lines.push(`- Organisationsnummer: ${profile.org_number}`)
  }
  if (profile.industry_label && profile.sni_code) {
    lines.push(`- Bransch: ${profile.industry_label} (SNI ${profile.sni_code})`)
  } else if (profile.industry_label) {
    lines.push(`- Bransch: ${profile.industry_label}`)
  } else if (profile.sni_code) {
    lines.push(`- SNI-kod: ${profile.sni_code}`)
  }
  if (profile.employee_count_range) {
    const label =
      EMPLOYEE_RANGE_LABELS[profile.employee_count_range] ??
      profile.employee_count_range
    lines.push(`- Antal anställda: ${label}`)
  }
  if (profile.registered_date) {
    lines.push(
      `- Registrerad: ${new Date(profile.registered_date).getFullYear()}`
    )
  } else if (profile.founded_year) {
    lines.push(`- Registrerad: ${profile.founded_year}`)
  }
  if (profile.certifications && profile.certifications.length > 0) {
    lines.push(`- Certifieringar: ${profile.certifications.join(', ')}`)
  }
  if (profile.compliance_maturity) {
    const label =
      MATURITY_LABELS[profile.compliance_maturity] ??
      profile.compliance_maturity
    lines.push(`- Compliance-mognad: ${label}`)
  }

  const flags = profile.activity_flags as Record<string, boolean> | null
  if (flags && typeof flags === 'object') {
    const flagLabels: Record<string, string> = {
      chemicals: 'Hanterar kemikalier',
      construction: 'Byggverksamhet',
      food: 'Livsmedelshantering',
      personalData: 'Behandlar personuppgifter',
      publicSector: 'Offentlig sektor',
      heavyMachinery: 'Tunga maskiner',
      minorEmployees: 'Minderåriga anställda',
      internationalOperations: 'Internationell verksamhet',
    }
    const activeFlags = Object.entries(flags)
      .filter(([, v]) => v === true)
      .map(([k]) => flagLabels[k] ?? k)
    if (activeFlags.length > 0) {
      lines.push(`- Verksamhetsområden: ${activeFlags.join(', ')}`)
    }
  }

  const taxStatus = profile.tax_status as Record<string, boolean | null> | null
  if (taxStatus && typeof taxStatus === 'object') {
    if (taxStatus.f_tax != null) {
      lines.push(`- F-skatt: ${taxStatus.f_tax ? 'Ja' : 'Nej'}`)
    }
    if (taxStatus.vat != null) {
      lines.push(`- Momsregistrerad: ${taxStatus.vat ? 'Ja' : 'Nej'}`)
    }
    if (taxStatus.employer != null) {
      lines.push(
        `- Registrerad arbetsgivare: ${taxStatus.employer ? 'Ja' : 'Nej'}`
      )
    }
  }

  if (profile.foreign_owned) {
    const parentInfo = profile.parent_company_name
      ? ` (moderbolag: ${profile.parent_company_name})`
      : ''
    lines.push(`- Utlandsägt: Ja${parentInfo}`)
  }

  if (profile.fi_regulated) {
    lines.push('- Finansinspektionen-reglerad: Ja')
  }

  const procedures = profile.ongoing_procedures as Record<
    string,
    boolean
  > | null
  if (procedures && typeof procedures === 'object') {
    const procedureLabels: Record<string, string> = {
      liquidation: 'Likvidation',
      restructuring: 'Rekonstruktion',
      bankruptcy: 'Konkurs',
    }
    const activeProcedures = Object.entries(procedures)
      .filter(([, v]) => v === true)
      .map(([k]) => procedureLabels[k] ?? k)
    if (activeProcedures.length > 0) {
      lines.push(`- Pågående förfaranden: ${activeProcedures.join(', ')}`)
    }
  }

  if (profile.active_status === 'deregistered') {
    lines.push('- Status: Avregistrerad')
  }

  if (lines.length === 0) return undefined

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Reasoning guidance (appended when extended thinking is enabled)
// ---------------------------------------------------------------------------

const REASONING_GUIDANCE = `## Resonemangsvägledning

Du har utökat resonemang tillgängligt. Använd det när:
- Du bedömer om en lag gäller för ett specifikt företags situation
  (storlek, bransch/SNI, antal anställda, jurisdiktion)
- Du väger undantag, tröskelvärden eller villkor i lagen
- Du sammanställer flera källor (lag + ändringsförfattning + myndighetsföreskrift)
- Du gör en efterlevnadsbedömning eller riskvägd rekommendation
- Användaren ska agera på ditt svar (spara, delegera, publicera)

Hoppa över längre resonemang när:
- Användaren ställer en ren faktafråga ("vad är SFS 2022:123?")
- Svaret redan finns i ett dokument du hämtat via search_laws
- Frågan gäller procedur ("hur skapar jag en uppgift?")
- Ett direkt citat från primärkällan besvarar frågan helt

När du resonerar, fokusera på beslutet. Upprepa inte fakta —
arbeta genom de faktorer som påverkar slutsatsen.`

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

/**
 * Builds the system prompt by loading the base prompt from system-prompt.md
 * and appending dynamic context sections (company profile, task/law focus, change context).
 */
export async function buildSystemPrompt(
  options?: SystemPromptOptions
): Promise<string> {
  const sections: string[] = [BASE_PROMPT]

  // Company context injection (when available)
  if (options?.companyContext) {
    sections.push(
      `<company_context>\n## Om företaget\n${options.companyContext}\n</company_context>`
    )
  }

  // Story 14.22: agent feedback loop — pending/decided action proposals.
  // Injected as workflow state (after company context, before subject context).
  if (options?.pendingActionsBlock) {
    sections.push(options.pendingActionsBlock)
  }

  // Task/law/change context injection
  if (options?.contextType === 'change' && options.contextId) {
    const changeContext = await loadChangeContext(options.contextId)
    if (changeContext) {
      sections.push(`<change_context>\n${changeContext}\n</change_context>`)
    }
    // Story 19.7a: the change-context playbook is now the assess_change skill
    // (injected generically below), not a hardcoded literal.
  } else if (options?.contextType === 'task' && options.title) {
    const parts = [`Användaren arbetar med uppgiften "${options.title}".`]
    if (options.summary) {
      parts.push(`Beskrivning: ${options.summary}`)
    }
    parts.push('Fokusera svaren på denna uppgift.')
    sections.push(`<task_context>\n${parts.join(' ')}\n</task_context>`)
  } else if (options?.contextType === 'law' && options.sfsNumber) {
    const lawName = options.title ?? 'en lag'
    // Story 19.4a (SF-2): surface the active law-list item id ONLY when resolved
    // (undefined when the user browses a law not in their list) so the agent can
    // pass it to the write tools without the user pasting an id.
    const idLine = options.lawListItemId
      ? ` Aktiv laglistpost-ID: ${options.lawListItemId}. Använd detta ID för add_obligation / update_compliance_status / add_context_note.`
      : ''
    sections.push(
      `<task_context>\nAnvändaren tittar på ${lawName} (${options.sfsNumber}).${idLine} Fokusera svaren på denna lag.\n</task_context>`
    )
  }

  // Story 19.7a: inject the context-primary skill (data-driven via the skill
  // loader) — a change chat gets assess_change, replacing the former
  // ASSESSMENT_WORKFLOW literal. Then advertise the remaining skills the agent
  // can pull mid-conversation via activate_skill.
  const primarySkill = getPrimarySkillForContext(options?.contextType)
  if (primarySkill) {
    const skillBody = loadSkill(primarySkill)
    if (skillBody) sections.push(`<skill>\n${skillBody}\n</skill>`)
  }
  const otherSkills = listSkills().filter((s) => s.name !== primarySkill)
  if (otherSkills.length > 0) {
    const lines = otherSkills.map((s) => `- ${s.name}: ${s.description}`)
    sections.push(
      `<available_skills>\nDu kan ladda en färdighets fullständiga instruktioner med activate_skill(name):\n${lines.join('\n')}\n</available_skills>`
    )
  }

  // Reasoning guidance (only when extended thinking is enabled for this context)
  if (options?.thinkingEnabled) {
    sections.push(
      `<reasoning_guidance>\n${REASONING_GUIDANCE}\n</reasoning_guidance>`
    )
  }

  return sections.join('\n\n')
}

// ---------------------------------------------------------------------------
// Change context loader (Story 14.10)
// ---------------------------------------------------------------------------

async function loadChangeContext(
  changeEventId: string
): Promise<string | null> {
  const ce = await prisma.changeEvent.findUnique({
    where: { id: changeEventId },
    include: {
      document: {
        select: { title: true, document_number: true, effective_date: true },
      },
    },
  })
  if (!ce) return null

  const lines: string[] = []
  lines.push('## Lagändring som användaren vill granska')
  lines.push(`- Händelse-ID: ${ce.id}`)
  lines.push(`- Typ: ${ce.change_type}`)
  if (ce.amendment_sfs) {
    lines.push(`- Ändrings-SFS: ${ce.amendment_sfs}`)
  }
  lines.push(
    `- Berörd lag: ${ce.document.title ?? 'Okänd'} (${ce.document.document_number})`
  )

  if (ce.ai_summary) {
    lines.push(`- AI-sammanfattning: ${ce.ai_summary}`)
  }

  // Query structured section changes and amendment full text from SectionChange table (via AmendmentDocument)
  let hasAmendmentText = false
  if (ce.amendment_sfs) {
    const amendmentDoc = await prisma.amendmentDocument.findFirst({
      where: { sfs_number: ce.amendment_sfs },
      select: {
        id: true,
        full_text: true,
        proposition_title: true,
        proposition_summary: true,
        proposition_organ: true,
      },
    })
    if (amendmentDoc) {
      const sections = await prisma.sectionChange.findMany({
        where: { amendment_id: amendmentDoc.id },
        orderBy: { sort_order: 'asc' },
        select: { chapter: true, section: true, change_type: true },
      })
      if (sections.length > 0) {
        const changeTypeLabels: Record<string, string> = {
          AMENDED: 'ändrad',
          REPEALED: 'upphävd',
          NEW: 'ny',
          RENUMBERED: 'omnumrerad',
        }
        const formatted = sections
          .map((s) => {
            const label = changeTypeLabels[s.change_type] ?? s.change_type
            const prefix = s.chapter ? `Kap ${s.chapter} ` : ''
            return `${prefix}§ ${s.section} (${label})`
          })
          .join(', ')
        lines.push(`- Berörda paragrafer: ${formatted}`)
      }

      // Include the amendment's own full text (authoritative, typically 2-5K chars)
      if (amendmentDoc.full_text) {
        hasAmendmentText = true
        lines.push('')
        lines.push('## Ändringstext (från den publicerade författningen)')
        lines.push(
          'Nedan visas den fullständiga ändringstexten såsom den publicerats i Svensk författningssamling. Basera din sammanfattning på denna text.'
        )
        lines.push('')
        lines.push(amendmentDoc.full_text)
      }

      // Include proposition context if available (Story 8.24)
      if (amendmentDoc.proposition_title) {
        lines.push('')
        lines.push('## Bakgrund (från propositionen)')
        const organSuffix = amendmentDoc.proposition_organ
          ? ` (${amendmentDoc.proposition_organ})`
          : ''
        lines.push(`**${amendmentDoc.proposition_title}**${organSuffix}`)
        if (amendmentDoc.proposition_summary) {
          lines.push(amendmentDoc.proposition_summary)
        }
      }
    }
  }

  // Resolve effective date
  const effectiveDate = await resolveEffectiveDate(ce)
  if (effectiveDate) {
    const badge = getEffectiveDateBadge(effectiveDate)
    lines.push(`- Ikraftträdande: ${badge.text}`)
  }

  // Fall back to diff_summary only when no amendment full text is available
  if (!hasAmendmentText && ce.diff_summary) {
    const compactDiff = extractCompactDiff(ce.diff_summary)
    if (compactDiff) {
      lines.push('')
      lines.push('## Ändringar (diff)')
      lines.push(
        'Nedan visas de faktiska textändringarna. Rader med + är ny text, rader med - är borttagen text.'
      )
      lines.push('')
      lines.push(compactDiff)
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Diff extraction — strips unchanged context, keeps only changes + headers
// ---------------------------------------------------------------------------

/** Max chars for the compact diff (~4000 tokens) */
const DIFF_BUDGET_CHARS = 16_000

/**
 * Extracts a compact version of a unified diff:
 * - Keeps hunk headers (@@ lines) for location context
 * - Keeps added (+) and removed (-) lines
 * - Keeps up to 2 context lines around each change for readability
 * - For small diffs (under budget), returns the full diff
 */
export function extractCompactDiff(diff: string): string | null {
  if (!diff || diff.trim().length === 0) return null

  // If the whole diff fits within budget, return it as-is
  if (diff.length <= DIFF_BUDGET_CHARS) return diff.trim()

  const lines = diff.split('\n')
  const output: string[] = []
  const contextWindow = 2

  // Track which lines are "interesting" (changed or hunk headers)
  const interesting = new Set<number>()
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? ''
    if (l.startsWith('@@') || l.startsWith('+') || l.startsWith('-')) {
      // Skip the file header lines (--- and +++ at the top)
      if (l.startsWith('---') || l.startsWith('+++')) continue
      interesting.add(i)
      // Add context window around changes
      for (
        let j = Math.max(0, i - contextWindow);
        j <= Math.min(lines.length - 1, i + contextWindow);
        j++
      ) {
        interesting.add(j)
      }
    }
  }

  let prevIncluded = -1
  let totalChars = 0

  for (let i = 0; i < lines.length; i++) {
    if (!interesting.has(i)) continue
    const l = lines[i] ?? ''

    // Add separator when there's a gap
    if (prevIncluded >= 0 && i - prevIncluded > 1) {
      output.push('  [...]')
    }

    output.push(l)
    totalChars += l.length + 1
    prevIncluded = i

    // Stop if we exceed budget
    if (totalChars > DIFF_BUDGET_CHARS) {
      output.push('')
      output.push(
        '[... diff trunkerad, använd get_change_details för fullständig information]'
      )
      break
    }
  }

  const result = output.join('\n').trim()
  return result.length > 0 ? result : null
}

// ---------------------------------------------------------------------------
// Story 19.7a: the change-assessment playbook (formerly the ASSESSMENT_WORKFLOW
// literal here) now lives in lib/agent/skills/assess_change/ and is injected via
// the skill loader — getPrimarySkillForContext('change') → 'assess_change'.
// ---------------------------------------------------------------------------
