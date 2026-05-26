/**
 * Unit tests for the tool-response wrappers (lib/agent/tools/utils.ts).
 *
 * Regression guard: a write tool's surface is the inline approval card, so its
 * result must NOT carry sidebarHint 'open' (which makes ToolAutoOpener pop a
 * sidebar dumping the raw {pendingActionId} envelope). Pre-existing bug since
 * 2026-03-26 (commit 82a1415f), surfaced by the gap_analysis flow (Story 19.7b smoke).
 */

import { it, expect } from 'vitest'
import {
  wrapWriteToolResponse,
  wrapToolResponse,
} from '@/lib/agent/tools/utils'

it('wrapWriteToolResponse does NOT auto-open the sidebar (no sidebarHint "open")', () => {
  const res = wrapWriteToolResponse(
    'create_task',
    'create_task',
    { title: 'Test' },
    'Skapa uppgift: "Test"',
    Date.now()
  )
  expect(res._meta.sidebarHint).not.toBe('open')
  expect(res._meta.sidebarHint).toBe('none')
  // the envelope itself is unchanged (still a proposal)
  expect(res.confirmation_required).toBe(true)
})

it('wrapToolResponse keeps the suggest hint for detail-bearing read tools', () => {
  const suggested = wrapToolResponse(
    'get_document_details',
    { title: 'X' },
    Date.now()
  )
  expect(suggested._meta.sidebarHint).toBe('suggest')
  // plain read tools carry no hint
  const plain = wrapToolResponse('search_laws', [], Date.now())
  expect(plain._meta.sidebarHint).toBeUndefined()
})
