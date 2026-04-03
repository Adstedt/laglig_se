import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import {
  ChatDetailProvider,
  useChatDetail,
  useChatDetailSafe,
  type CitationDetailData,
  type ChatDetailItem,
} from '@/lib/ai/chat-detail-context'

const mockCitation: CitationDetailData = {
  title: 'Arbetsmiljölagen',
  snippet: 'Arbetsgivaren skall systematiskt planera...',
  documentNumber: 'SFS 1977:1160',
  slug: 'arbetsmiljolagen-1977-1160',
  anchorId: 'K3P2',
  path: 'Kap 3 › 2 §',
}

const citationItem: ChatDetailItem = {
  type: 'citation',
  id: 'citation-SFS 1977:1160-K3P2',
  data: mockCitation,
}

const toolResultItem: ChatDetailItem = {
  type: 'tool-result',
  id: 'tool-123',
  toolName: 'search_laws',
  data: {
    data: [{ contextualHeader: 'AML Kap 3', documentNumber: 'SFS 1977:1160' }],
    _meta: { tool: 'search_laws', executionTimeMs: 150, resultCount: 1 },
  },
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(ChatDetailProvider, null, children)
}

describe('ChatDetailContext', () => {
  it('starts with no active detail', () => {
    const { result } = renderHook(() => useChatDetail(), { wrapper })
    expect(result.current.activeDetail).toBeNull()
  })

  it('opens a detail', () => {
    const { result } = renderHook(() => useChatDetail(), { wrapper })

    act(() => {
      result.current.openDetail(citationItem)
    })

    expect(result.current.activeDetail).toEqual(citationItem)
  })

  it('closes a detail', () => {
    const { result } = renderHook(() => useChatDetail(), { wrapper })

    act(() => {
      result.current.openDetail(citationItem)
    })
    expect(result.current.activeDetail).not.toBeNull()

    act(() => {
      result.current.closeDetail()
    })
    expect(result.current.activeDetail).toBeNull()
  })

  it('toggles: opening the same item closes the sidebar', () => {
    const { result } = renderHook(() => useChatDetail(), { wrapper })

    act(() => {
      result.current.openDetail(citationItem)
    })
    expect(result.current.activeDetail).toEqual(citationItem)

    // Open same item again → should close
    act(() => {
      result.current.openDetail(citationItem)
    })
    expect(result.current.activeDetail).toBeNull()
  })

  it('replaces: opening a different item replaces the current one', () => {
    const { result } = renderHook(() => useChatDetail(), { wrapper })

    act(() => {
      result.current.openDetail(citationItem)
    })
    expect(result.current.activeDetail).toEqual(citationItem)

    act(() => {
      result.current.openDetail(toolResultItem)
    })
    expect(result.current.activeDetail).toEqual(toolResultItem)
  })

  it('toggle checks both type and id', () => {
    const { result } = renderHook(() => useChatDetail(), { wrapper })

    const anotherCitation: ChatDetailItem = {
      type: 'citation',
      id: 'citation-SFS 2003:460-doc',
      data: { ...mockCitation, documentNumber: 'SFS 2003:460' },
    }

    act(() => {
      result.current.openDetail(citationItem)
    })

    // Different id, same type → replace, not toggle
    act(() => {
      result.current.openDetail(anotherCitation)
    })
    expect(result.current.activeDetail).toEqual(anotherCitation)
  })
})

describe('useChatDetailSafe', () => {
  it('returns null when outside provider', () => {
    const { result } = renderHook(() => useChatDetailSafe())
    expect(result.current).toBeNull()
  })

  it('returns context value when inside provider', () => {
    const { result } = renderHook(() => useChatDetailSafe(), { wrapper })
    expect(result.current).not.toBeNull()
    expect(result.current?.activeDetail).toBeNull()
  })
})
