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
    // Story 7.7: CA search is read-tier + unconditional → AUDITOR keeps it.
    expect(keys).toContain('search_collective_agreements')
    // Story 7.7 Task 2b: lookup_employee is role-conditional on
    // employees:view — AUDITOR lacks it → tool ABSENT (not refusing).
    expect(keys).not.toContain('lookup_employee')
    // Story 7.10: get_employee_salary is role-conditional on employees:manage
    // — AUDITOR lacks it → tool ABSENT.
    expect(keys).not.toContain('get_employee_salary')
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

  it('MEMBER receives the full set (has tasks:edit) — minus lookup_employee (no employees:view)', () => {
    const keys = Object.keys(createAgentTools('ws', 'u', {}, 'MEMBER'))
    expect(keys).toContain('create_task')
    expect(keys).toContain('draft_styrdokument')
    // Story 14.28: the new write tool is present for write-capable roles.
    expect(keys).toContain('update_requirement')
    // Story 17.11: update_document is also a write tool — bumps count by 1.
    expect(keys).toContain('update_document')
    // Story 17.11b: add_document_section is a write tool — bumps count by 1.
    expect(keys).toContain('add_document_section')
    // Story 7.7: search_collective_agreements bumps count by 1 (35);
    // lookup_employee is NOT here — MEMBER lacks employees:view.
    expect(keys).toContain('search_collective_agreements')
    expect(keys).not.toContain('lookup_employee')
    // Story 7.10: get_employee_salary is NOT here — MEMBER lacks
    // employees:manage.
    expect(keys).not.toContain('get_employee_salary')
    expect(keys).toHaveLength(35) // web_search is injected at the route, not here
  })

  it('OWNER receives the full set incl. lookup_employee + get_employee_salary', () => {
    const keys = Object.keys(createAgentTools('ws', 'u', {}, 'OWNER'))
    expect(keys).toContain('create_task')
    // Story 7.7 Task 2b: OWNER holds employees:view → tool registered.
    expect(keys).toContain('lookup_employee')
    // Story 7.10: OWNER holds employees:manage → salary tool registered.
    expect(keys).toContain('get_employee_salary')
    expect(keys).toHaveLength(37)
  })

  it('HR_MANAGER gets lookup_employee (view) + get_employee_salary (manage)', () => {
    const keys = Object.keys(createAgentTools('ws', 'u', {}, 'HR_MANAGER'))
    expect(keys).toContain('lookup_employee')
    expect(keys).toContain('get_employee_salary')
  })

  it('ADMIN gets neither lookup_employee nor get_employee_salary (no employees perms)', () => {
    const keys = Object.keys(createAgentTools('ws', 'u', {}, 'ADMIN'))
    expect(keys).not.toContain('lookup_employee')
    expect(keys).not.toContain('get_employee_salary')
  })

  it('undefined role → full set minus the employee-gated tools (fail-closed)', () => {
    const keys = Object.keys(createAgentTools('ws', 'u', {}))
    expect(keys).toHaveLength(35)
    expect(keys).toContain('assign_task')
    // Story 7.7 Task 2b: no role → no employees:view proof → tool absent.
    expect(keys).not.toContain('lookup_employee')
    // Story 7.10: no role → no employees:manage proof → salary tool absent.
    expect(keys).not.toContain('get_employee_salary')
  })

  it('TOOL_REGISTRY_POLICY covers exactly the factory tools + web_search', () => {
    const policyKeys = Object.keys(TOOL_REGISTRY_POLICY).sort()
    // OWNER holds employees:view → the factory builds its complete set
    // (incl. the role-conditional lookup_employee).
    const factoryKeys = Object.keys(
      createAgentTools('ws', 'u', {}, 'OWNER')
    ).sort()
    // policy = factory tools ∪ {web_search}
    expect(policyKeys).toEqual([...factoryKeys, 'web_search'].sort())
  })
})
