/**
 * Unit test for add_obligation's KP-001 framing rule (Story 19.7b).
 * The tool description is part of the AC — it steers how the agent phrases
 * kravpunkter (verifiable declarative obligations, not imperative to-dos), so
 * it governs ad-hoc add_obligation use outside any skill.
 */

import { it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { lawListItem: { findFirst: vi.fn() } },
}))

import { createAddObligationTool } from '@/lib/agent/tools/add-obligation'

it('add_obligation description carries the KP-001 declarative-obligation framing', () => {
  const desc = createAddObligationTool('ws').description as string
  expect(desc).toContain('verifierbart krav i påstående-presens')
  // explicitly contrasts the wrong (imperative) form
  expect(desc).toContain('INTE som en uppmaning')
})
