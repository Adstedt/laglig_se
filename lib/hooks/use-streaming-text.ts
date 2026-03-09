'use client'

/**
 * useStreamingText — client-side typewriter animation for smooth streaming.
 *
 * Decouples network chunk arrival from visual rendering by buffering the full
 * text and revealing it character-by-character at a constant speed using
 * requestAnimationFrame. This creates the smooth ChatGPT-like effect.
 *
 * Based on: https://upstash.com/blog/smooth-streaming
 */

import { useState, useRef, useEffect, useCallback } from 'react'

interface UseStreamingTextOptions {
  /** The full text received so far (grows as tokens arrive) */
  text: string
  /** Whether the stream is currently active */
  isStreaming: boolean
  /** Milliseconds per character. Lower = faster. Default: 5ms (~200 chars/sec) */
  speed?: number
}

export function useStreamingText({
  text,
  isStreaming,
  speed = 5,
}: UseStreamingTextOptions): string {
  const [visibleText, setVisibleText] = useState('')
  const indexRef = useRef(0)
  const frameRef = useRef<number>(0)
  const lastTimeRef = useRef(0)
  const targetTextRef = useRef(text)
  const streamingRef = useRef(isStreaming)
  const hasStartedRef = useRef(false)

  // Keep refs in sync
  targetTextRef.current = text
  streamingRef.current = isStreaming

  const animate = useCallback(
    (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time
      const elapsed = time - lastTimeRef.current

      const target = targetTextRef.current

      if (elapsed >= speed) {
        // Reveal characters proportional to elapsed time
        const charsToReveal = Math.max(1, Math.floor(elapsed / speed))
        const newIndex = Math.min(
          indexRef.current + charsToReveal,
          target.length
        )

        if (newIndex !== indexRef.current) {
          indexRef.current = newIndex
          setVisibleText(target.slice(0, newIndex))
        }

        lastTimeRef.current = time
      }

      // Keep animating if there's still text to reveal OR streaming is still active
      // (more text might arrive)
      if (indexRef.current < target.length || streamingRef.current) {
        frameRef.current = requestAnimationFrame(animate)
      }
      // else: caught up and streaming done — animation stops naturally
    },
    [speed]
  )

  // Start animation when text first arrives
  useEffect(() => {
    if (text.length > 0 && text.length > indexRef.current) {
      if (!hasStartedRef.current) {
        // First text — start animation
        hasStartedRef.current = true
        lastTimeRef.current = 0
        frameRef.current = requestAnimationFrame(animate)
      } else if (
        !frameRef.current ||
        indexRef.current >= targetTextRef.current.length
      ) {
        // Animation had stopped (caught up) but new text arrived — restart
        lastTimeRef.current = 0
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    return () => {
      // Don't cancel on every text change — only on unmount
    }
  }, [text, animate])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
      }
    }
  }, [])

  // If this message was loaded from history (not streaming, never started animation),
  // show the full text immediately
  if (!isStreaming && !hasStartedRef.current) {
    return text
  }

  return visibleText
}
