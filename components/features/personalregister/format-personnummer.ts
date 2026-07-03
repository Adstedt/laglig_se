/**
 * Story 7.4 (Task 3b): personnummer DISPLAY formatting for the register table.
 *
 * Renders `ÅÅMMDD-XXXX` (e.g. `890503-2556`) when the decrypted value lacks a
 * separator. Pure display concern: the stored/decrypted value is NEVER
 * mutated, and masked values must be rendered as-is by the caller (the mask
 * is not a personnummer). Anything this function does not positively
 * recognize passes through unchanged.
 */

/**
 * Format a decrypted personnummer for display.
 *
 * - `YYMMDDXXXX` (10 digits) → `YYMMDD-XXXX`
 * - `YYYYMMDDXXXX` (12 digits) → `YYMMDD-XXXX` (century dropped for display)
 * - Values already containing a separator (`-` or `+`), or any other shape,
 *   are returned verbatim.
 */
export function formatPersonnummerDisplay(value: string): string {
  if (value.includes('-') || value.includes('+')) return value
  if (!/^\d+$/.test(value)) return value

  if (value.length === 10) {
    return `${value.slice(0, 6)}-${value.slice(6)}`
  }
  if (value.length === 12) {
    return `${value.slice(2, 8)}-${value.slice(8)}`
  }
  return value
}
