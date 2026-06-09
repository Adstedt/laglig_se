/**
 * Shared constants for the XML sitemap pipeline.
 *
 * Google caps a single sitemap file at 50,000 URLs / 50 MB. We chunk at
 * 2,500 URLs (~500 KB per chunk) — halved twice from the original 10K.
 *
 * Why this size: after the static-file migration shipped, we observed
 * that chunk 9 (the partial-fill remainder, 2,231 URLs ≈ ~450 KB)
 * processed to "Success" in GSC on the same day, while chunks 0–8 (5,000
 * URLs ≈ ~1 MB each) were marked "Sitemap could not be read" — a hard
 * verdict, not queue lag. So GSC's processor has a quiet size ceiling
 * somewhere between ~450 KB and ~1 MB. 2,500 URLs/chunk gives ~500 KB
 * per file, slightly above the proven-working chunk 9 size, comfortably
 * below the failure point. The resulting ~19 chunks remain trivial.
 *
 * Used by `scripts/generate-sitemaps.ts` (the build-time static generator)
 * and `scripts/count-sitemap-orphans.ts` so the chunk-size math cannot
 * drift between the two.
 */
export const SITEMAP_CHUNK_SIZE = 2_500
