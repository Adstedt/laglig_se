# Test Coverage Analysis

**Date:** 2026-03-14
**Scope:** Full codebase audit of `/home/user/laglig_se`

## Overview

| Metric | Count |
|--------|-------|
| Total source files (TS/TSX) | ~1,042 |
| Total test files | 228 |
| Unit tests | 177 |
| Integration tests | 18 |
| E2E tests (Playwright) | 28 |
| Skipped/TODO tests | 43+ |

The project has a solid testing foundation with good patterns in place, but several critical areas lack coverage entirely. There are also 43+ skipped or `.todo()` test placeholders creating a false sense of completeness.

---

## Critical Coverage Gaps

### 1. `lib/cache/` — 0% coverage (11 files, 0 tests)

**Risk: HIGH — Core infrastructure, performance-critical**

All caching infrastructure is completely untested:

- `cached-queries.ts` — Document detail queries with `unstable_cache`, 1hr TTL, tag-based invalidation
- `cached-browse.ts` — Browse/catalogue queries with tiered TTLs (1hr default, 5min filtered)
- `invalidation.ts` — Cache invalidation after sync jobs (Redis + `revalidateTag`)
- `redis.ts` / `redis-proper.ts` — Redis client singletons with graceful fallback
- `workspace-cache.ts` — Workspace-scoped caching with isolation
- `user-cache.ts` — User session caching to reduce DB queries
- `warm-on-startup.ts` / `prewarm-browse.ts` — Cache warming for popular documents
- `strategies.ts` — Cache duration constants (24h for laws, 5m for lists, 1m for tasks)
- `server-cache.ts` — Server-side cache tag generators

**Recommended tests:**
- Unit tests for cache key generation and TTL strategies
- Unit tests for invalidation logic (which tags get cleared for which mutations)
- Integration tests for Redis fallback behavior (Redis down → graceful degradation)
- Integration tests for cache warming correctness

---

### 2. `lib/legal-document/` — 0% coverage (4 files, 0 tests)

**Risk: HIGH — Core business logic**

These files implement the heart of the legal document platform:

- `version-diff.ts` — Generates diffs between law versions using the `diff` npm package
- `version-reconstruction.ts` — Reconstructs historical law text by combining current sections + historical changes at a target date
- `section-parser.ts` — Parses Riksdagen HTML to extract individual law sections (paragrafer), handling chapters and lettered sections
- `version-cache.ts` — Two-tier caching (L1 in-memory + L2 Redis) for historical versions

**Recommended tests:**
- Unit tests for `version-diff.ts` with known input/output pairs (added, removed, changed sections)
- Unit tests for `version-reconstruction.ts` with fixtures of real law versions at specific dates
- Unit tests for `section-parser.ts` with sample Riksdagen HTML covering chapters, lettered sections, edge cases
- Integration tests verifying L1→L2 cache fallback in `version-cache.ts`

---

### 3. `app/api/` — 85% untested (28 of 33 routes)

**Risk: HIGH — Public attack surface**

Only 5 API routes have tests (all notification-related). The remaining 28 routes are untested:

**Auth & security:**
- `/api/auth/[...nextauth]` — NextAuth configuration
- `/api/auth/me` — Current user profile

**Core features:**
- `/api/browse` — Document catalogue
- `/api/chat` — AI chat streaming with rate limiting
- `/api/search` — Full-text search
- `/api/laws/[sfs]` — Law retrieval
- `/api/laws/[sfs]/diff/[amendmentSfs]` — Version diffs
- `/api/laws/[sfs]/history` — Amendment history
- `/api/laws/[sfs]/version/[date]` — Historical law versions
- `/api/laws/[sfs]/sections/[chapter]/[section]/history` — Section-level history
- `/api/files/[fileId]` — File retrieval
- `/api/workspace/*` — Workspace context, list, switch (3 routes)

**Cron jobs (8 routes):**
- `sync-sfs`, `sync-sfs-updates`, `sync-court-cases` — Data sync
- `discover-sfs-amendments` — Amendment discovery
- `generate-summaries` — AI summary generation
- `prewarm-cache`, `warm-cache` — Cache warming
- `cleanup-workspaces`, `retry-failed-pdfs` — Maintenance

**Health:**
- `/api/health/db` — Database health check

**Recommended tests:**
- Integration tests for law retrieval routes with fixture data
- Integration tests for workspace routes verifying tenant isolation
- Unit tests for cron job logic (mock external APIs)
- Auth route tests verifying session handling and error responses

---

### 4. `lib/auth/` — 75% untested (3 of 4 files)

**Risk: HIGH — Security-critical**

- `require-auth.ts` — Guards server actions; throws if unauthenticated
- `session.ts` — `getServerSession()` and `getCurrentUser()` helpers
- `workspace-context.ts` — Multi-tenancy context, permission checking, workspace isolation

**Recommended tests:**
- Unit tests for `require-auth.ts` (authenticated vs unauthenticated, expired sessions)
- Unit tests for `workspace-context.ts` (permission checks per role, workspace isolation boundaries)

---

### 5. `lib/external/` — 80% untested (4 of 5 integrations)

**Risk: MEDIUM-HIGH — External dependency failures cascade**

- `riksdagen.ts` — Riksdagen Open Data API client for Swedish law documents
- `domstolsverket.ts` — Swedish courts PUH API client for court cases
- `eurlex.ts` — EUR-Lex SPARQL API for EU legislation
- `elasticsearch.ts` — Elasticsearch with Swedish support, fuzzy matching, PostgreSQL fallback

