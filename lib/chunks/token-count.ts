/**
 * Token counting utility for chunking pipeline
 * Story 14.2, Task 3
 *
 * Uses chars/4 heuristic — good enough for chunk sizing decisions.
 * Real token counts (via tiktoken) would be needed only if precise
 * billing estimation is required (Story 14.3).
 */

/**
 * Estimate the number of tokens in a text string.
 * Uses the widely-accepted heuristic: ~4 characters per token for English/Swedish text.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}
