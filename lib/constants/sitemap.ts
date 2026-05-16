/**
 * Shared constants for the XML sitemap pipeline.
 *
 * Google caps a single sitemap file at 50,000 URLs / 50 MB. We chunk at
 * 10,000 URLs (~2 MB per chunk) — well below the cap, fast enough to render
 * inside Googlebot's fetch timeout, and small enough that per-chunk
 * `<lastmod>` in the sitemap index gives Google a useful re-crawl signal.
 *
 * Used by `app/sitemap.ts` (via `generateSitemaps`) and
 * `app/sitemap-index.xml/route.ts` so the chunk-size math cannot drift
 * between the two.
 */
export const SITEMAP_CHUNK_SIZE = 10_000
