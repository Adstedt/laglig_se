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
import {
  getPrimarySkillForContext,
  getSkillToolWhitelist,
} from '@/lib/agent/skill-loader'
import type { WorkspaceRole } from '@prisma/client'

type Ctx = 'global' | 'task' | 'law' | 'change'

// The full factory set = policy keys minus the route-injected web_search and
// minus the role-conditional lookup_employee (Story 7.7: registered only for
// roles holding employees:view — the MEMBER used throughout lacks it; its
// presence/absence matrix is pinned in registry-role-filter.test.ts).
const FULL = Object.keys(TOOL_REGISTRY_POLICY)
  .filter((n) => n !== 'web_search' && n !== 'lookup_employee')
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
  // Story 17.11b: bumped 33 → 34 (added add_document_section write tool).
  // Story 7.7: bumped 34 → 35 (added search_collective_agreements; the also-
  // added lookup_employee is role-conditional and excluded from FULL above).
  it('sanity: full factory registry is 35 tools (update flow-required sets if this changes)', () => {
    expect(FULL).toHaveLength(35)
  })

  it('activeSkills undefined → full set (legacy callers unaffected)', () => {
    expect(toolKeys('MEMBER', undefined)).toHaveLength(35)
    expect(toolKeys(undefined, undefined)).toHaveLength(35)
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

  it('activeSkills [] → baseline only (save_assessment gated, 34 tools)', () => {
    const k = toolKeys('MEMBER', [])
    expect(k).not.toContain('save_assessment')
    // Story 17.11b: bumped 32 → 33 (added add_document_section to baseline).
    // Story 7.7: bumped 33 → 34 (search_collective_agreements in baseline).
    expect(k).toHaveLength(34)
  })

  // Story 7.7 Task 2b: when the role DOES hold employees:view, both new tools
  // are in ALWAYS_AVAILABLE — skill narrowing must never drop them.
  it('OWNER keeps lookup_employee + search_collective_agreements under narrowing', () => {
    for (const ctx of ['global', 'task', 'law', 'change'] as const) {
      const k = toolKeys('OWNER', activeFor(ctx))
      expect(k).toContain('lookup_employee')
      expect(k).toContain('search_collective_agreements')
    }
  })

  // Story 19.8: draft_styrdokument is ACTIVATION-ONLY (contextTypes: []) — it is
  // never a primary skill, and the route does not re-narrow the registry on
  // mid-conversation activate_skill. The safety invariant that makes that sound:
  // every tool the skill declares must already be in ALWAYS_AVAILABLE (i.e.
  // present in the baseline registry built with activeSkills: []).
  it('draft_styrdokument (activation-only): declared whitelist ⊆ ALWAYS_AVAILABLE baseline', () => {
    const whitelist = getSkillToolWhitelist('draft_styrdokument')
    expect(whitelist.length).toBeGreaterThan(0) // the skill exists and declares tools
    const baseline = toolKeys('MEMBER', [])
    for (const t of whitelist) expect(baseline).toContain(t)
    // And it is genuinely never context-primary:
    for (const ctx of ['global', 'task', 'law', 'change'] as const) {
      expect(getPrimarySkillForContext(ctx)).not.toBe('draft_styrdokument')
    }
  })
})
