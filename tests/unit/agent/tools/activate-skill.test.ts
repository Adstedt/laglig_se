/**
 * Unit tests for activate_skill (Story 19.7a).
 * Runs against the real shipped skills (lib/agent/skills/) via the 19.6 loader.
 */

import { it, expect } from 'vitest'
import { createActivateSkillTool } from '@/lib/agent/tools/activate-skill'

type Exec = (
  _i: { name: string },
  _o: unknown
) => Promise<Record<string, unknown>>
const opts = {
  toolCallId: 'tc',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}
const execute = createActivateSkillTool().execute as Exec

it('returns the skill instructions for a known skill', async () => {
  const result = await execute({ name: 'assess_change' }, opts)
  const data = result.data as { name: string; instructions: string }
  expect(data.name).toBe('assess_change')
  expect(data.instructions).toContain('Bedömningsflöde')
})

it('returns the gap_analysis skill instructions (Story 19.7b)', async () => {
  const result = await execute({ name: 'gap_analysis' }, opts)
  const data = result.data as { name: string; instructions: string }
  expect(data.name).toBe('gap_analysis')
  expect(data.instructions).toContain('Gap-analys') // PROCEDURE body
  // KP-001 reframe carried in the assembled STYLE body
  expect(data.instructions).toContain('MBL-förhandling genomförs')
})

it('returns wrapToolError for an unknown skill', async () => {
  const result = await execute({ name: 'does-not-exist' }, opts)
  expect(result.error).toBe(true)
})
