/**
 * Unit tests for the role-based tool registry filter (Story 19.5, Task 1 + 6).
 * AUDITOR gets read tools only; MEMBER/undefined get the full set.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { agentDecisionLog: { create: vi.fn() } },
}))

import { createAgentTools, TOOL_REGISTRY_POLICY } from '@/lib/agent/tools'

const WRITE_TOOLS = Object.entries(TOOL_REGISTRY_POLICY)
  .filter(([, tier]) => tier === 'write')
  .map(([name]) => name)

const READ_TOOLS = Object.entries(TOOL_REGISTRY_POLICY)
  .filter(([, tier]) => tier === 'read')
  .map(([name]) => name)

describe('createAgentTools — role filter (Story 19.5)', () => {
  it('AUDITOR receives NO write tools (read-only), still gets reads', () => {
    const keys = Object.keys(createAgentTools('ws', 'u', {}, 'AUDITOR'))
    for (const w of WRITE_TOOLS) expect(keys).not.toContain(w)
    // every returned key is a read-tier tool
    for (const k of keys) expect(READ_TOOLS).toContain(k)
    expect(keys).toContain('search_laws')
    expect(keys).toContain('search_workspace_files')
    // Story 19.2: read_file is a read-tier tool → AUDITOR keeps it.
    expect(keys).toContain('read_file')
    // Story 19.4a: discovery tools are read-tier → AUDITOR keeps them.
    expect(keys).toContain('search_law_list_items')
    expect(keys).toContain('search_tasks')
    // Story 19.4: entity-readers are read-tier → AUDITOR keeps them.
    expect(keys).toContain('get_law_list_item')
    expect(keys).toContain('get_task')
    expect(keys).toContain('list_linked_artifacts')
    // Story 19.3: diagnostic aggregates are read-tier → AUDITOR keeps them.
    expect(keys).toContain('list_bevis_gaps')
    expect(keys).toContain('list_unassessed_changes')
    expect(keys).toContain('list_overdue')
    expect(keys).toContain('list_stale_documents')
    // Story 19.7a: activate_skill is read-tier → AUDITOR keeps it.
    expect(keys).toContain('activate_skill')
  })

  it('MEMBER receives the full set (has tasks:edit)', () => {
    const keys = Object.keys(createAgentTools('ws', 'u', {}, 'MEMBER'))
    expect(keys).toContain('create_task')
    expect(keys).toContain('draft_styrdokument')
    // Story 14.28: the new write tool is present for write-capable roles.
    expect(keys).toContain('update_requirement')
    expect(keys).toHaveLength(29) // web_search is injected at the route, not here
  })

  it('OWNER receives the full set', () => {
    const keys = Object.keys(createAgentTools('ws', 'u', {}, 'OWNER'))
    expect(keys).toContain('create_task')
    expect(keys).toHaveLength(29)
  })

  it('undefined role → full set (backward compat for legacy callers)', () => {
    const keys = Object.keys(createAgentTools('ws', 'u', {}))
    expect(keys).toHaveLength(29)
    expect(keys).toContain('assign_task')
  })

  it('TOOL_REGISTRY_POLICY covers exactly the factory tools + web_search', () => {
    const policyKeys = Object.keys(TOOL_REGISTRY_POLICY).sort()
    const factoryKeys = Object.keys(createAgentTools('ws', 'u', {})).sort()
    // policy = factory tools ∪ {web_search}
    expect(policyKeys).toEqual([...factoryKeys, 'web_search'].sort())
  })
})
