import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ChatDetailProvider } from '@/lib/ai/chat-detail-context'
import {
  SystemMessage,
  SYSTEM_MESSAGE_FADE_MS,
} from '@/components/features/ai-chat/system-message'
import type { SystemMessageItem } from '@/lib/ai/chat-detail-context'

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ChatDetailProvider>{children}</ChatDetailProvider>
}

describe('SystemMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders message text', () => {
    const msg: SystemMessageItem = {
      id: 'sys-1',
      text: 'Uppgift skapad',
      createdAt: new Date(),
    }

    render(
      <TestWrapper>
        <SystemMessage message={msg} />
      </TestWrapper>
    )

    expect(screen.getByText('Uppgift skapad')).toBeDefined()
  })

  it('starts fully visible', () => {
    const msg: SystemMessageItem = {
      id: 'sys-1',
      text: 'Status uppdaterad',
      createdAt: new Date(),
    }

    const { container } = render(
      <TestWrapper>
        <SystemMessage message={msg} />
      </TestWrapper>
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('opacity-100')
    expect(wrapper.className).not.toContain('opacity-0')
  })

  it('fades out after SYSTEM_MESSAGE_FADE_MS', () => {
    const msg: SystemMessageItem = {
      id: 'sys-1',
      text: 'Bedömning sparad',
      createdAt: new Date(),
    }

    const { container } = render(
      <TestWrapper>
        <SystemMessage message={msg} />
      </TestWrapper>
    )

    act(() => {
      vi.advanceTimersByTime(SYSTEM_MESSAGE_FADE_MS)
    })

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('opacity-0')
  })

  it('exports SYSTEM_MESSAGE_FADE_MS as 30000', () => {
    expect(SYSTEM_MESSAGE_FADE_MS).toBe(30000)
  })
})
