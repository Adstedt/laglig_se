/**
 * Rewrite legal-ref link hrefs for workspace (authed) context.
 * Baked links point to public routes (/lagar/..., /foreskrifter/..., etc.).
 * This prepends /browse so they stay in the workspace layout.
 *
 * Kept in its own file to avoid pulling in cheerio/prisma from the barrel.
 */
export function rewriteLinksForWorkspace(html: string): string {
  // Lookahead ensures we match regardless of attribute order (href may come before or after class)
  return html.replace(
    /(<a\b(?=[^>]*class="legal-ref")[^>]*href=")\/([^"]*")/g,
    '$1/browse/$2'
  )
}
