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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SystemPromptOptions {
  companyContext?: string | undefined
  contextType?: 'global' | 'task' | 'law' | undefined
  contextId?: string | undefined
  title?: string | undefined
  sfsNumber?: string | undefined
  summary?: string | undefined
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
 */
export function formatCompanyContext(
  profile: CompanyProfile | null
): string | undefined {
  if (!profile) return undefined

  const lines: string[] = []

  if (profile.company_name) {
    lines.push(`- Företag: ${profile.company_name}`)
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

  if (lines.length === 0) return undefined

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

/**
 * Builds the system prompt by loading the base prompt from system-prompt.md
 * and appending dynamic context sections (company profile, task/law focus).
 */
export function buildSystemPrompt(options?: SystemPromptOptions): string {
  const sections: string[] = [BASE_PROMPT]

  // Company context injection (when available)
  if (options?.companyContext) {
    sections.push(
      `<company_context>\n## Om företaget\n${options.companyContext}\n</company_context>`
    )
  }

  // Task/law context injection
  if (options?.contextType === 'task' && options.title) {
    const parts = [`Användaren arbetar med uppgiften "${options.title}".`]
    if (options.summary) {
      parts.push(`Beskrivning: ${options.summary}`)
    }
    parts.push('Fokusera svaren på denna uppgift.')
    sections.push(`<task_context>\n${parts.join(' ')}\n</task_context>`)
  } else if (options?.contextType === 'law' && options.sfsNumber) {
    const lawName = options.title ?? 'en lag'
    sections.push(
      `<task_context>\nAnvändaren tittar på ${lawName} (${options.sfsNumber}). Fokusera svaren på denna lag.\n</task_context>`
    )
  }

  return sections.join('\n\n')
}