**Recommended tests:**
- Unit tests with mocked HTTP responses for each API client
- Tests for error handling (timeouts, malformed responses, rate limiting)
- Test for Elasticsearch → PostgreSQL ILIKE fallback path

---

### 6. `app/actions/` — 59% untested (13 of 22 actions)

**Risk: MEDIUM-HIGH — Server-side business logic**

Untested actions include:
- `auth.ts` — Signup/login with Zod validation and Supabase Auth
- `browse.ts` — Document browsing with caching
- `ai-chat.ts` — Chat persistence (save, get history, clear)
- `admin-auth.ts` — Admin login, token creation, session cookies
- `admin-templates.ts` — Admin template CRUD
- `invitations.ts` — Workspace invitation acceptance
- `prefetch-documents.ts` — Batch document prefetching
- `workspace-settings.ts` — Settings updates with permission checks
- `track-visit.ts` — Fire-and-forget visit tracking

**Recommended tests:**
- Unit tests for Zod validation in `auth.ts` and `admin-auth.ts`
- Unit tests for `browse.ts` filtering/pagination logic
- Integration tests for `invitations.ts` (invitation acceptance flow with workspace state)

---

### 7. `lib/transforms/` — Partially tested (4+ files without tests)

**Risk: MEDIUM — Data pipeline integrity**

- `canonical-html-parser.ts` — HTML→JSON parser for all content types
- `document-json-schema.ts` — Canonical JSON schema with Zod validation
- `html-to-markdown.ts` — Deterministic HTML→Markdown for Swedish legal documents
- `validate-document-json.ts` — Schema validation with mutual exclusivity rules
- `normalizers/sfs-amendment-normalizer.ts` — Riksdag HTML → canonical HTML for amendments

**Recommended tests:**
- Unit tests with real HTML fixtures for `canonical-html-parser.ts`
- Snapshot or golden-file tests for `html-to-markdown.ts` output
- Validation edge cases in `validate-document-json.ts`

---

### 8. `lib/db/` — Query optimizations untested

**Risk: MEDIUM — Performance regressions**

- `connection-retry.ts` — Exponential backoff for Supabase pooling
- `queries/optimized/law-list.ts` — Cursor-based pagination, N+1 prevention
- `queries/optimized/workspace.ts` — 2-level nesting limit, parallel queries

**Recommended tests:**
- Unit tests for retry logic (max retries, jitter, delay progression)
- Unit tests for cursor-based pagination edge cases (empty results, last page)

---

## Structural & Quality Issues

### 9. No coverage thresholds configured

Neither `vitest.config.mts` nor CI enforce minimum coverage percentages. Coverage is uploaded to Codecov but never gates PRs. This means coverage can silently regress.

**Recommendation:** Add coverage thresholds to `vitest.config.mts`:
```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  thresholds: {
    statements: 60,
    branches: 55,
    functions: 60,
    lines: 60,
  }
}
```

### 10. 43+ skipped/TODO tests

**Integration tests (19 TODOs):**
- `auth/login.test.ts` — All 8 tests are `.todo()` (zero implementation)
- `auth/password-reset.test.ts` — All 7 tests are `.todo()`
- `auth/signup.test.ts` — 4 full-flow tests are `.todo()`

**E2E tests:**
- `auth/auth-flow.spec.ts` — All 5 tests are empty stubs with TODO comments
- Multiple E2E specs conditionally skip when `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` are missing (dashboard, settings, template-adoption, workspace-comparison)

**Recommendation:** Prioritize implementing the auth integration tests — login, password reset, and signup are foundational flows.

### 11. Zustand stores untested (4 of 6 files)

`lib/stores/` has no tests for:
- `layout-store.ts` — Sidebar state, localStorage persistence
- `ui-store.ts` — Modal state management
- `workspace-store.ts` — Workspace state with Immer

**Recommendation:** Unit tests for store actions, selectors, and persistence/hydration.

### 12. AI components untested (`components/ai-elements/`)

All 3 AI chat UI components (`message.tsx`, `response.tsx`, `index.ts`) lack tests. The AI chat is a user-facing feature.

### 13. CI only runs unit tests

The CI pipeline (`ci.yml`) excludes integration and performance tests:
```
pnpm vitest run --exclude 'tests/integration/**' --exclude 'tests/performance-*'
```

E2E tests only run on preview deployments. Integration tests are never run in CI.

**Recommendation:** Add an integration test job to CI (can run against a test database).

---

## Prioritized Action Plan

| Priority | Area | Files | Effort | Impact |
|----------|------|-------|--------|--------|
| **P0** | `lib/legal-document/` | 4 files | Medium | Core business logic, regressions here break the product |
| **P0** | `lib/auth/` | 3 files | Low | Security-critical, small surface area |
| **P0** | Auth integration tests | 3 files | Medium | 19 TODO tests for login/signup/password-reset |
| **P1** | `lib/cache/` | 11 files | High | Performance infrastructure, hard to debug without tests |
| **P1** | API routes (law endpoints) | 6 routes | Medium | Public-facing, user-visible |
| **P1** | Coverage thresholds | Config | Low | Prevents future regression |
| **P2** | `lib/external/` | 4 files | Medium | External API contracts |
| **P2** | `app/actions/` (remaining) | 9 files | Medium | Server-side validation |
| **P2** | `lib/transforms/` | 4+ files | Medium | Data pipeline correctness |
| **P3** | Zustand stores | 4 files | Low | UI state edge cases |
| **P3** | API routes (cron jobs) | 8 routes | Medium | Operational reliability |
| **P3** | Admin components | 23 files | High | Internal tooling, lower user impact |
| **P3** | Integration tests in CI | Config | Low | Catches integration regressions |
