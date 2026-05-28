/**
 * No-regression harness for per-skill tool-registry narrowing (Story 19.7c).
 *
 * Guards the one real failure mode: a narrowed context must never lose a tool
 * its flow actually uses. The per-context "flow-required" sets below are
 * HAND-MAINTAINED constants sourced from the skill PROCEDUREs (lib/agent/skills/**)
 * + system-prompt.md tool-guidance. This catches ALWAYS_AVAILABLE / whitelist
 * *misconfiguration* — NOT drift in the procedures: if you add a tool call to a
 * PROCEDURE, add it to the relevant set below too.
 *
 * Runs against the REAL shipped skills (via getSkillToolWhitelist), not fixtures.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { agentDecisionLog: { create: vi.fn() } },
}))

import { createAgentTools, TOOL_REGISTRY_POLICY } from '@/lib/agent/tools'
import { getPrimarySkillForContext } from '@/lib/agent/skill-loader'
import type { WorkspaceRole } from '@prisma/client'

type Ctx = 'global' | 'task' | 'law' | 'change'

// The full factory set = policy keys minus the route-injected web_search.
const FULL = Object.keys(TOOL_REGISTRY_POLICY)
  .filter((n) => n !== 'web_search')
  .sort()

// What the chat route computes for `activeSkills` in each context.
const activeFor = (ctx: Ctx): string[] => {
  const s = getPrimarySkillForContext(ctx)
  return s ? [s] : []
}

const toolKeys = (
  role: WorkspaceRole | undefined,
  activeSkills: string[] | undefined
): string[] =>
  Object.keys(createAgentTools('ws', 'u', {}, role, activeSkills)).sort()

// assess_change PROCEDURE prep phase + bedömning proposals (the flow that would
// break if narrowing dropped the reads it calls but doesn't declare).
const CHANGE_FLOW_REQUIRED = [
  'get_company_context',
  'search_laws',
  'get_change_details',
  'get_law_list_item',
  'list_linked_artifacts',
  'suggest_followups',
  'save_assessment',
  'create_task',
  'add_obligation',
  'update_compliance_status',
  'add_context_note',
]

// gap_analysis PROCEDURE: four diagnostics + capped Tier-2 proposal tools + the
// ability to pull a skill on demand.
const GLOBAL_FLOW_REQUIRED = [
  'list_bevis_gaps',
  'list_unassessed_changes',
  'list_overdue',
  'list_stale_documents',
  'create_task',
  'add_obligation',
  'update_compliance_status',
  'draft_styrdokument',
  'activate_skill',
]

describe('registry narrowing — no-regression harness (Story 19.7c)', () => {
  it('sanity: full factory registry is 28 tools (update flow-required sets if this changes)', () => {
    expect(FULL).toHaveLength(28)
  })

  it('activeSkills undefined → full set (legacy callers unaffected)', () => {
    expect(toolKeys('MEMBER', undefined)).toHaveLength(28)
    expect(toolKeys(undefined, undefined)).toHaveLength(28)
  })

  it('change context keeps every tool the assessment flow uses', () => {
    const k = toolKeys('MEMBER', activeFor('change'))
    for (const t of CHANGE_FLOW_REQUIRED) expect(k).toContain(t)
  })

  it('change context loses NOTHING (ALWAYS_AVAILABLE ∪ assess_change whitelist === full)', () => {
    expect(toolKeys('MEMBER', activeFor('change'))).toEqual(FULL)
  })

  it('global narrows out exactly save_assessment + keeps the gap_analysis flow', () => {
    const k = toolKeys('MEMBER', activeFor('global'))
    for (const t of GLOBAL_FLOW_REQUIRED) expect(k).toContain(t)
    expect(k).not.toContain('save_assessment')
    expect(k).toEqual(FULL.filter((n) => n !== 'save_assessment'))
  })

  it('task and law contexts also remove only save_assessment', () => {
    for (const ctx of ['task', 'law'] as const) {
      const k = toolKeys('MEMBER', activeFor(ctx))
      expect(k).toEqual(FULL.filter((n) => n !== 'save_assessment'))
    }
  })

  it('AUDITOR: narrowing is a no-op (read-only set identical with/without activeSkills)', () => {
    const unNarrowed = toolKeys('AUDITOR', undefined)
    expect(toolKeys('AUDITOR', activeFor('change'))).toEqual(unNarrowed)
    expect(toolKeys('AUDITOR', activeFor('global'))).toEqual(unNarrowed)
    // save_assessment is write-tier → AUDITOR never has it regardless of skill.
    expect(toolKeys('AUDITOR', activeFor('change'))).not.toContain(
      'save_assessment'
    )
  })

  it('activeSkills [] → baseline only (save_assessment gated, 27 tools)', () => {
    const k = toolKeys('MEMBER', [])
    expect(k).not.toContain('save_assessment')
    expect(k).toHaveLength(27)
  })
})
