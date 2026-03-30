import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDocumentAutosave } from '@/lib/hooks/use-document-autosave'

// Mock editor
function createMockEditor(content: object = { type: 'doc', content: [] }) {
  const listeners: Record<string, Array<() => void>> = {}
  return {
    getJSON: vi.fn(() => content),
    on: vi.fn((event: string, handler: () => void) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(handler)
    }),
    off: vi.fn((event: string, handler: () => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler)
      }
    }),
    // Helper to simulate an editor update event
    _triggerUpdate: () => {
      listeners['update']?.forEach((h) => h())
    },
  }
}

describe('useDocumentAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with idle status', () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const editor = createMockEditor()
    const { result } = renderHook(() =>
      useDocumentAutosave({
        editor: editor as never,
        onSave,
        initialContent: { type: 'doc', content: [] },
      })
    )

    expect(result.current.saveStatus).toBe('idle')
  })

  it('debounces saves by 2 seconds', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const editor = createMockEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hello' }] },
      ],
    })

    renderHook(() =>
      useDocumentAutosave({
        editor: editor as never,
        onSave,
        initialContent: { type: 'doc', content: [] },
      })
    )

    // Simulate editor update
    act(() => {
      editor._triggerUpdate()
    })

    // Before debounce — should not have saved yet
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(onSave).not.toHaveBeenCalled()

    // After debounce
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('skips save when content has not changed', async () => {
    const initialContent = { type: 'doc', content: [] }
    const onSave = vi.fn().mockResolvedValue(true)
    const editor = createMockEditor(initialContent) // returns same content

    const { result } = renderHook(() =>
      useDocumentAutosave({
        editor: editor as never,
        onSave,
        initialContent,
      })
    )

    // Trigger manual save with same content
    await act(async () => {
      result.current.triggerSave()
    })

    expect(onSave).not.toHaveBeenCalled()
    expect(result.current.saveStatus).toBe('saved')
  })

  it('sets error status when save fails', async () => {
    const onSave = vi.fn().mockResolvedValue(false)
    const editor = createMockEditor({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    })

    const { result } = renderHook(() =>
      useDocumentAutosave({
        editor: editor as never,
        onSave,
        initialContent: { type: 'doc', content: [] },
      })
    )

    await act(async () => {
      result.current.triggerSave()
    })

    expect(result.current.saveStatus).toBe('error')
  })

  it('sets unsaved status on editor update', () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const editor = createMockEditor()

    const { result } = renderHook(() =>
      useDocumentAutosave({
        editor: editor as never,
        onSave,
        initialContent: { type: 'doc', content: [] },
      })
    )

    act(() => {
      editor._triggerUpdate()
    })

    expect(result.current.saveStatus).toBe('unsaved')
  })

  it('batching: suppresses save within 30-second window after last save', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const content1 = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'v1' }] }],
    }
    const content2 = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'v2' }] }],
    }
    const editor = createMockEditor(content1)

    renderHook(() =>
      useDocumentAutosave({
        editor: editor as never,
        onSave,
        initialContent: { type: 'doc', content: [] },
      })
    )

    // First save via debounce
    act(() => {
      editor._triggerUpdate()
    })
    await act(async () => {
      vi.advanceTimersByTime(2500)
    })
    expect(onSave).toHaveBeenCalledTimes(1)

    // Change content and trigger another update within 30s window
    editor.getJSON.mockReturnValue(content2)
    act(() => {
      editor._triggerUpdate()
    })

    // Debounce fires at +2s but we're within the 30s window
    await act(async () => {
      vi.advanceTimersByTime(2500)
    })
    // Should NOT have saved yet (batching suppressed)
    expect(onSave).toHaveBeenCalledTimes(1)

    // Advance to 30s window expiry (remaining ~27.5s from first save)
    await act(async () => {
      vi.advanceTimersByTime(28_000)
    })
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('batching: manual triggerSave bypasses 30-second window', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const content1 = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'v1' }] }],
    }
    const content2 = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'v2' }] }],
    }
    const editor = createMockEditor(content1)

    const { result } = renderHook(() =>
      useDocumentAutosave({
        editor: editor as never,
        onSave,
        initialContent: { type: 'doc', content: [] },
      })
    )

    // First save
    act(() => {
      editor._triggerUpdate()
    })
    await act(async () => {
      vi.advanceTimersByTime(2500)
    })
    expect(onSave).toHaveBeenCalledTimes(1)

    // Change content and manual save within 30s window
    editor.getJSON.mockReturnValue(content2)
    await act(async () => {
      result.current.triggerSave()
    })

    // Manual save should bypass the batching window
    expect(onSave).toHaveBeenCalledTimes(2)
  })

  it('batching: first save always goes through immediately (no prior window)', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const editor = createMockEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
      ],
    })

    renderHook(() =>
      useDocumentAutosave({
        editor: editor as never,
        onSave,
        initialContent: { type: 'doc', content: [] },
      })
    )

    // First debounced save should go through without batching suppression
    act(() => {
      editor._triggerUpdate()
    })
    await act(async () => {
      vi.advanceTimersByTime(2500)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('triggerSave cancels pending debounce and saves immediately', async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    const editor = createMockEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'new' }] },
      ],
    })

    const { result } = renderHook(() =>
      useDocumentAutosave({
        editor: editor as never,
        onSave,
        initialContent: { type: 'doc', content: [] },
      })
    )

    // Trigger debounced update
    act(() => {
      editor._triggerUpdate()
    })

    // Immediately trigger manual save before debounce completes
    await act(async () => {
      result.current.triggerSave()
    })

    expect(onSave).toHaveBeenCalledTimes(1)

    // Ensure debounce doesn't fire again
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
