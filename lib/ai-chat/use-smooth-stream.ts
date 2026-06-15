'use client'

import { useEffect, useRef, useState } from 'react'

// Calm reveal cadence (ms per word) — the main "speed" dial. Higher = slower,
// more deliberate typing. ~58ms ≈ 17 words/s. Used whenever the reveal is
// keeping up; see intervalForBacklog for the catch-up behaviour.
const REVEAL_INTERVAL_MS = 58
// Extra pause after revealing a blank line, so a section/sentence finishes
// settling before the next one starts — the "full sentence first" feel.
const BLOCK_PAUSE_MS = 220
// We never let the reveal trail more than ~this far behind the model. Past it,
// the cadence speeds up (down to MIN_INTERVAL_MS) so the tail drains smoothly
// instead of snapping to the end when the stream finishes.
const MAX_TRAIL_MS = 1200
const MIN_INTERVAL_MS = 22
// Rough chars-per-word, to convert the char backlog into a word count.
const AVG_WORD_LEN = 6

/**
 * Re-paces streamed assistant text on the client and releases it one word at a
 * time, strictly in order. Combined with Streamdown rendered as a single block
 * (see chat-message.tsx), this makes streaming feel linear and top-to-bottom:
 * the renderer only ever sees one new word per commit, appended at the tail, so
 * the fade is a single monotonic front — never two paragraphs on separate clocks.
 *
 * Key behaviours:
 *  - It keeps revealing **after the stream ends**, draining any remaining
 *    backlog at cadence, so the last words still animate in instead of snapping.
 *  - Cadence is calm (REVEAL_INTERVAL_MS) while it keeps up, and speeds up only
 *    when the backlog would otherwise trail more than MAX_TRAIL_MS behind — so
 *    the tail never lags far and never dumps.
 *  - A short pause at blank lines lets a section settle before the next begins.
 *  - Code fences are revealed whole, so they never flash as empty skeletons.
 *  - Historical/static messages (never streamed) render in full immediately.
 *
 * @param target      the full text accumulated so far for this part
 * @param isStreaming whether this part is the live, streaming one
 * @returns the prefix of `target` to display right now
 */
export function useSmoothStream(target: string, isStreaming: boolean): string {
  const [shownLen, setShownLen] = useState(() =>
    isStreaming ? 0 : target.length
  )

  const targetRef = useRef(target)
  targetRef.current = target
  const isStreamingRef = useRef(isStreaming)
  isStreamingRef.current = isStreaming
  const lenRef = useRef(shownLen)
  const everStreamedRef = useRef(isStreaming)
  const rafRef = useRef(0)

  // Historical/static content (never streamed in this session): show it whole.
  useEffect(() => {
    if (!everStreamedRef.current && !isStreaming) {
      lenRef.current = target.length
      setShownLen(target.length)
    }
  }, [isStreaming, target])

  // Reveal loop. Starts when streaming begins and keeps running until the
  // backlog is fully drained — even after streaming ends — then stops itself.
  useEffect(() => {
    if (!isStreaming) return
    everStreamedRef.current = true
    if (rafRef.current) return // loop already running
    let lastRevealAt = 0
    let pauseUntil = 0
    const tick = (now: number) => {
      const full = targetRef.current
      const cur = lenRef.current
      // Fully revealed and the stream has ended → stop the loop.
      if (cur >= full.length && !isStreamingRef.current) {
        rafRef.current = 0
        return
      }
      if (cur < full.length && now >= pauseUntil) {
        const interval = intervalForBacklog(full.length - cur)
        if (now - lastRevealAt >= interval) {
          const next = nextRevealIndex(full, cur)
          const segment = full.slice(cur, next)
          lenRef.current = next
          setShownLen(next)
          lastRevealAt = now
          // Settle pause only while keeping calm pace during the live stream —
          // skip it when catching up or draining the tail.
          if (
            isStreamingRef.current &&
            interval >= REVEAL_INTERVAL_MS &&
            /\n[ \t]*\n/.test(segment)
          ) {
            pauseUntil = now + BLOCK_PAUSE_MS
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    // No cleanup-cancel here: when isStreaming flips false we want the loop to
    // keep draining. Unmount cancellation is handled by the effect below.
  }, [isStreaming])

  // Cancel the loop only on unmount (prevents setState after unmount).
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    },
    []
  )

  return target.slice(0, shownLen)
}

/**
 * Reveal cadence for the current backlog: the calm rate while we're keeping up,
 * speeding up (down to MIN_INTERVAL_MS) once the tail would trail more than
 * MAX_TRAIL_MS behind, so it drains smoothly instead of snapping.
 */
function intervalForBacklog(backlogChars: number): number {
  const wordsLeft = Math.max(1, backlogChars / AVG_WORD_LEN)
  if (wordsLeft * REVEAL_INTERVAL_MS <= MAX_TRAIL_MS) {
    return REVEAL_INTERVAL_MS
  }
  return Math.max(MIN_INTERVAL_MS, MAX_TRAIL_MS / wordsLeft)
}

/** How far to extend the revealed prefix this step. */
function nextRevealIndex(text: string, from: number): number {
  // Safety: if we're somehow inside an open fence, finish it.
  if (insideUnclosedCodeFence(text, from)) {
    return throughFence(text, from)
  }
  // If the next thing to reveal opens a code fence, reveal the whole fence in
  // one step (opener + body + closer) so it never renders as a skeleton.
  let p = from
  while (p < text.length && isSpace(text[p]!)) p++
  if (text.startsWith('```', p)) {
    return throughFence(text, p + 3)
  }
  return nextWordBoundary(text, from)
}

/** True if `from` sits inside an unterminated ``` code fence. */
function insideUnclosedCodeFence(text: string, from: number): boolean {
  const before = text.slice(0, from)
  let count = 0
  let idx = before.indexOf('```')
  while (idx !== -1) {
    count++
    idx = before.indexOf('```', idx + 3)
  }
  return count % 2 === 1
}

/**
 * Index just past the closing ``` (and its line) of the fence whose closer is
 * the next ``` at/after `searchFrom`. If the fence isn't closed yet (still
 * streaming), reveal everything available.
 */
function throughFence(text: string, searchFrom: number): number {
  const close = text.indexOf('```', searchFrom)
  if (close === -1) return text.length
  let i = close + 3
  while (i < text.length && text[i] !== '\n') i++
  if (i < text.length) i++ // include the newline
  return i
}

/**
 * Index just past the next whole word: skip leading whitespace, consume the
 * word, then consume trailing whitespace. If that trailing whitespace contains a
 * blank line (block boundary), stop there so the boundary lands on its own step
 * (which also triggers the settle pause).
 */
function nextWordBoundary(text: string, from: number): number {
  const len = text.length
  let i = from
  while (i < len && isSpace(text[i]!)) i++
  while (i < len && !isSpace(text[i]!)) i++
  let newlines = 0
  while (i < len && isSpace(text[i]!)) {
    if (text[i] === '\n') {
      newlines++
      if (newlines >= 2) {
        i++
        break
      }
    }
    i++
  }
  return i
}

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r'
}
