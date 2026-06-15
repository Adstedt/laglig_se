/**
 * Unit tests for withLastMessageCached (Story 14.37, Fix #1).
 * Pure mapper — no mocks needed.
 */

import { describe, it, expect } from 'vitest'
import type { ModelMessage } from 'ai'
import {
  withLastMessageCached,
  withEphemeralCacheControl,
} from '@/lib/agent/prompt-cache'

const EPHEMERAL = { type: 'ephemeral' }

// Story 14.38: the shared primitive reused for the history breakpoint (bp2).
describe('withEphemeralCacheControl', () => {
  it('attaches an anthropic ephemeral breakpoint to a single message', () => {
    const out = withEphemeralCacheControl({ role: 'assistant', content: 'hej' })
    expect(out).toEqual({
      role: 'assistant',
      content: 'hej',
      providerOptions: { anthropic: { cacheControl: EPHEMERAL } },
    })
  })

  it('merges with existing providerOptions without clobbering them', () => {
    const out = withEphemeralCacheControl({
      role: 'user',
      content: 'c',
      providerOptions: {
        openai: { foo: 'bar' },
        anthropic: { somethingElse: true },
      },
    })
    expect(out.providerOptions?.openai).toEqual({ foo: 'bar' })
    expect(out.providerOptions?.anthropic).toEqual({
      somethingElse: true,
      cacheControl: EPHEMERAL,
    })
  })

  it('does not mutate the input message', () => {
    const msg: ModelMessage = { role: 'user', content: 'c' }
    withEphemeralCacheControl(msg)
    expect(msg.providerOptions).toBeUndefined()
  })
})

describe('withLastMessageCached', () => {
  it('returns an empty array unchanged', () => {
    expect(withLastMessageCached([])).toEqual([])
  })

  it('marks the LAST message with anthropic ephemeral cacheControl', () => {
    const msgs: ModelMessage[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ]
    const out = withLastMessageCached(msgs)
    expect(out[2]?.providerOptions?.anthropic?.cacheControl).toEqual(EPHEMERAL)
  })

  it('does not touch any message other than the last', () => {
    const msgs: ModelMessage[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ]
    const out = withLastMessageCached(msgs)
    expect(out[0]?.providerOptions).toBeUndefined()
    expect(out[1]?.providerOptions).toBeUndefined()
  })

  it('preserves role and content of the cached message', () => {
    const out = withLastMessageCached([{ role: 'user', content: 'hello' }])
    expect(out[0]?.role).toBe('user')
    expect(out[0]?.content).toBe('hello')
  })

  it('merges with existing providerOptions (other providers + other anthropic keys)', () => {
    const msgs: ModelMessage[] = [
      {
        role: 'user',
        content: 'c',
        providerOptions: {
          openai: { foo: 'bar' },
          anthropic: { somethingElse: true },
        },
      },
    ]
    const out = withLastMessageCached(msgs)
    expect(out[0]?.providerOptions?.openai).toEqual({ foo: 'bar' })
    expect(out[0]?.providerOptions?.anthropic).toEqual({
      somethingElse: true,
      cacheControl: EPHEMERAL,
    })
  })

  it('does not mutate the input array or messages', () => {
    const msgs: ModelMessage[] = [{ role: 'user', content: 'c' }]
    withLastMessageCached(msgs)
    expect(msgs[0]?.providerOptions).toBeUndefined()
  })
})
