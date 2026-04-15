# Auth Migration Brief: NextAuth → Supabase-native

**Status:** v2 — architect-reviewed, ready for PO
**Author:** Architecture spike
**Date:** 2026-04-15
**Last revised:** 2026-04-15 (architect review — added middleware perf analysis, admin impersonation option C, data backfill, observability, B2B comms, PR-stack sequencing)
**Trigger:** Adding OAuth (Google login) surfaced a deeper architectural question
**Target audience:** Product owner (for story/epic creation) + backend lead

---

## 1. Executive Summary

Laglig.se currently runs a hybrid auth stack: **NextAuth owns the session (JWT cookie), and Supabase Auth is used only as a headless password verifier** inside NextAuth's `CredentialsProvider`. Every new auth feature (OAuth, MFA, magic links, SSO) forces us to bridge the two systems — doubling the work and leaving latent architectural debt.

**Recommendation:** Consolidate on Supabase Auth as the single source of truth and remove NextAuth entirely. OAuth (Google) becomes a one-line addition on top of that foundation. The backlog magic-link story (4.15) becomes trivial. RLS becomes usable.

**Effort:** ~18–25 engineering days, contiguous. Ship as a **stacked sequence of 5 PRs** (see §5.3), not a single cutover commit. Test rewrite is the bulk.
**Blast radius:** All logged-in sessions invalidated at cutover (logout-all). A small one-time data backfill is required (see §5.1 #11 and Appendix A.7). User IDs already align between Supabase and Prisma.
**Prerequisite spike:** 1-day middleware performance spike (see §5.1 #12) should precede the main work — informs a load-bearing design decision.

---

## 2. Current State

### 2.1 Split-brain architecture

| Layer | Owner | File |
|-------|-------|------|
| Session cookie (JWT) | **NextAuth** | `app/api/auth/[...nextauth]/route.ts` |
| Password verification | **Supabase Auth** (called from inside NextAuth) | same file, lines 25–37 |
| Edge middleware (route protection) | **NextAuth JWT decode** | `proxy.ts` (uses `getToken` from `next-auth/jwt`) |
| App user store (roles, workspaces) | **Prisma** (`public.users`) | `prisma/schema.prisma` |
| SSR Supabase client | exists but **session is never populated** (cookies are NextAuth's) | `lib/supabase/server.ts` |

### 2.2 Consequences of the split-brain

1. **RLS is effectively forfeited.** No `CREATE POLICY` statements exist anywhere in `supabase/migrations/` or `prisma/migrations/`. Authorization is enforced purely at the application layer via `workspace_id` filters on Prisma queries.
2. **Service-role key is used for user-initiated uploads** (`lib/supabase/storage.ts`), not just admin ops — because the user-scoped Supabase client has no authenticated session. A mis-scoped `workspace_id` in user code would leak data across tenants.
3. **Prisma user creation is lazy and fragile.** A row in `public.users` is only created on first login via NextAuth's `authorize` callback. An invitee who signs up via invite but never logs in has no Prisma record.
4. **Admin impersonation is tightly coupled to `next-auth/jwt`.** `lib/admin/auth.ts:106` and `app/actions/admin-impersonate.ts` encode/decode NextAuth JWTs directly to impersonate users.

### 2.3 What's already Supabase-native (good news)

- **Email verification:** `app/auth/callback/route.ts`, `app/auth/verify/route.ts` — already call `exchangeCodeForSession` / `verifyOtp`.
- **Password reset:** `app/(auth)/reset-password/` — already uses `supabase.auth.resetPasswordForEmail` and `updateUser`.
- **Signup:** `app/actions/auth.ts` — already calls `supabase.auth.signUp`.
- **Admin login:** `app/actions/admin-auth.ts` — already calls Supabase directly, with its own separate `admin_session` JWT cookie. **Independent of NextAuth.**
- **User ID alignment:** Prisma `User.id` is `uuid` and the Supabase `auth.users.id` is already written into Prisma on first login. **No schema change needed for IDs** — but see §5.1 #11: a small one-time backfill is required for Supabase users who never completed a NextAuth login (so have no `public.users` row yet).

---

## 3. Proposed End State

- **Supabase Auth is the sole identity provider.** Sessions are cookie-based via `@supabase/ssr`.
- **Google OAuth** is enabled in the Supabase dashboard and triggered from the client via `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- **Middleware** uses `@supabase/ssr`'s `updateSession` pattern to refresh tokens on every request.
- **Prisma `public.users`** is auto-synced from `auth.users` via a Postgres trigger — every signup path (password, OAuth, magic link) creates the Prisma row uniformly.
- **RLS** becomes available as a safety net (not required in scope, but unblocked as a follow-up).
- **Admin login + impersonation** continue to work. Recommended direction (see §9.1): impersonation is redesigned as a **pure app-layer "sudo"** — an `admin_impersonating_user_id` cookie, honored by `getWorkspaceContext()` when the caller is a verified admin. No Supabase JWT minting, no dependency on any auth provider's internals.

---

## 4. Why Now

- **Immediate trigger:** We want to ship "Sign in with Google."
- **Strategic value:**
  - The magic-link backlog story (`docs/stories/backlog/backend/4.15.magic-link-auth.md`) becomes a side-effect of migration rather than a separate feature.
  - MFA, SSO, account linking are first-class Supabase features going forward — no bridging.
  - User-initiated file uploads can move off the service-role key and onto anon-key + Storage RLS.
  - We stop carrying two user-identity concepts forever.

Alternative — "add Google provider to NextAuth" — is a 2-hour win that locks in the architectural split and guarantees we have this same conversation again for the next auth feature.

### 4.1 Steelmanning "don't migrate"

The compounding-debt argument rests on a premise that should be tested: *we will actually ship more auth features in the next 12 months.* The honest version of the case against migration:

- If the 12-month auth roadmap is realistically only "Google OAuth," then the 2-hour NextAuth Google provider path delivers 90% of user value for 1% of the cost.
- NextAuth is not, in itself, broken. It is boring, battle-tested, and the split-brain is inelegant but not actively harmful today (no production incidents traced to it).
- The RLS benefit is only real *if we commit to writing RLS policies*. Unlocking a capability we never use is not a benefit.
- Test-rewrite scope (18–25 days of engineering) is opportunity cost against other roadmap items.

**Question for PO to answer before scheduling this work:** What auth-adjacent features are committed for the next 12 months? Recommended answer threshold — if Google OAuth is the *only* auth feature on the roadmap, defer this migration and ship the NextAuth Google provider as a tactical fix. If MFA, SSO, magic links, or account linking are committed, this migration pays for itself.

This brief proceeds on the assumption that the answer is "multiple auth features are coming." If that assumption is wrong, the PO should re-scope.

---

## 5. Scope

### 5.1 In scope

| # | Work item | Key files | Complexity |
|---|-----------|-----------|------------|
| 1 | Replace `getServerSession` call sites with Supabase session resolution | 13 files: API routes (7), server components (6), server actions (2 files, 9 calls) — see Appendix A | Medium |
| 2 | Rewrite middleware to use `@supabase/ssr` `updateSession` pattern — see §5.4 for the perf design constraint | `proxy.ts` (full rewrite of JWT cache + `getToken` logic; must preserve Edge compatibility) | **High — perf spike required** |
| 3 | Login form: replace `signIn('credentials')` with `supabase.auth.signInWithPassword`; add "Sign in with Google" button | `app/(auth)/login/_login-form.tsx` | Low |
| 4 | Signout: replace `signOut()` from `next-auth/react` with `supabase.auth.signOut()` | `components/layout/user-menu.tsx`, `components/layout/left-sidebar.tsx`, `components/layout/mobile-sidebar.tsx`, `app/invite/[token]/logout-button.tsx` | Low |
| 5 | Enable Google OAuth in Supabase dashboard + add redirect URIs | Dashboard only | Low |
| 6 | Postgres trigger: `on auth.users insert → upsert public.users` (covers password + OAuth + magic link uniformly) | New migration | Medium |
| 7 | Adapt workspace context resolver to use Supabase session | `lib/auth/workspace-context.ts`, `lib/auth/session.ts` (delete wrapper) | Low |
| 8 | Redesign admin impersonation as **app-layer sudo** (see §9.1 option C): `admin_impersonating_user_id` cookie, honored by `getWorkspaceContext()` when caller is a verified admin. Decouples from all auth-provider JWT internals. | `lib/admin/auth.ts`, `app/actions/admin-impersonate.ts`, `lib/auth/workspace-context.ts` | Medium |
| 9 | Remove `next-auth` dependency, type augmentations, env vars | `package.json`, `types/next-auth.d.ts`, `.env.example`, Vercel env | Low |
| 10 | Test rewrite (see §8) | 9+ test files with NextAuth mocks + shared fixtures + 26 E2E files using login env vars | High |
| 11 | **One-time data backfill**: `INSERT INTO public.users (id, email, name, ...) SELECT ... FROM auth.users WHERE id NOT IN (SELECT id FROM public.users)` — covers any Supabase users who never completed a NextAuth login (e.g. invitees who never logged in) | New migration (idempotent via `ON CONFLICT DO NOTHING`); see Appendix A.7 | Low |
| 12 | **Workspace-state persistence design** (currently implicit in NextAuth session for the workspace-switcher flow). Supabase sessions don't carry arbitrary app state. Options: (a) dedicated `current_workspace_id` cookie, (b) Prisma column on `User`, (c) URL-based routing only | `app/api/workspace/switch/route.ts`, `lib/auth/workspace-context.ts` | Medium — design decision (see §9.7) |
| 13 | **CSRF audit.** NextAuth provides built-in CSRF tokens on its routes; Supabase cookie sessions rely on SameSite cookie attr. Verify every state-changing POST (server actions, API routes) is either SameSite-protected or explicitly token-guarded | Audit-only; fixes where needed | Low |
| 14 | **Middleware perf spike** (prerequisite, see §5.4): measure `supabase.auth.getUser()` latency vs. current local `getToken` JWT verification. Decides whether we accept the round-trip, add a local cache, or use the JWT secret for local verification | Spike branch; 1 day | **Blocker — must run before #2** |

### 5.2 Out of scope (explicit follow-ups)

- **Enabling RLS policies** on application tables. Migration makes RLS *possible*; designing + writing the policies is a separate initiative. **But see §9.8 — the PO should commit this to the backlog as part of accepting this brief, otherwise the migration's defensive value is un-cashed.**
- **Moving user-initiated storage uploads off service-role.** Requires RLS policies on Storage buckets first.
- **Magic-link signup/login** (backlog story 4.15) — becomes trivial post-migration, but is its own UX story.
- **MFA enrollment UI** — Supabase supports it, but UI is separate work.
- **Retiring the custom `email_verified` column** on Prisma `User` in favor of Supabase's `email_confirmed_at` — minor cleanup, not required for cutover.

### 5.3 Implementation as a PR stack

A single PR touching middleware, 13 session-consumer call sites, login/signout UI, admin impersonation, and a DB migration is the wrong shape for review or for safe rollback. Ship as a **stacked sequence of 5 PRs**, each independently revertable:

| PR | Content | Effect if shipped alone |
|----|---------|------------------------|
| **PR 1** | DB trigger (`on auth.users insert`) + one-time backfill SQL | No-op in code. Backfills missing `public.users` rows. Trigger becomes active but is redundant with NextAuth's existing upsert (harmless). |
| **PR 2** | New Supabase session helpers (`lib/auth/supabase-session.ts` or similar) + `auth_provider` column + admin-sudo cookie infrastructure. Does **not** wire anything up yet — pure additions, coexists with NextAuth. | No behavior change. Review overhead of new code without touching the critical path. |
| **PR 3** | Middleware + session resolver swap. Every `getServerSession` call site is updated to Supabase. **This is the cutover PR** — all users logged out at deploy. | Auth provider changes. Customer-visible. Must be scheduled for the maintenance window. |
| **PR 4** | Login form, signout, OAuth button, admin impersonation redesign. | UI catches up to new session layer. |
| **PR 5** | Remove `next-auth` dependency, delete `types/next-auth.d.ts`, remove `NEXTAUTH_*` env vars from Vercel. | Cleanup. Non-functional. |

PRs 1, 2, and 5 are low-risk and can merge on any day. PR 3 is the one that needs the maintenance window. PR 4 can merge same-day as PR 3 or shortly after.

**Why not single-PR:** with one 2000-line PR, a post-deploy incident means reverting *everything* including the trigger. With the stack, we can revert only PR 3 or PR 4 while leaving the schema additions in place.

### 5.4 Middleware performance — load-bearing design decision

Today's middleware (`proxy.ts`) uses `getToken` from `next-auth/jwt` with `NEXTAUTH_SECRET` to verify the JWT **locally** — zero network hops — and adds a 60-second in-memory cache on top. This is fast enough to sit in the Edge hot path on every authenticated request.

The canonical `@supabase/ssr` middleware pattern calls `supabase.auth.getUser()` inside `updateSession`, which Supabase's own docs are explicit about: **`getUser()` contacts the Supabase auth server** — `getSession()` reads the cookie locally but cannot be trusted server-side because cookies are client-controllable. For every authenticated request, the canonical pattern adds one round-trip to the Supabase Auth API.

At our request volume, on Edge, this is a real latency addition (typically 20–80 ms per authenticated request, variable with Supabase region). It may also affect Edge function invocation cost.

**Three options, to be decided by the spike (work item §5.1 #14):**

- **(A) Accept the round-trip.** Simplest; canonical pattern; measured latency may be acceptable if Supabase is colocated with our Vercel region.
- **(B) Local JWT verification using the Supabase JWT secret.** Supabase signs access tokens with an HS256 secret exposed to project owners. Verifying locally (via `jose`) restores zero-round-trip middleware. **Tradeoff:** we lose Supabase's "always-current revocation" guarantee — a revoked token remains valid until its 1-hour expiry unless we add our own revocation list.
- **(C) Short-TTL cache layered on `getUser()`.** Like today's 60s NextAuth cache, but on top of Supabase. Middle ground: bounded staleness, bounded extra latency.

**Recommendation:** Run the spike to measure (A) in production-representative conditions. If p99 middleware latency stays below 100ms, adopt (A). Otherwise (C). Avoid (B) unless (A) and (C) both fail — losing revocation is a non-trivial security trade.

---

## 6. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Middleware perf regression** — canonical Supabase SSR middleware adds a round-trip per request vs. today's local JWT verification | **High** | Prerequisite spike (§5.1 #14) measures the delta; design choice (§5.4) between (A) accept round-trip, (B) local verification, (C) cached `getUser()` |
| All active sessions invalidated at cutover | High | Announce on status page 1 week ahead; in-app banner; CSM outreach to top accounts; cutover in non-business hours CET |
| Test rewrite scope (12–15 days realistic) blocks ship | High | Rewrite in parallel with implementation PRs (PRs 2–4); accept E2E being temporarily thin; budget 12–15 days not 8–10 |
| Admin impersonation depends on `next-auth/jwt` encode/decode | High | Redesigned as app-layer sudo (see §9.1 option C); decouples from all auth-provider internals |
| **B2B customer perception** — forced logout during business hours = support-ticket event for paying compliance officers | **High** | 1-week in-app banner, CSM outreach for top accounts, weekend-night cutover window (Swedish time). See §11.1. |
| **Supabase refresh-token rotation footgun** — lost refresh response = silent logout on flaky mobile networks | Medium | Acknowledged in §9.5; monitor `refresh_token_not_found` rate in Supabase logs post-cutover; consider custom refresh interval |
| Middleware rewrite introduces regressions in route protection | Medium | Test matrix covering every protected path group (`/dashboard`, `/w/*`, `/settings`, `/laglistor`, `/tasks`, `/api/workspace/*`) |
| **One-time data backfill produces orphaned rows if reverted** | Medium | Backfill is additive (`ON CONFLICT DO NOTHING`); reverting code leaves orphan `public.users` rows but they match `auth.users` so they're harmless |
| **CSRF on cookie-based auth** — NextAuth has built-in CSRF; Supabase relies on SameSite | Medium | Audit all state-changing server actions + API routes (§5.1 #13); confirm SameSite=Lax or Strict on session cookie; add explicit CSRF tokens for cross-origin routes if any |
| Supabase dashboard config drift across environments | Medium | Checklist in §10; verify on staging before prod |
| **Workspace-state persistence not covered by Supabase session** | Medium | Design decision (§9.7) — recommend dedicated `current_workspace_id` cookie |
| Feature-flagging dual auth is not feasible | Medium | Stacked PRs provide granular rollback instead (§5.3) |
| Edge Runtime constraints on Supabase SSR middleware | Low | `@supabase/ssr` is designed for Edge; keep middleware dumb (session existence + refresh only); defer role/workspace resolution to server components (as today) |
| Supabase rate limits become active on auth endpoints | Low | Check test harness doesn't hammer `/auth` routes; may need to seed test users once and reuse |
| Rollback after cutover re-invalidates sessions again | Low | Accepted; document in runbook (§12) |

---

## 7. Non-feasibility of Feature-Flagging

Running NextAuth and Supabase sessions side-by-side is technically possible but operationally painful:
- Session is read at middleware, in server components, and in ~20 server actions/API routes.
- Dual-reading would mean every one of those sites branches on a flag.
- The benefit (safer rollout) is small because the failure mode we're most worried about (session invalidation) happens identically in both the flagged and unflagged cutover.

**Recommendation:** Reject runtime feature-flagging. Instead, rely on the **PR stack in §5.3** for granular rollback — PR 3 is the single "cutover" commit, and it can be reverted independently of the schema additions in PRs 1–2.

---

## 8. Test Strategy

### 8.1 Scope

- **9 test files** reference `next-auth` or mock `getServerSession` directly:
  - Unit: `tests/unit/lib/admin/impersonation-helpers.test.ts`, `tests/unit/api/company-lookup.test.ts`, `tests/unit/app/invite/page.test.tsx`, `tests/unit/actions/admin-impersonate.test.ts`
  - Integration: `tests/integration/auth/login.test.ts`, `tests/integration/auth/signup.test.ts`, `tests/integration/auth/user-sync.test.ts`
  - E2E: `tests/e2e/auth.spec.ts`, `tests/e2e/auth/auth-flow.spec.ts` (the latter is currently TODO stubs)
- **Hidden surface:** ~26 other E2E files navigate via `/login` using `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` env vars. Test harness (fixtures, seed helpers, auth state reuse) needs updating to seed via Supabase.
- **Realistic estimate: 12–15 days, not 8–10.** The visible 9 files are the top-of-iceberg; shared fixtures, a typical `authenticatedUser()` test helper, and Playwright `storageState` files all need updating. Budget accordingly.

### 8.2 Approach

1. **Unit tests:** Replace `vi.mock('next-auth')` patterns with `vi.mock('@/lib/supabase/server')` returning a mock Supabase client. Introduce a shared test helper.
2. **Integration tests:** Most already target Supabase directly (`user-sync.test.ts` is a good template). Delete NextAuth-specific assertions.
3. **E2E tests:** UI-driven already — just seed a Supabase test user in the harness instead of relying on NextAuth.
4. **Regression matrix — manual smoke before ship:**
   - Email+password signup → email verify → login → workspace context loads
   - Google OAuth signup → callback → Prisma user created via trigger → workspace context loads
   - Existing user logs in with password post-migration
   - Password reset request → email → confirm → login
   - Invite acceptance (logged-out → signup), (logged-out → login), (logged-in → accept)
   - Admin login
   - Admin impersonation: impersonate user → act as user → exit impersonation
   - Middleware: every protected route group

---

## 9. Open Design Questions (for PO + tech lead)

These decisions should be locked before story implementation begins.

1. **Admin impersonation — how to redesign?**
   Today, impersonation signs a fake NextAuth JWT for the target user, and the existing session resolver just reads whatever JWT is in the cookie. That trick doesn't cleanly port to Supabase — Supabase's admin API has no "issue-session-as-user" primitive that matches the semantics, and anything that mints a Supabase session for a user we aren't actually logged in as fights the auth provider. Three options:
   - **(a) Mint a "real enough" Supabase session.** Use `supabase.auth.admin.generateLink()` and programmatically consume it. Brittle — depends on undocumented internals and is exactly the kind of thing that breaks on Supabase upgrades.
   - **(b) Drop impersonation.** Rely on support screen-share. Feasible only if the feature is lightly used.
   - **(c) App-layer sudo — RECOMMENDED.** Admin logs in normally as themselves (real Supabase session). A separate `admin_impersonating_user_id` cookie is set on impersonation start. `getWorkspaceContext()` checks: if caller is a verified admin *and* the cookie is present, return context scoped to the impersonated user instead of the admin. Exit impersonation = clear cookie. This decouples impersonation from *any* auth provider's JWT internals — if we ever move off Supabase, impersonation still works.
   - **Recommendation: (c).** Smaller blast radius, zero auth-provider coupling, trivially testable (no JWT mocking needed), survives any future auth migration. Security footing is identical to today (still gated on verified admin), and the audit trail is arguably cleaner because the real user performing the action is always the admin — the impersonation context is just an overlay.

2. **Prisma user sync — DB trigger or server action?**
   - Trigger on `auth.users insert` is canonical Supabase pattern; guarantees no signup path skips it.
   - Server-action approach is easier to unit-test but requires wiring in every entrypoint (OAuth callback, magic-link callback, invite accept).
   - **Recommendation:** DB trigger. Server action is fallback only.

3. **`email_verified` column on Prisma `User` — keep or drop?**
   - Duplicates Supabase `auth.users.email_confirmed_at`.
   - Keeping avoids cross-schema reads in hot paths.
   - **Recommendation:** Keep for now; sync via the same trigger. Revisit post-migration.

4. **`auth_provider` tracking on Prisma `User` — needed?**
   - Useful for analytics ("X% of users use Google"), for disabling password reset for OAuth users, and for account-linking.
   - **Recommendation:** Add an optional `auth_provider` String field. Low cost.

5. **Session duration + refresh-token policy — bigger than it looks.**
   - NextAuth is configured for 30-day JWT with no refresh (static token).
   - Supabase defaults: 1-hour access token + 1-week sliding-window refresh token with **rotation** (every refresh issues a new refresh token and invalidates the old one).
   - **Known footgun:** refresh-token rotation has a well-documented failure mode — if the refresh response is lost (flaky network, browser backgrounded mid-flight, Service Worker cache race), the client retains a rotated-away refresh token. All subsequent refresh attempts fail, the user is silently logged out. This will matter for Swedish train-commuter users on intermittent connectivity and for iOS/Safari users where backgrounded tabs can freeze mid-request.
   - **Options:**
     - (a) Accept Supabase defaults; monitor `refresh_token_not_found` errors in Supabase logs, accept occasional silent logouts as a cost.
     - (b) Extend refresh TTL to 30 days to match today's behavior.
     - (c) Disable refresh-token rotation in Supabase Auth settings (reduces security margin; refresh tokens become bearer tokens for their lifetime).
   - **Recommendation:** (a) for the migration. Add monitoring (§11.5). Revisit if silent-logout complaints exceed ~0.5% of active users in the first two weeks.

6. **Cutover strategy — maintenance window or hot deploy?**
   - Active sessions will be invalidated either way. A maintenance window lets us communicate it.
   - **Recommendation:** Weekend night, Swedish time. Status page notice 1 week ahead. In-app banner for logged-in users starting 1 week before. CSM outreach to top-N accounts. See §11.1.

7. **Workspace-state persistence — where does `current_workspace_id` live?**
   - Today, NextAuth's session + the workspace-switch route appear to carry this. Supabase sessions do *not* carry arbitrary app state.
   - Options:
     - (a) **Dedicated cookie** (`laglig-current-workspace`, HttpOnly, scoped to path) — simplest, isomorphic with the session.
     - (b) **Prisma column** on `User` (e.g. `current_workspace_id`) — survives across devices but introduces a write on every switch.
     - (c) **URL-scoped only** — no persistence; if the user lands on `/dashboard` without a workspace segment, redirect to the first workspace they're a member of.
   - **Recommendation:** (a). Matches existing mental model, no DB write on switch, survives page refresh. Only read server-side in `getWorkspaceContext()`.

8. **RLS follow-up — commit or explicitly defer?**
   - The migration *unlocks* RLS but doesn't *deliver* it. If we ship this and never write RLS policies, we've paid the migration cost without cashing the defense-in-depth benefit. Worse: having a real Supabase session in the browser means frontend code *could* bypass our server layer and hit Supabase directly — making RLS effectively mandatory for safety once any client-side data fetch is added.
   - **Two paths forward:**
     - (a) **Commit to an RLS follow-up epic** scheduled within 6 months of migration merge. Explicit backlog item, explicit owner.
     - (b) **Explicitly accept the "server-layer gatekeeper" model.** Document that the client will *never* fetch directly from Supabase (no `createBrowserClient` data fetches); all data access goes through our server layer, which applies workspace filtering. Restrict the browser Supabase client to auth operations only.
   - **Recommendation: (b) for the migration window, (a) as the strategic direction.** Path (b) is achievable in-PR (add a lint rule / architecture guardrail). Path (a) is the mature state.
   - **This is the decision most worth pushing the PO on.** Without one of these committed, the brief's strategic value claim is softer than it reads.

---

## 10. Supabase Dashboard Checklist (manual, cannot be code-reviewed)

Before shipping:
- [ ] Enable Google OAuth provider (Authentication → Providers → Google)
- [ ] Add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Supabase config
- [ ] Add authorized redirect URIs: `http://localhost:3000/auth/callback`, `https://laglig.se/auth/callback`, any preview URLs
- [ ] Verify email template branding is still applied
- [ ] Confirm session/refresh token policy matches team decision from §9.5
- [ ] Run the `on auth.users insert` trigger via migration; verify it fires on a dashboard-created test user
- [ ] Delete test users after smoke tests

---

## 11. Rollout Plan

### 11.0 Prerequisites (before any implementation PR)
- [ ] Middleware performance spike (§5.1 #14) complete; design choice in §5.4 locked
- [ ] §9 decisions locked by PO + tech lead, especially §9.1 (admin impersonation), §9.7 (workspace state), §9.8 (RLS stance)
- [ ] Google OAuth enabled in **staging** Supabase project; redirect URIs verified

### 11.1 Customer communication (B2B — this is a paying-customer touch)

Laglig's users are compliance officers at paying companies, not consumers. A forced logout-during-business-hours is a "your vendor broke something" event with support-ticket blast radius.

- **T–7 days:** In-app banner for logged-in users ("Scheduled maintenance Saturday DD/MM, ~20 min. You will be asked to log in again.")
- **T–7 days:** Status page notice
- **T–5 days:** CSM email to top-20 accounts (plain-language, what + why + when)
- **T–0:** Weekend night Swedish time (Saturday 22:00–02:00 CET is the quietest window per Laglig's typical usage profile — PO to confirm)
- **T+0 to T+1h:** Engineering on watch; support team briefed on likely ticket: "I was logged out — is something wrong?"
- **T+24h:** Follow-up status page confirmation

### 11.2 Execution sequence (per §5.3 PR stack)

1. **PR 1 merges (any day):** DB trigger + backfill. No user-visible effect.
2. **PR 2 merges (any day):** Supabase session helpers + admin-sudo infrastructure. Pure additions.
3. **Staging validation:** Full §8.2 regression matrix against staging. Dogfood with team accounts for 48h. This includes running E2E suite against a staging environment where PR 3 is deployed.
4. **PR 3 merges + deploys (maintenance window):** Middleware + session-resolver cutover. All active sessions invalidated.
5. **PR 4 merges (same day or +1):** Login UI + OAuth button + admin impersonation redesign live.
6. **PR 5 merges (T+7 to T+14):** Remove `next-auth` package, delete type files, remove `NEXTAUTH_*` env vars from Vercel. Only after we're confident no rollback is needed.

### 11.3 Observability + alerts during rollout

For **72 hours** post-cutover, engineering maintains heightened monitoring:

| Metric | Source | Threshold for concern |
|--------|--------|----------------------|
| 401/403 response rate on protected routes | Vercel / Sentry | > 2× baseline |
| Middleware p99 latency | Vercel edge logs | > 150ms (adjust based on spike result) |
| Supabase Auth error rate (login/refresh) | Supabase dashboard → Auth → Logs | > 1% of attempts |
| `refresh_token_not_found` errors | Supabase Auth logs | Any sustained pattern = investigate |
| Failed login attempts rate | Supabase Auth logs | Spike = possible user confusion or harness misconfig |
| `public.users` row count vs `auth.users` row count | DB query (schedule every 10 min) | Must match ± 1 after trigger is deployed |
| Support ticket volume with keyword "login"/"logged out" | Support tool | > 2× baseline |
| Sentry errors matching `next-auth` / `getServerSession` | Sentry | Any = we missed a call site |

**Rollback triggers** (any of these = revert PR 3):
- Middleware p99 latency sustained > 500ms for 10 min
- Auth error rate > 5% of attempts for 15 min
- Any critical-severity Sentry error with > 100 occurrences in 1 hour

**Rollback does NOT require:**
- Transient spikes during the first 10 minutes (cache warming expected)
- Individual support tickets (expected; users re-log in)

---

## 12. Rollback Plan

- **Within minutes of PR 3 deploy:** `git revert` PR 3 (and PR 4 if merged), redeploy, re-add `NEXTAUTH_SECRET` / `NEXTAUTH_URL` to Vercel envs. All users re-login again with NextAuth.
- **PR 1 (DB trigger + backfill):** Idempotent and additive. Leave in place even on code rollback — the trigger just writes Prisma rows that NextAuth's authorize callback would write anyway on next login. The backfill produces `public.users` rows matching `auth.users` rows, which is correct state regardless of which auth layer is active.
- **PR 2 (new helpers):** Pure additions, no-op on rollback; leave in place.
- **PR 5 (NextAuth removal):** **Do not merge until rollback window closes** (T+7 to T+14). This is the one non-revertable step — we can't un-uninstall gracefully.
- **No destructive DB ops** anywhere in the stack, so rollback remains code-only.

---

## 13. Suggested Acceptance Criteria (hints for PO)

Not a story spec — raw material for the PO to shape.

**Must-have:**
1. Users can sign up + log in with email+password (no regression vs. today)
2. Users can sign in with Google; first-time Google sign-in creates both `auth.users` and `public.users` rows
3. Existing users (created pre-migration) can log in post-migration with their existing password
4. All protected routes (`/dashboard`, `/w/*`, `/settings`, `/laglistor`, `/tasks`, `/api/workspace/*`) redirect unauthenticated users to `/login?callbackUrl=...`
5. Workspace context (`workspaceId`, `role`, `hasPermission`) resolves correctly from Supabase session
6. Admin login continues to work; admin impersonation continues to work (per §9.1 decision)
7. Invite acceptance works for: logged-out-new-user, logged-out-existing-user, logged-in-matching-email, logged-in-mismatched-email
8. `on auth.users insert` trigger creates Prisma user row with correct `id`, `email`, `name` (from metadata) for every signup path
9. Password reset flow continues to work
10. Email verification flow continues to work
11. Logout clears Supabase session and redirects to `/`
12. `next-auth` package removed from `package.json`; `NEXTAUTH_*` env vars removed from Vercel

**Nice-to-have (can be follow-up):**
13. `auth_provider` column on Prisma `User` populated by trigger
14. Session refresh works transparently across 7+ day user session

---

## 14. Effort Estimate

| Workstream | Maps to | Estimate |
|------------|---------|----------|
| Middleware perf spike (prerequisite) | §5.1 #14 | 1 day |
| DB trigger + one-time backfill + `auth_provider` column (PR 1) | §5.1 #6, #11 | 1 day |
| New Supabase session helpers + admin-sudo cookie infra (PR 2) | §5.1 #7, #8 (infra) | 2 days |
| Middleware rewrite + session resolver migration (PR 3) | §5.1 #1, #2 | 3–4 days |
| Login/signout UI + Google OAuth button (PR 4, UI) | §5.1 #3, #4 | 1 day |
| Admin impersonation redesign — app-layer sudo (PR 4) | §5.1 #8 (wire-up) | 2 days |
| Workspace-state persistence + workspace context refactor | §5.1 #12, #7 | 1 day |
| CSRF audit + fixes | §5.1 #13 | 1 day |
| Test rewrite (9 files + shared fixtures + E2E harness) | §5.1 #10 | 12–15 days |
| Staging validation + regression matrix | §8.2 | 2 days |
| NextAuth removal (PR 5) | §5.1 #9 | 0.5 day |
| **Total** | | **~26–30 engineering days** |

One engineer, contiguous work. **Compresses to ~18–22 days with pairing** on middleware (spike + rewrite) and admin impersonation, plus parallelizing test rewrite with implementation PRs.

**Not included** in the estimate:
- RLS policy authoring (explicitly out of scope; see §5.2 and §9.8)
- Customer communication / CSM coordination (PO + Customer Success own this)
- Supabase dashboard configuration (0.5 day, Supabase admin or DevOps task)

---

## Appendix A: File Inventory

### A.1 Files with `getServerSession` calls (to replace with Supabase session resolution)

**API routes:**
- `app/api/auth/me/route.ts:7`
- `app/api/workspace/switch/route.ts:13`
- `app/api/workspace/generation-status/route.ts:18,112`
- `app/api/workspace/generate-law-list/route.ts:20`
- `app/api/company/lookup/route.ts:35`
- `app/api/company/analyze/route.ts:17`
- `app/api/chat/route.ts:58`

**Server components:**
- `app/(workspace)/layout.tsx:47`
- `app/select-workspace/layout.tsx:18`
- `app/onboarding/layout.tsx:19`, `app/onboarding/page.tsx:20`
- `app/(workspace)/dashboard/page.tsx:29`
- `app/invite/[token]/page.tsx:39`

**Server actions:**
- `app/actions/workspace.ts:63,361,394,445,490,568`
- `app/actions/invitations.ts:40,130,308`

**Wrapper (to delete):**
- `lib/auth/session.ts` (10-line NextAuth wrapper)

### A.2 Files with client-side NextAuth imports

- `app/(auth)/login/_login-form.tsx:5,78` — `signIn('credentials')`
- `components/layout/user-menu.tsx:3,92` — `signOut`
- `components/layout/left-sidebar.tsx:6` — `signOut`
- `components/layout/mobile-sidebar.tsx:6` — `signOut`
- `app/invite/[token]/logout-button.tsx:12,24` — `signOut`

### A.3 NextAuth JWT internals usage (admin impersonation)

- `lib/admin/auth.ts:3,106,108` — `decode` + `NEXTAUTH_SECRET`
- `app/actions/admin-impersonate.ts:4` — `encode, decode`
- `proxy.ts:3,180,182` — `getToken` + `NEXTAUTH_SECRET` (middleware)

### A.4 Type definitions (to delete)

- `types/next-auth.d.ts` — module augmentation for `session.user.id`

### A.5 Tests referencing NextAuth (to rewrite)

- `tests/unit/actions/admin-impersonate.test.ts`
- `tests/unit/lib/admin/impersonation-helpers.test.ts`
- `tests/unit/api/company-lookup.test.ts`
- `tests/unit/app/invite/page.test.tsx`
- `tests/integration/auth/login.test.ts`
- `tests/integration/auth/signup.test.ts`
- `tests/integration/auth/user-sync.test.ts`
- `tests/e2e/auth.spec.ts`
- `tests/e2e/auth/auth-flow.spec.ts`

### A.6 Environment variables

**To remove:** `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
**To add (for OAuth):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (in Supabase dashboard, not Vercel)
**Unchanged:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### A.7 One-time backfill SQL (PR 1)

Runs as part of PR 1's migration, **before** the trigger is created. Covers any `auth.users` rows without a corresponding `public.users` row — the "invitee who never logged in" case and anything else lazy-upsert might have missed.

```sql
-- Idempotent backfill: only inserts rows that don't already exist.
-- Safe to run multiple times.
INSERT INTO public.users (id, email, name, email_verified, created_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', NULL) AS name,
  (au.email_confirmed_at IS NOT NULL) AS email_verified,
  au.created_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
);

-- Verification query — run after, expect 0 rows:
SELECT au.id, au.email
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;
```

After the backfill, PR 1 adds the `on auth.users insert` trigger so every future signup (any path) creates the row automatically.

### A.8 Trigger definition (PR 1, informative)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, email_verified, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NULL),
    (NEW.email_confirmed_at IS NOT NULL),
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
```

Exact column list to be reconciled against `prisma/schema.prisma` `User` model at implementation time (e.g. if `auth_provider` column is added per §9.4, trigger writes it too).

---

## Appendix B: Related backlog items that become simpler post-migration

- `docs/stories/backlog/backend/4.15.magic-link-auth.md` — becomes a UI-only story; backend is already Supabase-native after migration.
- Any future MFA / SSO / account-linking work — all first-class Supabase features, no bridging.
- Moving user-initiated uploads off `SUPABASE_SERVICE_ROLE_KEY` — prerequisite is RLS policies on Storage buckets, which requires authenticated Supabase sessions in the browser (unlocked by this migration).
