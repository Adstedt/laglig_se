'use client'

/**
 * Observe an element's content-box width via ResizeObserver.
 *
 * Built for the table↔card renderer switch: the AI-chat right sidebar is a
 * sibling flex item that animates width over 300ms, so the observer fires
 * ~every frame during the transition. Updates are rAF-coalesced (a pending
 * frame is cancelled when a newer entry arrives) so re-renders cap at the
 * frame rate; the view-resolution hysteresis on top of this means at most
 * one renderer swap per animation.
 *
 * SSR-safe: width is null until the first client-side measure. Uses a
 * callback ref (not useRef+useEffect) so re-mounts re-observe correctly.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function useContainerWidth<T extends HTMLElement = HTMLDivElement>(): {
  ref: (_node: T | null) => void
  width: number | null
} {
  const [width, setWidth] = useState<number | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const frameRef = useRef<number | null>(null)

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null

    if (!node) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const next =
        entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width

      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        // Quantize to 8px steps: during the sidebar's 300ms width animation
        // the observer fires every frame — per-pixel state updates would
        // re-render the whole table ~60×/s for no visual gain. Thresholds
        // (cardBelow/hideBelow) only need ±4px accuracy.
        const quantized = Math.round(next / 8) * 8
        setWidth((prev) => (prev === quantized ? prev : quantized))
      })
    })

    observer.observe(node)
    observerRef.current = observer
    // Synchronous first measure so the initial view resolves before paint
    // (RO also fires on observe, but through the rAF path).
    const initial = node.getBoundingClientRect().width
    setWidth(Math.round(initial / 8) * 8)
  }, [])

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return { ref, width }
}
