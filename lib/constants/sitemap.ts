/**
 * Shared constants for the XML sitemap pipeline.
 *
 * Google caps a single sitemap file at 50,000 URLs / 50 MB. We chunk at
 * 5,000 URLs (~1 MB per chunk) — halved from the original 10K after the
 * GSC processor failed to ingest 2.3 MB children for 5+ weeks while a
 * 100-URL static test sitemap processed in hours. Smaller files reduce
 * the surface area for any quiet size threshold in GSC's pipeline.
 *
 * Used by `scripts/generate-sitemaps.ts` (the build-time static generator)
 * and `scripts/count-sitemap-orphans.ts` so the chunk-size math cannot
 * drift between the two.
 */
export const SITEMAP_CHUNK_SIZE = 5_000
