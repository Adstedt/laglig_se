/**
 * Swedish-locale relative time formatter.
 *
 * Used by import-review surfaces (granska page + pending-imports banner)
 * for "uppladdad precis nu" / "uppladdad 2 timmar sedan" copy. Originally
 * defined inline at `components/features/law-list-import/import-review-page.tsx`;
 * promoted here so the new banner can reuse the exact same idiom.
 */
export function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const ms = Date.now() - d.getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'precis nu'
  if (minutes < 60) return `${minutes} min sedan`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'timme' : 'timmar'} sedan`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'dag' : 'dagar'} sedan`
}
