'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type Editor } from '@tiptap/react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved' | 'error'

const VERSION_BATCH_WINDOW_MS = 30_000 // 30 seconds

interface UseDocumentAutosaveOptions {
  editor: Editor | null
  onSave: (_contentJson: object) => Promise<boolean>
  initialContent: object
  debounceMs?: number
}

export function useDocumentAutosave({
  editor,
  onSave,
  initialContent,
  debounceMs = 2000,
}: UseDocumentAutosaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const lastSavedJsonRef = useRef<string>(JSON.stringify(initialContent))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  const lastVersionSavedAtRef = useRef<number>(0) // 0 = no save yet, always allow first save
  const forceSaveRef = useRef(false)

  const save = useCallback(async () => {
    if (!editor || isSavingRef.current) return

    const currentJson = editor.getJSON() as Record<string, unknown>
    const currentJsonStr = JSON.stringify(currentJson)

    // Skip if content hasn't changed
    if (currentJsonStr === lastSavedJsonRef.current) {
      setSaveStatus('saved')
      return
    }

    const now = Date.now()
    const elapsed = now - lastVersionSavedAtRef.current
    const isForced = forceSaveRef.current
    forceSaveRef.current = false

    // Batching: if within 30-second window and not a forced save, re-schedule
    if (
      !isForced &&
      lastVersionSavedAtRef.current > 0 &&
      elapsed < VERSION_BATCH_WINDOW_MS
    ) {
      const remainingMs = VERSION_BATCH_WINDOW_MS - elapsed
      // Clear any existing batch timer to avoid duplicates
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
      }
      batchTimerRef.current = setTimeout(() => {
        batchTimerRef.current = null
        save()
      }, remainingMs)
      return
    }

    isSavingRef.current = true
    setSaveStatus('saving')

    const success = await onSave(currentJson)

    if (success) {
      lastSavedJsonRef.current = currentJsonStr
      lastVersionSavedAtRef.current = Date.now()
      setSaveStatus('saved')
    } else {
      setSaveStatus('error')
    }

    isSavingRef.current = false
  }, [editor, onSave])

  // Listen for editor updates and debounce
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      setSaveStatus('unsaved')

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        save()
      }, debounceMs)
    }

    editor.on('update', handleUpdate)

    return () => {
      editor.off('update', handleUpdate)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
      }
    }
  }, [editor, save, debounceMs])

  // Manual save: force immediate save bypassing batching window
  const triggerSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current)
      batchTimerRef.current = null
    }
    forceSaveRef.current = true
    save()
  }, [save])

  return { saveStatus, triggerSave }
}
