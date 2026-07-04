/**
 * Story 7.7 (AC 1): useChatInterface — employeeId transport.
 *  - sendMessage(..., { employeeId }) → per-send body override carries it;
 *  - no employeeId + no attachments → NO body override at all (byte-identical
 *    to the pre-7.7 call shape — hot-path transport inertness);
 *  - attachments + employeeId compose into one body override.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChatInterface } from '@/lib/hooks/use-chat-interface'

// --- mocks -----------------------------------------------------------------

const mockSendChatMessage = vi.fn()
const mockSetMessages = vi.fn()

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    status: 'ready',
    error: undefined,
    stop: vi.fn(),
    sendMessage: mockSendChatMessage,
    setMessages: mockSetMessages,
  }),
}))

vi.mock('@/lib/track-event', () => ({ trackEvent: vi.fn() }))

vi.mock('@/app/actions/ai-chat', () => ({
  getChatHistory: vi.fn().mockResolvedValue({
    success: true,
    data: { messages: [], nextCursor: null },
  }),
  saveChatMessage: vi.fn().mockResolvedValue({ success: true }),
  clearChatHistory: vi.fn().mockResolvedValue({ success: true }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

async function setup() {
  const hook = renderHook(() => useChatInterface({ contextType: 'global' }))
  await waitFor(() => expect(hook.result.current.isLoadingHistory).toBe(false))
  return hook
}

// --- tests -----------------------------------------------------------------

describe('useChatInterface — employeeId transport (Story 7.7)', () => {
  it('threads employeeId as a per-send body override', async () => {
    const { result } = await setup()

    act(() => {
      result.current.sendMessage('Vilken uppsägningstid har Anna?', undefined, {
        employeeId: 'emp-1',
      })
    })

    expect(mockSendChatMessage).toHaveBeenCalledTimes(1)
    const [msg, opts] = mockSendChatMessage.mock.calls[0]!
    expect(msg).toEqual({
      parts: [{ type: 'text', text: 'Vilken uppsägningstid har Anna?' }],
    })
    expect(opts).toEqual({ body: { employeeId: 'emp-1' } })
  })

  it('INERT: no employeeId + no attachments → no body override (pre-7.7 shape)', async () => {
    const { result } = await setup()

    act(() => {
      result.current.sendMessage('Hej!')
    })

    const [msg, opts] = mockSendChatMessage.mock.calls[0]!
    expect(msg).toEqual({ parts: [{ type: 'text', text: 'Hej!' }] })
    expect(opts).toBeUndefined()
  })

  it('attachments + employeeId compose into a single body override', async () => {
    const { result } = await setup()

    act(() => {
      result.current.sendMessage(
        'Se bifogat',
        [{ fileId: 'file-1', filename: 'a.pdf', mimeType: 'application/pdf' }],
        { employeeId: 'emp-1' }
      )
    })

    const [, opts] = mockSendChatMessage.mock.calls[0]!
    expect(opts).toEqual({
      body: { attachmentIds: ['file-1'], employeeId: 'emp-1' },
    })
  })

  it('attachments only → body override without employeeId (Story 19.1 unchanged)', async () => {
    const { result } = await setup()

    act(() => {
      result.current.sendMessage('Se bifogat', [
        { fileId: 'file-1', filename: 'a.pdf', mimeType: 'application/pdf' },
      ])
    })

    const [, opts] = mockSendChatMessage.mock.calls[0]!
    expect(opts).toEqual({ body: { attachmentIds: ['file-1'] } })
  })
})
