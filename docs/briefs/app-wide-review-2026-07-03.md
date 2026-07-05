# App-Wide Review — State of the Project

**Date:** 2026-07-03
**Branch at time of review:** `feat/epic-7-hr` (HEAD `20f6a578`)
**Scope:** Investigation only — no changes made. Five parallel review passes: UI/UX consistency, backend/server-action health, frontend performance, architecture & duplication, repo hygiene. High-severity security findings were hand-verified against source.

## TL;DR

The codebase is in fundamentally good shape for its size (~1,200 source files, 260k lines) — type safety is excellent, auth is centralized and used correctly ~95% of the time, tables are virtualized and memoized, toasts are unified, and recent work (`collective-agreements.ts`, badge-tones, PageHeader) shows the right patterns exist. The problems are:

1. **A handful of genuinely serious security holes in old/orphaned server actions** (verified).
2. **Adoption drift** — good systems exist, but features built before them never migrated.
3. **Repo bloat** — prototypes, one-off scripts, dead landing generations (~30 MB committed).

---

## 🔴 Security — fix before anything else (hand-verified)

1. **Privilege escalation in `app/actions/workspace.ts:404-530`.** `updateWorkspaceSettings`, `addWorkspaceMember`, `removeWorkspaceMember` check only that *a* session exists, then write to whatever `workspaceId` the caller supplies. Any logged-in user can call `addWorkspaceMember(anyWorkspaceId, ownEmail, 'OWNER')` and become owner of any workspace. Appears to be dead Story P.2 code with no UI callers — but `'use server'` exports are live POST endpoints regardless. **Fix: delete or wrap in `requireWorkspaceAccess` + permission check.**
2. **Cross-tenant reads with zero auth:**
   - `getLatestStatusComment(documentId)` (`app/actions/documents.ts:596`) — returns internal compliance comments + commenter name/email for any document ID, no session check.
   - `loadUnacknowledgedChanges(workspaceId)` (`app/actions/change-events.ts:57`) — raw SQL returning change events, AI summaries, list names for any workspace.
   - `loadLinkedArtifacts(listItemId, workspaceId)` (`app/actions/linked-artifacts.ts:86`) — "verifies" tenancy against the attacker-supplied workspaceId; leaks filenames, doc titles/statuses, requirement texts.
   - Root cause: agent-tool cores exported from `'use server'` files. **Fix: move cores to `lib/`, keep thin authed wrappers.**
3. **Unauthenticated mutations:** `cleanupOldVisits(daysToKeep)` (`app/actions/track-visit.ts:110`) — anyone can delete visit rows (`daysToKeep=0` wipes most); `expirePendingActions()` (`pending-agent-actions.ts:1882`) — cron logic as public action; `prefetchListItemDetails` (`prefetch-documents.ts`) — queries workspace law-list items with no auth (cache-poisoning/enumeration surface); cache-invalidation actions in `legal-document-modal.ts:945/959`.

**Context:** `lib/auth/workspace-context.ts` (`withWorkspace`, `getWorkspaceContext`, `requireWorkspaceAccess`) is used correctly across ~95% of ~200 exported actions; 24/43 action files use `withWorkspace`. This is a short, closed list of exceptions. Recommendation: one deliberate pass to make the "public by design" action set explicit.

## 🟠 Correctness — transaction gaps

~15 multi-write actions run without `$transaction`, so a mid-sequence crash corrupts state:

- `change-assessment.ts::createOrUpdateAssessment` — assessment upsert + status log + item update can diverge.
- `pending-agent-actions.ts::rejectPendingAction` (:1569) / `rejectDraftFromEditor` (:1799) — orphaned REJECTED actions or live drafts.
- `document-list.ts::createDocumentList`/`updateDocumentList` — two lists can end up `is_default`, or none.
- `files.ts::deleteFile` / `deleteFilesBulk` / `unlinkFile` — file delete + chunk cleanup unbundled.
- `workspace.ts::addWorkspaceMember` — user.create + member.create.

The heavy pipelines (law-list-import, audit-cycle materialization, tasks reorder) already use `$transaction` correctly — it's the small 2–3-write actions that were skipped.

## 🎨 UI/UX — the systems won, the features didn't migrate

**#1 visual issue — status-pill drift:** `lib/ui/badge-tones.ts` is the declared single source of truth (22 importers), but ~91 ad-hoc `bg-green-100 text-green-700`-style maps live across ~25 feature files:

- **55 of those lines have no `dark:` variant** — glowing pastel chips on the near-black `0 0% 10%` background. Worst: `compliance-audit/bedomning-copy.ts:24-39` (entire BEDOMNING map light-only, core surface), `tasks/task-workspace/calendar-tab.tsx:232-234`, `law-list-import/import-review-page.tsx:692-694`.
- Two competing dark recipes: canonical `bg-X-500/15 + text-X-300` vs hand-rolled `dark:bg-X-900 + dark:text-X-200` (~104 lines) — same status renders at different weights; the -900 recipe fights the "lean darker" direction.
- Priority map duplicated in `task-filters-toolbar.tsx:60`, `create-task-modal.tsx:103`, `task-creation-form.tsx:98`.

