/**
 * Story 12.10: Generate a unique name by appending " (2)", " (3)", etc. if needed.
 */
export function generateUniqueName(
  baseName: string,
  existingNames: string[]
): string {
  const nameSet = new Set(existingNames)
  if (!nameSet.has(baseName)) return baseName

  let suffix = 2
  while (nameSet.has(`${baseName} (${suffix})`)) {
    suffix++
  }
  return `${baseName} (${suffix})`
}
