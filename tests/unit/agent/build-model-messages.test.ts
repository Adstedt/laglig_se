/**
 * Unit tests for buildModelMessages (Story 19.1, Task 5 + 8).
 * Pure mapper — no mocks needed.
 */

import { describe, it, expect } from 'vitest'
import type { UIMessage } from 'ai'
import { buildModelMessages } from '@/lib/agent/build-model-messages'
import type { AttachmentContentBlock } from '@/lib/agent/attachments-to-content'

function userMsg(text: string): UIMessage {
  return {
    id: text,
    role: 'user',
    parts: [{ type: 'text', text }],
  } as UIMessage
}
function assistantMsg(text: string): UIMessage {
  return {
    id: text,
    role: 'assistant',
    parts: [{ type: 'text', text }],
  } as UIMessage
}

const pdfBlock: AttachmentContentBlock = {
  type: 'file',
  mediaType: 'application/pdf',
  filename: 'policy.pdf',
  data: 'YmFzZTY0',
}

describe('buildModelMessages', () => {
  it('merges attachment blocks into the LAST user message (blocks before text)', () => {
    const out = buildModelMessages(
      [userMsg('första'), assistantMsg('svar'), userMsg('läs bilagan')],
      [pdfBlock]
    )
    expect(out).toHaveLength(3)
    // history user message stays text-only
    expect(out[0]).toEqual({ role: 'user', content: 'första' })
    expect(out[1]).toEqual({ role: 'assistant', content: 'svar' })
    // last user message → array content with the block first
    expect(out[2]).toEqual({
      role: 'user',
      content: [pdfBlock, { type: 'text', text: 'läs bilagan' }],
    })
  })

  it('no attachments → all messages text-only', () => {
    const out = buildModelMessages([userMsg('hej'), assistantMsg('hej då')], [])
    expect(out).toEqual([
      { role: 'user', content: 'hej' },
      { role: 'assistant', content: 'hej då' },
    ])
  })

  it('does not merge when the last message is not a user message', () => {
    const out = buildModelMessages(
      [userMsg('fråga'), assistantMsg('sista är assistent')],
      [pdfBlock]
    )
    expect(out[1]).toEqual({ role: 'assistant', content: 'sista är assistent' })
  })

  it('drops empty-content assistant turns (tool-only proposals / legacy stubs) so no empty text block reaches the model', () => {
    // Anthropic rejects empty text content blocks. A tool-only proposal turn
    // persists with content '' and must not be forwarded as an empty block.
    const out = buildModelMessages(
      [
        userMsg('föreslå ändringar'),
        assistantMsg(''), // tool-only proposal turn, no prose
        userMsg('gör alla ändringar'),
      ],
      []
    )
    expect(out).toEqual([
      { role: 'user', content: 'föreslå ändringar' },
      { role: 'user', content: 'gör alla ändringar' },
    ])
  })

  it('drops a whitespace-only assistant turn', () => {
    const out = buildModelMessages(
      [userMsg('hej'), assistantMsg('   \n  '), userMsg('igen')],
      []
    )
    expect(out).toEqual([
      { role: 'user', content: 'hej' },
      { role: 'user', content: 'igen' },
    ])
  })

  it('last user message with attachments but no text → blocks only, no empty text block', () => {
    const out = buildModelMessages(
      [userMsg('tidigare'), { id: 'x', role: 'user', parts: [] } as UIMessage],
      [pdfBlock]
    )
    expect(out[out.length - 1]).toEqual({ role: 'user', content: [pdfBlock] })
  })

  it('joins multiple text parts with newlines', () => {
    const m = {
      id: 'm',
      role: 'user',
      parts: [
        { type: 'text', text: 'rad1' },
        { type: 'text', text: 'rad2' },
      ],
    } as UIMessage
    const out = buildModelMessages([m], [])
    expect(out[0]).toEqual({ role: 'user', content: 'rad1\nrad2' })
  })

  // Story 14.38: pendingActionsBlock is now emitted as a SEPARATE user message
  // immediately before the current user turn (after the stable-history
  // boundary), NOT fused into the last user message. This keeps every history
  // message pure text so the cached prefix is byte-stable turn-over-turn.
  describe('pendingActionsBlock as a separate post-history block (Story 14.38)', () => {
    const PENDING = '<pending_agent_actions>state</pending_agent_actions>'

    it('emits the block as its own user message right before the current turn', () => {
      const out = buildModelMessages(
        [userMsg('tidigare'), userMsg('gör det')],
        [],
        PENDING
      )
      expect(out).toEqual([
        { role: 'user', content: 'tidigare' },
        { role: 'user', content: PENDING },
        { role: 'user', content: 'gör det' },
      ])
    })

    it('keeps the current user message pure (attachments only) — block is separate, before it', () => {
      const out = buildModelMessages([userMsg('läs')], [pdfBlock], PENDING)
      expect(out).toEqual([
        { role: 'user', content: PENDING },
        { role: 'user', content: [pdfBlock, { type: 'text', text: 'läs' }] },
      ])
    })

    it('null/undefined block leaves behavior unchanged (no extra message)', () => {
      expect(buildModelMessages([userMsg('hej')], [], null)).toEqual([
        { role: 'user', content: 'hej' },
      ])
      expect(buildModelMessages([userMsg('hej')], [])).toEqual([
        { role: 'user', content: 'hej' },
      ])
    })

    it('does not inject into history user messages, only before the current turn', () => {
      const out = buildModelMessages(
        [userMsg('första'), assistantMsg('svar'), userMsg('sista')],
        [],
        PENDING
      )
      expect(out).toEqual([
        { role: 'user', content: 'första' },
        { role: 'assistant', content: 'svar' },
        { role: 'user', content: PENDING },
        { role: 'user', content: 'sista' },
      ])
    })
  })

  // Story 14.38 (bp2): mark the last stable-history message with an Anthropic
  // ephemeral cache breakpoint (cross-turn read point). Anthropic path only.
  describe('history cache breakpoint — cacheHistory option (Story 14.38)', () => {
    const EPHEMERAL = { type: 'ephemeral' }

    it('marks the LAST history message (the prior assistant turn) when cacheHistory is set', () => {
      const out = buildModelMessages(
        [userMsg('q1'), assistantMsg('a1'), userMsg('q2')],
        [],
        null,
        { cacheHistory: true }
      )
      // last history message = the prior assistant turn (index 1)
      expect(out[1]?.providerOptions?.anthropic?.cacheControl).toEqual(
        EPHEMERAL
      )
      // current user turn carries no breakpoint here (bp3 is the route's moving one)
      expect(out[2]?.providerOptions).toBeUndefined()
      // earlier history is untouched
      expect(out[0]?.providerOptions).toBeUndefined()
    })

    it('does not apply the breakpoint when cacheHistory is false/omitted (OpenAI path)', () => {
      const out = buildModelMessages(
        [userMsg('q1'), assistantMsg('a1'), userMsg('q2')],
        []
      )
      expect(out.every((m) => m.providerOptions === undefined)).toBe(true)
    })

    it('is a no-op on a single-turn conversation (no history to mark)', () => {
      const out = buildModelMessages([userMsg('hej')], [], null, {
        cacheHistory: true,
      })
      expect(out).toEqual([{ role: 'user', content: 'hej' }])
    })

    it('marks the last NON-EMPTY history message, skipping a dropped empty assistant turn', () => {
      // The empty tool-only proposal turn is dropped; bp2 must land on the
      // real prior message, not vanish.
      const out = buildModelMessages(
        [userMsg('q1'), assistantMsg('a1'), assistantMsg(''), userMsg('q2')],
        [],
        null,
        { cacheHistory: true }
      )
      expect(out).toHaveLength(3) // empty turn dropped
      expect(out[1]?.providerOptions?.anthropic?.cacheControl).toEqual(
        EPHEMERAL
      )
    })

    it('puts the breakpoint BEFORE the volatile pending-actions block (block stays uncached)', () => {
      const PENDING = '<pending_agent_actions>x</pending_agent_actions>'
      const out = buildModelMessages(
        [userMsg('q1'), assistantMsg('a1'), userMsg('q2')],
        [],
        PENDING,
        { cacheHistory: true }
      )
      // out = [q1, a1(bp2), PENDING, q2]
      expect(out[1]?.providerOptions?.anthropic?.cacheControl).toEqual(
        EPHEMERAL
      )
      expect(out[2]).toEqual({ role: 'user', content: PENDING }) // no bp
      expect(out[2]?.providerOptions).toBeUndefined()
      expect(out[3]?.providerOptions).toBeUndefined()
    })
  })

  // Story 14.38 (AC4 — HEADLINE): cross-turn payload-determinism. The cached
  // history prefix must be byte-identical turn-to-turn at the rendered-payload
  // level; drift fails silently (cache miss). We compare the OVERLAPPING history
  // prefix = turn N+1's history MINUS the turn that just completed (≡ turn N's
  // history), and assert the content bytes are identical — only the bp2 marker
  // is allowed to move forward (Anthropic keys off content, not the marker).
  describe('cross-turn payload determinism (Story 14.38, AC4)', () => {
    // Strip the moving cache_control marker so we compare cached CONTENT bytes.
    const content = (m: ReturnType<typeof buildModelMessages>[number]) => ({
      role: m.role,
      content: m.content,
    })

    // Content chosen to exercise the silent breakers: trailing whitespace,
    // markdown lists/tables/code, citations — none may be normalized away.
    const u1 = userMsg('Vilka **arbetsmiljökrav** gäller?  ')
    const a1 = assistantMsg(
      '- AFS 2023:1\n- AFS 2023:2\n\n| Krav | Status |\n|---|---|\n| Skydd | ✅ |\n\n```ts\nconst x = 1\n```\nSe [SFS 1977:1160](/lag/1977:1160).'
    )
    const u2 = userMsg('Och för ensamarbete?')
    const a2 = assistantMsg('Se 3 kap. 4 § samt AFS 1982:3.')
    const u3 = userMsg('Tack!')

    const PENDING_N =
      '<pending_agent_actions>turn N state</pending_agent_actions>'
    const PENDING_N1 =
      '<pending_agent_actions>turn N+1 state — DIFFERENT</pending_agent_actions>'

    it('overlapping history prefix is byte-identical across two consecutive turns', () => {
      const turnN = buildModelMessages([u1, a1, u2], [], PENDING_N, {
        cacheHistory: true,
      })
      const turnN1 = buildModelMessages([u1, a1, u2, a2, u3], [], PENDING_N1, {
        cacheHistory: true,
      })

      // Overlapping prefix = turn N's full history span [u1, a1].
      const overlapN = turnN.slice(0, 2).map(content)
      const overlapN1 = turnN1.slice(0, 2).map(content)

      // Byte-identical CONTENT — the linchpin. A whitespace/markdown/ordering
      // drift here would silently break the cross-turn cache.
      expect(overlapN1).toEqual(overlapN)
      // And it is the actual verbatim history, not a normalized projection.
      expect(overlapN1).toEqual([
        { role: 'user', content: 'Vilka **arbetsmiljökrav** gäller?  ' },
        {
          role: 'assistant',
          content:
            '- AFS 2023:1\n- AFS 2023:2\n\n| Krav | Status |\n|---|---|\n| Skydd | ✅ |\n\n```ts\nconst x = 1\n```\nSe [SFS 1977:1160](/lag/1977:1160).',
        },
      ])
    })

    it('the bp2 marker moves forward each turn (proof the read point advances), without poisoning history content', () => {
      const turnN = buildModelMessages([u1, a1, u2], [], null, {
        cacheHistory: true,
      })
      const turnN1 = buildModelMessages([u1, a1, u2, a2, u3], [], null, {
        cacheHistory: true,
      })
      // Turn N: bp2 on a1 (index 1, last history). Turn N+1: bp2 on a2 (index 3).
      expect(turnN[1]?.providerOptions?.anthropic?.cacheControl).toBeDefined()
      expect(
        turnN1[1]?.providerOptions?.anthropic?.cacheControl
      ).toBeUndefined()
      expect(turnN1[3]?.providerOptions?.anthropic?.cacheControl).toBeDefined()
    })

    it('volatile pending-actions never leaks into the cached history span', () => {
      const turnN1 = buildModelMessages([u1, a1, u2, a2, u3], [], PENDING_N1, {
        cacheHistory: true,
      })
      // history span = everything before the PENDING block + current turn.
      const pendingIdx = turnN1.findIndex((m) => m.content === PENDING_N1)
      const historySpan = turnN1.slice(0, pendingIdx)
      expect(historySpan.some((m) => m.content === PENDING_N1)).toBe(false)
      // and the prior user turn u2 sits in history as PURE text (no fusion)
      expect(historySpan).toContainEqual({
        role: 'user',
        content: 'Och för ensamarbete?',
      })
    })
  })
})
