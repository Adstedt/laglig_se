import { diffWords } from 'diff'

export interface DiffSegment {
  value: string
  added: boolean
  removed: boolean
}

/**
 * Compute word-level diff between two plaintext strings.
 * Returns segments with added/removed flags for rendering.
 */
export function computeDiff(oldText: string, newText: string): DiffSegment[] {
  const changes = diffWords(oldText, newText)
  return changes.map((change) => ({
    value: change.value,
    added: change.added ?? false,
    removed: change.removed ?? false,
  }))
}
