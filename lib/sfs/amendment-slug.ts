/**
 * Amendment Slug Generator
 *
 * Generates URL-friendly slugs for SFS amendment documents.
 * Pattern: "lag-om-andring-i-{base-law-name}-{year}-{number}"
 *
 * Example:
 * Title: "Lag (2022:1109) om ändring i arbetsmiljölagen (1977:1160)"
 * → Slug: "lag-om-andring-i-arbetsmiljolagen-2022-1109"
 */

/**
 * Normalize Swedish characters and create URL-friendly slug
 */
function normalizeSwedish(text: string): string {
  return text
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
}

/**
 * Extract base law name from amendment title
 *
 * Examples:
 * - "Lag (2022:1109) om ändring i arbetsmiljölagen (1977:1160)" → "arbetsmiljolagen"
 * - "Lag (2024:123) om ändring i lagen (2010:456) om miljöbalken" → "lagen-om-miljobalken"
 * - "Förordning (2023:789) om ändring i arbetsmiljöförordningen (1977:1166)" → "arbetsmiljoforordningen"
 */
function extractBaseLawName(title: string, baseLawName?: string | null): string {
  // If baseLawName is provided directly (from AmendmentDocument), use it
  if (baseLawName) {
    return normalizeSwedish(baseLawName)
  }

  // Try to extract from title
  // Pattern: "om ändring i {lawName} ({sfs})"
  const match = title.match(/om ändring i\s+(.+?)\s*\(\d{4}:\d+\)/)
  if (match?.[1]) {
    return normalizeSwedish(match[1])
  }

  // Fallback: extract anything after "om ändring i"
  const fallbackMatch = title.match(/om ändring i\s+(.+)$/i)
  if (fallbackMatch?.[1]) {
    return normalizeSwedish(fallbackMatch[1].replace(/\s*\(\d{4}:\d+\)\s*/g, ''))
  }

  return 'lag'
}

/**
 * Extract SFS number from string
 * Returns [year, number] tuple
 */
function extractSfsNumber(sfsNumber: string): [string, string] {
  // Handle formats: "2022:1109", "SFS 2022:1109", "SFS2022:1109"
  const match = sfsNumber.match(/(\d{4}):(\d+)/)
  if (match?.[1] && match?.[2]) {
    return [match[1], match[2]]
  }
  return ['0000', '0']
}

/**
 * Generate a URL-friendly slug for an amendment document
 */
export function generateAmendmentSlug(
  sfsNumber: string,
  title?: string | null,
  baseLawName?: string | null
): string {
  const [year, number] = extractSfsNumber(sfsNumber)
  const lawName = extractBaseLawName(title ?? '', baseLawName)

  // Pattern: "lag-om-andring-i-{lawName}-{year}-{number}"
  return `lag-om-andring-i-${lawName}-${year}-${number}`
}

/**
 * Generate amendment title if not provided
 *
 * Example: baseLawSfs="1977:1160", baseLawName="arbetsmiljölagen", sfsNumber="2022:1109"
 * → "Lag (2022:1109) om ändring i arbetsmiljölagen (1977:1160)"
 */
export function generateAmendmentTitle(
  sfsNumber: string,
  baseLawSfs: string,
  baseLawName?: string | null
): string {
  const lawName = baseLawName ?? 'lagen'
  return `Lag (${sfsNumber}) om ändring i ${lawName} (${baseLawSfs})`
}

/**
 * Parse amendment SFS number from slug
 * Example: "lag-om-andring-i-arbetsmiljolagen-2022-1109" → "2022:1109"
 */
export function parseSfsFromSlug(slug: string): string | null {
  // Extract year and number from end of slug
  const match = slug.match(/-(\d{4})-(\d+)$/)
  if (match?.[1] && match?.[2]) {
    return `${match[1]}:${match[2]}`
  }
  return null
}
