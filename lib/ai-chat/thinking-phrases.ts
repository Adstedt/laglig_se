'use client'

import { useEffect, useState } from 'react'

export const THINKING_PHRASES = [
  'Tänker',
  'Resonerar',
  'Funderar',
  'Bläddrar i SFS',
  'Granskar paragrafer',
  'Konsulterar lagboken',
  'Korsläser källor',
  'Sorterar förordningar',
  'Väger argumenten',
  'Knyter ihop trådarna',
  'Söker rätt lagrum',
  'Räknar paragrafer',
  'Hämtar förarbeten',
  'Stämmer av mot kraven',
  'Skissar bedömningen',
  'Letar prejudikat',
  'Slår upp lagrum',
  'Funderar juridiskt',
  'Vänder på frågan',
  'Sammanställer underlag',
] as const

export type ThinkingPhrase = (typeof THINKING_PHRASES)[number]

function pickDifferent(prev: string | null): ThinkingPhrase {
  if (THINKING_PHRASES.length <= 1) return THINKING_PHRASES[0]!
  let next: ThinkingPhrase = prev as ThinkingPhrase
  while (next === prev) {
    next =
      THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]!
  }
  return next
}

/**
 * Returns a Swedish thinking phrase. While `active` is true, rotates to a
 * different phrase every `intervalMs`. Stops rotating (and freezes on the
 * last phrase) when `active` flips to false.
 *
 * Used by the AI chat `ReasoningBlock` to mask the underlying English
 * extended-thinking trace during streaming with an on-brand Swedish status
 * line. Power users can still inspect the raw trace once streaming completes.
 */
export function useRotatingThinkingPhrase(
  active: boolean,
  intervalMs = 3000
): ThinkingPhrase {
  const [phrase, setPhrase] = useState<ThinkingPhrase>(() =>
    pickDifferent(null)
  )

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      setPhrase((prev) => pickDifferent(prev))
    }, intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])

  return phrase
}
