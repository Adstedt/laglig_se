/**
 * Activity log revamp — shared types.
 *
 * `SentencePart` is what the formatter returns: a list of parts the UI renders
 * inline (and the CSV export flattens). Keeping the sentence as data rather
 * than a string lets us re-render links, snapshot-test, and export to text
 * without ever parsing HTML back out.
 */

export type SentencePart =
  | { kind: 'user'; name: string }
  | { kind: 'text'; value: string }
  | { kind: 'emphasis'; value: string }
  | { kind: 'link'; href: string; label: string; deleted?: boolean }

export type ResolvedEntityRef = {
  id: string
  label: string
  href: string | null
  deleted: boolean
}

export type ActivityCategory =
  | 'kopplingar'
  | 'andringar'
  | 'livscykel'
  | 'notifikationer'
  | 'behorigheter'
