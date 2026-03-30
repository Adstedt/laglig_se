/**
 * Returns the review date status based on how far in the future or past it is.
 * - 'overdue': date is in the past
 * - 'upcoming': date is within the next 30 days
 * - 'normal': date is more than 30 days in the future
 * - null: no date provided
 */
export function getReviewDateStatus(
  reviewDate: Date | string | null
): 'overdue' | 'upcoming' | 'normal' | null {
  if (!reviewDate) return null

  const date =
    typeof reviewDate === 'string' ? new Date(reviewDate) : reviewDate
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 0) return 'overdue'
  if (diffDays <= 30) return 'upcoming'
  return 'normal'
}