**Other findings:**

- **Safiro/heading violations:** 40 h1–h3s use `font-bold`/`font-semibold` without Safiro (`settings/page.tsx:177`, `document-hero.tsx:130`, `admin/cache-dashboard/page.tsx:67` — also English title). `CardTitle` (`components/ui/card.tsx:39`) defaults `text-2xl font-semibold`, so every unstyled Card fights the system. This is effectively the Story 22.11 gap inventory.
- **Copy split:** "Radera" vs "Ta bort" for equivalent permanent deletes (12 vs 12). "Ej ifylld" exists only in personalregister (`labels.ts:35`); 32 bare `—` placeholders elsewhere.
- **Missing `loading.tsx`:** `/personalregister`, `/krav`, `/settings` block with zero feedback while siblings show skeletons. Skeleton drift: 37 files use the primitive, 55 lines hand-roll `bg-muted animate-pulse`.
- **Silent failures:** 14 feature files `console.error` in catch with no toast (`export-dropdown.tsx`, `manage-list-modal.tsx`, `group-manager.tsx`, `create-workspace-modal.tsx`) vs 65 files doing it right.
- **Tri-plicated modal internals:** `right-panel-rail.tsx` + `compact-*-strip.tsx` copy-pasted into tasks, cycle-item, and legal-document modals (648 lines), already drifting (EJ_TILLAMPLIG dot `bg-gray-400` vs `bg-gray-300`).
- **PageHeader:** 14 adopters, but settings/permission-denied/cache-dashboard hand-roll; browse pages style correctly but duplicate markup.
- Low: destructive-confirm styling inlined 8+ times (should be a variant); one `window.confirm` (`import-review-page.tsx:358`); 85 hardcoded `gray-*` classes; 33 hardcoded hex; icon-button a11y gaps only in `kanban-tab.tsx` + `group-manager.tsx`.

**Healthy:** sonner everywhere (zero `use-toast`), no English UI strings, "kompletthet" ban respected, Swedish sentence case consistent, radius/shadow drift minimal.

## ⚡ Performance — three cheap, big wins

1. **`public/fonts/GoogleSansFlex.ttf` is 4.0 MB, unsubsetted, plain `@font-face`** (`globals.css:11-17`) — largest render-affecting asset, shipped to every visitor, guaranteed multi-second FOUT on cold loads. Subsetted woff2 via `next/font/local` ≈ 100–300 KB (~93% cut). Safiro (14 KB woff2) is the in-file template.
2. **`ChatMessage` (1,993 lines) — zero memoization.** `chat-message-list.tsx:209-233` maps all messages each render; streaming replaces the array per token, so every historical message re-runs fully. Plus O(n²) `messages.indexOf(message)` at `:210`. Fix: `React.memo(ChatMessage)` + pass index.
3. **TipTap statically bundled into hot bundles** via `compliance-detail-table.tsx` (laglistor route!), task modal description editor, legal-document-modal tabs. Only 3 `next/dynamic` usages repo-wide. Lazy-load the editor behind edit-mode interaction.

**Also:**

- 85% of `components/` is client (`467/552`; features 88%); pages/layouts themselves are clean (3/89 client pages, 0 client layouts) — cost is bundle+hydration.
- `app/(workspace)/layout.tsx` (force-dynamic) chains ~6 sequential roundtrips per nav; SEO-critical `(public)/lagar/[id]/page.tsx` has 7 awaits, 0 `Promise.all`.
- Custom webpack `splitChunks` in `next.config.mjs:176-204` is dead under Turbopack — and forces a monolithic vendor chunk if webpack ever returns. Delete.
- `react-pdf` CSS imported in root layout (`app/layout.tsx:16-17`) for a single-surface feature.
- Landing: `knowledge-graph-section.tsx` (1,377 lines) re-renders on a 13 s `setInterval`; landing-v3 uses 18 raw `<img>` bypassing optimization.
- `employee-list-table.tsx` (1,177 lines): no virtualization, no row memo — fine today, first to degrade as Epic 7 registers grow.
- Healthy: tanstack-virtual + memoized rows on all major tables (Story P.4), providers clean, `ignoreBuildErrors: false`, image optimization on.

## 🏗️ Architecture — the actions layer ate the domain layer

