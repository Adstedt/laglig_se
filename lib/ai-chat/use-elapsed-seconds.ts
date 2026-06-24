'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Story 19.15: elapsed-time counter for the agent "working" indicator.
 *
 * While `active` is true, ticks once per second and returns whole seconds
 * elapsed since `active` first became true. When `active` flips to false the
 * value **freezes** at its last reading (so the duration can be shown frozen
 * in the collapsed "Arbetsförlopp" summary).
 *
 * Returns `null` until the first active tick — i.e. on a history reload, where
 * the turn was never streamed in this component instance, the clock never runs
 * and callers should omit the duration entirely (no "· undefined"/"· 0s").
 */
export function useElapsedSeconds(active: boolean): number | null {
  // Bump to force a re-render on each tick; the value lives in a ref so it can
  // freeze across the active→inactive transition without resetting.
  const [, forceRender] = useState(0)
  const startRef = useRef<number | null>(null)
  const secondsRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    if (startRef.current === null) startRef.current = Date.now()

    const tick = () => {
      const start = startRef.current
      if (start === null) return
      secondsRef.current = Math.floor((Date.now() - start) / 1000)
      forceRender((n) => n + 1)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [active])

  return secondsRef.current
}

/** Compact Swedish-friendly duration label: `34s`, `1m`, `2m 5s`. */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
}
