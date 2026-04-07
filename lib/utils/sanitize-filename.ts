/**
 * Sanitizes a string for use as a filename.
 * Preserves Swedish characters (å, ä, ö). Replaces other special characters with hyphens.
 * Strips leading/trailing hyphens.
 */
export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9åäö]+/g, '-')
    .replace(/^-|-$/g, '')
}