- **Inverted layering:** 20 `lib/` files import from `app/actions`/`app/api` (`lib/hooks/use-chat-interface.ts`, `lib/agent/tools/*`, `lib/stores/document-list-store.ts`, `lib/auth/session.ts` ← nextauth route). Actions became the de facto domain layer: `app/actions` = 29,589 lines; `documents.ts` 2,805, `files.ts` 2,409, `tasks.ts` 2,278. **The Story 7.6 `lib/files/upload-core.ts` extraction is the validated template** — apply to documents/tasks/pending-agent-actions.
- **Copy-paste infrastructure:** `ActionResult<T>` redeclared in 20 files (not a discriminated union); `formatDate` 14+ definitions (5 in law-versions alone); `formatFileSize` ×3; ownership-check boilerplate ×28–60 (an `assertOwned(model, id, workspaceId)` in `lib/db/` would remove hundreds of lines); 4 independent `new Anthropic()` sites (+15 in scripts) with divergent policy — no `lib/ai/clients.ts`.
- **Efficiency:** ~79/104 `findMany` unbounded (chat history `ai-chat.ts:185`, list items, employees); `files.ts` walks folder trees one query per level in 4 places (`getDescendantFiles:1772`, `getFolderDepth:191`, `wouldCreateCycle:208`, `getFolderPath:2073`); `linkFilesToTask/ListItem` loop per-file upserts; ~20 whole-row fetches pulling `extracted_text` on ownership checks.
- **Schema:** healthy overall (65 models, 157 indexes); confirm `NotificationPreference` workspace-only lookups; cascades deliberate (`Restrict` on audit-cycle FKs).
- **Validation:** zod broad but mixed `.parse`/`.safeParse`; gap: `pending-agent-actions.ts` (1,890 lines) has none.
- **Env:** `lib/env.ts` (t3-oss + zod) exists but 153 raw `process.env` reads bypass it — including `ADMIN_JWT_SECRET` and `CRON_SECRET` paths.
- **Tests:** 539 files, genuinely good posture, but coverage tracks recency not risk (compliance-audit 5,500+ lines vs `tasks.ts` 581); action tests fragmented across 3 directories; 57 `.skip`s.
- **Excellent:** ~80 `any`s in 260k lines; naming/export conventions near-uniform. 506 `console.*` calls with no structured logger despite `lib/sentry/context.ts`.

## 🧹 Repo hygiene — ~30 MB dead weight committed

- `_prototypes/` **15 MB tracked** (~40 HTML mockups + PNGs); `screenshots/` **12 MB tracked** (other screenshot dirs are gitignored; this one slipped).
- **`scripts/` = 534 tracked files, 12 MB:** ~106 `check-*`, ~87 `test-/debug-/analyze-*`, 18 `backfill-*` one-offs mixed flat with the 4 load-bearing scripts in package.json (`generate-skills-manifest`, `generate-sitemaps`, `apply-performance-indexes`, `ingest-laws`). High accident risk — needs an `archive/` split.
- **`/landing-v2` still publicly served in production** (noindex only, no `notFound()` gate), keeping `components/features/landing-v2/` (100 KB) alive; 8/15 sections in `components/features/landing/` have zero importers. `/cap-shot` self-labels "delete after capture."
- Committed root clutter: `temp_migration.sql` (0 B), `cache-warm-test.log`, `myndighetsforeskrifter-investigation.md` (44 KB), zero-byte file named `method`, `public/sitemap-test.xml`.
- Deps: `embla-carousel-react` 0 imports (remove); `critters` likely removable (Next 15+ vendors its own — verify with build); `word-extractor` → devDependencies. Clean: next-auth, date-fns single stack, react-markdown/streamdown coexist by design, puppeteer/chromium-min PDF stack intentional (do not dismantle).
- `public/` 80 MB: marketing 55 MB intentional (Epic 26), but `demo-team/` has 7 MB of PNGs whose 2 KB WebP twins are the only referenced versions; `GoogleSansFlex.ttf` (see perf #1); 6+ redundant logo variants.
- Fine as-is: `/styleguide` (prod-gated), public-vs-`/browse` route duplication (deliberate).

---

## Suggested priority order

1. **Now — security pass (~half a day):** delete/wrap the `workspace.ts` trio; auth the four leaky reads (`getLatestStatusComment`, `loadUnacknowledgedChanges`, `loadLinkedArtifacts`, `prefetchListItemDetails`); gate `cleanupOldVisits` + `expirePendingActions` behind cron.
2. **Next:** transaction gaps; font subsetting; `React.memo(ChatMessage)`; TipTap lazy-load; three missing `loading.tsx` files. Each is hours, not days.
3. **Themed cleanup story:** badge-tones migration (kills dark-mode breakage wholesale); shared `ActionResult` + `lib/utils/format.ts` (date/bytes); Radera/Ta bort decision; silent-catch → toast pass.
4. **Structural/opportunistic:** extend `upload-core.ts` pattern to documents/tasks (reverses lib→actions inversion); `scripts/` archive split; delete `_prototypes`/`screenshots`/landing-v2/cap-shot; env-module adoption for secrets.

*Generated from five parallel review passes; security findings in section 1 verified by direct source reading. Line numbers valid as of HEAD `20f6a578`.*
