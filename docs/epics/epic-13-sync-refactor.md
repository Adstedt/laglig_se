# Epic 13: SFS Sync Refactor & Version Infrastructure Cleanup

## Epic Overview

**Epic ID:** Epic 13
**Status:** Draft
**Priority:** High (reliability — current sync misses changes; technical debt — unused version infrastructure)
**Business Owner:** Sarah (PO)
**Technical Lead:** Development Team

## Epic Goal

Replace the unreliable poll-and-diff SFS change detection with a publication-monitor approach that catches all amendments, repeals, and new laws reliably. Simultaneously remove the unused version/diff infrastructure that was built for a feature direction we're no longer pursuing.

## Epic Description

### Why This Matters

The current `sync-sfs-updates` cron has three structural failure modes:

1. **Regex blind spot** — `extractAllSfsReferences` only matches `Lag (YYYY:NNN)` / `Förordning (YYYY:NNN)` inline in body text. Repeals and other reference styles are invisible. Proven failure: SFS 2026:71 repealed Förordning 2009:1562 and was never detected.
2. **No catch-up mechanism** — The 48-hour `LOOKBACK_HOURS` window means if the cron fails on a given day, that change is lost forever. No high-water mark, no retry queue.
3. **`systemdatum` noise** — Riksdagen's `systemdatum` changes for metadata-only updates, causing unnecessary full-text fetches and diffs against ~100 documents per run, most of which we don't even track.

Meanwhile, the version/diff infrastructure (`DocumentVersion` snapshots, `diff_summary`, version reconstruction pages, diff API routes) was built for historical version browsing — a feature that adds little value compared to showing amendment-sourced section changes. The amendment PDFs parsed by Claude already provide structured `SectionChange` records that tell users exactly what changed. The Riksdagen text diffs are redundant.

### The Fix: Publication-Monitor Approach

Every legal change in Sweden is published as a new SFS number on svenskforfattningssamling.se. The title of each publication tells you exactly what it does:

- `"Lag (2025:732) om ändring i arbetsmiljölag (1977:1160)"` → **AMENDMENT** to 1977:1160
- `"Förordning (2026:71) om upphävande av förordning (2009:1562)"` → **REPEAL** of 2009:1562
- `"Lag (2026:xxx) om ..."` → **NEW_LAW**

Instead of polling all recently modified documents and diffing their text, we:

1. Query Riksdagen API for **newly published** SFS documents (sorted by `datum`)
2. Parse the title to classify: AMENDMENT / REPEAL / NEW_LAW
3. Extract the base law SFS number from the title
4. Check if that base law is tracked (exists in any `LawList`) → if not, skip
5. If tracked: fetch the amendment PDF, parse with Claude, create notifications
6. Track a **high-water mark** (last seen SFS number) so nothing falls through the cracks

### What's Being Removed

- `DocumentVersion` full-text snapshots (stop creating, eventually drop table)
- `ChangeEvent.diff_summary` unified diffs (stop populating)
- Version reconstruction pages (`/version/[date]` — public + workspace)
- Diff API routes (`/api/laws/[sfs]/diff`, `/api/laws/[sfs]/diff/[amendmentSfs]`, `/api/laws/[sfs]/version/[date]`)
- Version/diff UI components (`HistoricalVersionBanner`, `VersionSelector`, `VersionDiff`, `VersionByVersionTimeline`, `SectionHistoryPanel`)
- Backend modules: `version-reconstruction.ts`, `version-cache.ts`, `version-diff.ts`
- `computeDiff()`, `generateUnifiedDiff()` from `change-detection.ts`
- ~10 debug/test scripts for version reconstruction and diff testing

### What's Being Kept

- **Historik pages** (`/lagar/[slug]/historik`) — amendment timeline listing all amendments affecting a law
- **`/api/laws/[sfs]/history`** — amendment timeline API
- **`/api/laws/[sfs]/sections/[chapter]/[section]/history`** — section-level history API
- **`getLawAmendmentTimeline()`** and **`getSectionHistory()`** — extracted from version-reconstruction.ts to a new module
- **`getCachedAmendmentTimeline()`** — extracted from version-cache.ts
- **`hasSubstantiveChanges()`** — still useful for edge cases
- **`detectChanges()` / `createChangeNotifications()`** — still creates `ChangeEvent` records, just without diff_summary

### Impact on Epic 8

Stories 8.1 (Changes Tab) and 8.2 (Diff View) are already designed to use `SectionChange` records from parsed amendment PDFs — **not** the version-reconstruction or text-diff infrastructure. Only minor documentation updates needed: remove `diff_summary` references from their data model notes.

### Existing System Context

- **Technology stack:** Next.js, Prisma, Supabase Storage, Redis, Claude LLM (Sonnet for PDF parsing)
- **Cron scheduling:** Vercel cron, `maxDuration = 300` with 30s buffer timeout pattern
- **Notification pipeline:** `createChangeNotifications()` → `Notification` records → bell + email digest (Stories 8.15, 8.4, 8.5 — all done)
- **Amendment PDF pipeline:** `fetchAndStorePdf()` → `parseAmendmentPdf()` → `createLegalDocumentFromAmendment()` (mature, proven)

## Stories

### Story 13.1: Publication-Monitor SFS Sync

Refactor `sync-sfs-updates` from poll-and-diff to publication-monitor approach.

**Key changes:**
- Query Riksdagen API sorted by `datum` (publication date) instead of `systemdatum`
- Parse document `titel` to classify change type and extract base law SFS number
- Track high-water mark (last processed SFS number or publication date) in a persistent store (DB or KV)
- Only process publications that reference laws in active `LawList`s
- Remove `archiveDocumentVersion()` call
- Remove `computeDiff()` / `generateUnifiedDiff()` / `diff_summary` storage from `detectChanges()`
- Keep downstream pipeline: PDF fetch, LLM parse, `ChangeEvent` creation, `createLegalDocumentFromAmendment()`
- Add catch-up logic: if cron was down for days, process all publications since last high-water mark (within timeout budget)

**Acceptance criteria defined in story file.**

### Story 13.2: Remove Version/Diff UI, API Routes & Components

Remove all user-facing version/diff features and their supporting API routes.

**Key changes:**
- Delete version/[date] page routes (public + workspace + loading states)
- Delete diff API routes (`/api/laws/[sfs]/diff`, `/api/laws/[sfs]/diff/[amendmentSfs]`, `/api/laws/[sfs]/version/[date]`)
- Delete version components (`HistoricalVersionBanner`, `VersionSelector`, `VersionDiff`, `VersionByVersionTimeline`, `SectionHistoryPanel`)
- Remove any navigation links pointing to deleted routes
- Update historik pages if they reference version selectors
- Verify historik pages and section history API still work correctly

**Acceptance criteria defined in story file.**

### Story 13.3: Backend Cleanup & Schema Migration

Extract useful functions from version modules, delete dead code, and clean up schema.

**Key changes:**
- Extract `getLawAmendmentTimeline()` + `getSectionHistory()` + `getAvailableVersionDates()` from `version-reconstruction.ts` → new `lib/legal-document/amendment-timeline.ts`
- Extract `getCachedAmendmentTimeline()` + `invalidateLawCache()` from `version-cache.ts` → new `lib/legal-document/timeline-cache.ts`
- Delete `version-reconstruction.ts`, `version-cache.ts`, `version-diff.ts` entirely
- Simplify `change-detection.ts`: remove `computeDiff`, `generateUnifiedDiff`, keep `hasSubstantiveChanges` + `detectChanges` (without diff storage)
- Delete `version-archive.ts` (all exports now unused)
- Delete ~10 debug/test scripts (`debug-version-reconstruction.ts`, `test-version-diff.ts`, `test-version-cache.ts`, `test-diff-output.ts`, `test-hyphenation-in-diff.ts`, `analyze-diff-output.ts`, `check-full-history.ts`, `debug-text-comparison.ts`, `debug-section-1-4.ts`, `backfill-single-law.ts`)
- Delete related test files
- Prisma migration: make `ChangeEvent.diff_summary` nullable (already is) — no schema change needed
- Prisma migration: drop `document_versions` table (or defer if we want to preserve historical data)
- Update `lib/sync/index.ts` exports
- Remove `diff` npm package if no longer used anywhere (check: 8.2 will need it client-side for `SectionChange` word-level diff)

**Acceptance criteria defined in story file.**

## Story Dependencies & Sequencing

```
13.1 (Publication-Monitor Sync)
  │
  ├──→ 13.2 (Remove Version/Diff UI)    ← can start in parallel, no code overlap
  │
  └──→ 13.3 (Backend Cleanup)           ← depends on both 13.1 + 13.2 being merged
```

- **13.1** and **13.2** can run in parallel — 13.1 changes the sync cron, 13.2 removes UI/API routes
- **13.3** must come after both, since it deletes backend code that 13.1 stops calling and 13.2 stops routing to

## Compatibility Requirements

- [x] Historik pages (`/lagar/[slug]/historik`) continue to work — amendment timeline unaffected
- [x] Section history API (`/api/laws/[sfs]/sections/.../history`) continues to work
- [x] Notification pipeline (bell + email digest) continues to work — `ChangeEvent` creation is preserved
- [x] Amendment PDF pipeline continues to work — fetch, parse, `LegalDocument` creation unchanged
- [x] `sync-sfs` cron (new laws) is unaffected — separate cron, different concern
- [x] Epic 8 Phase 2 stories (8.1, 8.2, 8.3) need only trivial doc updates (remove `diff_summary` references)
- [ ] `diff` npm package retained for Story 8.2's client-side section diff rendering

## Risk Mitigation

- **Primary Risk:** New publication-monitor misses edge cases during transition
- **Mitigation:** Run both old and new detection in parallel for 1-2 weeks (new writes to a log, old still creates records). Compare outputs. Switch over once confident.
- **Rollback Plan:** The old `sync-sfs-updates` code is in git history. If the new approach has issues, revert the cron route file. No schema changes block rollback (DocumentVersion table can remain unused).

## Definition of Done

- [ ] All SFS changes (amendments, repeals) reliably detected — no missed changes like the 2026:71 incident
- [ ] High-water mark tracking prevents lost changes across cron failures
- [ ] Version/diff pages and API routes fully removed
- [ ] Dead backend code removed, useful functions extracted
- [ ] Historik pages, section history, notification pipeline all verified working
- [ ] Existing tests pass, new tests cover publication-monitor logic
- [ ] No regression in existing features

## Change Log

| Date       | Version | Description              | Author     |
| ---------- | ------- | ------------------------ | ---------- |
| 2026-02-17 | 1.0     | Initial epic creation    | Sarah (PO) |
