# Plan: Go-live Prep — Wed 2026-05-06 → Thu 2026-05-07

**Target ship date:** Thursday 2026-05-07 (production)
**Today:** Tuesday 2026-05-05
**Working window:** ~1.5 days

---

## TL;DR

1. **Wed AM:** Redraft + ship **Story 4.10** (trial expiration + export gating) — adapted to the actual 5.12 schema.
2. **Wed PM:** Ship **law-list import component** (Excel → law-list-item, fuzzy + LLM match). Notisum-switcher unblock.
3. **Wed late PM:** **Onboarding entry-modal Phase 1** + **bottom-right launcher** (doubles as feedback widget mount).
4. **Thu AM:** Polish — legal pages, Supabase custom SMTP, prod Supabase branch, domain wiring.
5. **Thu midday:** Full E2E pass across the stack (signup → tier-pick → trial → expiration → upgrade → import → onboarding modal). Then deploy as **public beta** (soft launch — early-access framing, no PR push).

Stripe is the gate — once 4.10 lands and exports are gated, the billing loop is closed and we can launch.

**Beta framing baked in:** "Early access — help us shape Laglig" copy on landing CTA + small "Beta" badge in workspace shell. Lowers polish-bar perception AND conversion-target pressure. Real signal > imagined signal.

---

## 1 — Story 4.10 redraft + ship (Wed AM, ~4h)

The current 4.10 draft is **stale** (camelCase schema sketch from before Stories 5.4/5.5/5.12). Redraft first, implement second.

### Schema reality (verified 2026-05-05)

`Workspace` already has from prior stories:
- `subscription_tier` enum (`TRIAL | SOLO | TEAM | ENTERPRISE`) — Story 5.4
- `trial_picked_tier` (`SOLO | TEAM` nullable) — Story 5.12 migration `20260505101233_add_trial_picked_tier`
- `enterprise_inquiry_at` timestamp — Story 5.12
- Stripe linkage fields — Story 5.4 migration `20260504120000_add_stripe_billing_fields`

**4.10 adds:**
- `trial_ends_at DateTime?` — set to `created_at + 14 days` on workspace create
- `status` enum (`ACTIVE | PAUSED | DELETED`) — default `ACTIVE`
- `paused_at DateTime?`
- `deleted_at DateTime?` (already may exist — verify)

Snake_case throughout. No camelCase.

### Cron + middleware

- Daily cron at 00:00 UTC: `SELECT id FROM workspaces WHERE status = 'ACTIVE' AND subscription_tier = 'TRIAL' AND trial_ends_at < NOW()` → batch-update to `status = 'PAUSED', paused_at = NOW()`. Reuse existing cron infrastructure (see `app/api/cron/sync-sfs-updates/route.ts` shape).
- Middleware on `/laglistor`, `/uppgifter`, `/krav`, `/anmarkningar` (post-23.3), all workspace routes: if `workspace.status === 'PAUSED'` → redirect to `/settings/billing?expired=1`.
- **Exception:** `/settings/billing` itself stays accessible so they can upgrade.
- **Exception:** `/onboarding` — if a paused user re-enters, send them to billing instead.

### Banner + upgrade page

- Paused workspace: full-page block (not a banner) — copy: *"Provperioden har gått ut. Uppgradera för att fortsätta använda Laglig."* + `BillingDashboard` Checkout buttons inline.
- Day-13 reminder email (NEW — adds to original 4.10 scope): *"Din provperiod går ut imorgon"* with one-click upgrade link. Day-14 expiration email follows the original spec.

### Enterprise-inquiry awareness (NEW — 5.12 coordination)

If `enterprise_inquiry_at IS NOT NULL` AND `subscription_tier === 'TRIAL'` AND `trial_ends_at < NOW()`:
- Don't auto-pause. Sales is in the loop.
- Instead, set `status` to a new `ENTERPRISE_PENDING` value (or reuse `ACTIVE` with a flag) — workspace stays usable but a banner appears: *"Vi pratar med dig om Enterprise. Provperioden är förlängd tills vi är överens."*
- Sales rep manually flips to `ENTERPRISE` once contract signs (per 5.12 AC 10). Until then: continued Team-tier limits.
- **Decision punt:** if this gets complex, fall back to `extend trial 7 days for enterprise_inquiry workspaces, no special status` and revisit later. The simpler path is good enough for Thursday.

### Export gating during trial (NEW — user requirement)

**Concrete endpoints to gate** (verified by grep 2026-05-05):
1. `app/(workspace)/laglistor/kontroller/[cycleId]/rapport/pdf/route.ts` — revisionsrapport PDF
2. `app/api/workspace/activity-log/export/route.ts` — activity-log CSV
3. Any task-list / law-list CSV exports in `app/actions/tasks.ts`, `app/actions/document-list.ts` (verify on touch)
4. Compliance-audit-report exports

**Pattern:** new helper `lib/billing/assertExportAllowed(workspace)` that returns 403 with copy *"Export är tillgängligt på betald plan. Uppgradera för att exportera."* when `subscription_tier === 'TRIAL'`. Wired at every export route handler. Three lines per call site.

**Why now:** prevents "sign up, export everything, churn" abuse — strong conversion lever, especially for Notisum-switcher segment who can `*just*` export their list to satisfy compliance without paying.

**Scope cut:** PDF previews + screen-reading remain free. Only file downloads (PDF, CSV, XLSX) hit the gate. Read access is the trial value.

### Tasks

- [ ] Redraft 4.10 with verified schema + Enterprise-inquiry handling + export-gate AC (~30min)
- [ ] Schema migration (4 columns + status enum) + backfill `trial_ends_at = created_at + 14 days` for existing TRIAL workspaces (~30min)
- [ ] Cron handler + middleware (~1h)
- [ ] Paused-workspace upgrade page (~45min)
- [ ] Day-13 reminder + Day-14 expiration emails via Resend (~45min)
- [ ] `assertExportAllowed` helper + wire at 4 export endpoints (~30min)
- [ ] Tests: cron expiration logic, middleware redirect, export-gate 403, Enterprise-inquiry skip path (~45min)

---

## 2 — Law-list import component (Wed PM, ~4h)

Brief already exists at `docs/import-law-list-brief.md` (v1, 2026-04-22). Memory at `project_onboarding_import_list.md`.

**Pragmatic MVP cut for Thursday** (full feature is multi-story; here we ship the minimum that demonstrably handles a Notisum Excel):

### Surface 1 — In-app create-list "Importera Excel" branch

- New tab inside the existing create-list modal: *Generera | **Importera***. The Importera tab:
  1. **File upload** — accepts `.xlsx` / `.csv`. Parses via `xlsx` library (already in `node_modules` if used elsewhere — verify; otherwise install).
  2. **Column-mapping UI** — auto-detect SFS-nummer column (regex `/\d{4}:\d+/`) + title column. User confirms / overrides via dropdown per column. Required: at least one of (SFS-number, Title). Optional: rättsområde, kommentar, status.
  3. **Match phase** — for each row, run `findLegalDocumentBySfsOrTitle()`:
     - Step A: if SFS-number present → exact match in `LegalDocument` table.
     - Step B: if title only or no SFS hit → fuzzy match (Levenshtein on normalised title) with score threshold.
     - Step C: if Step A/B both fail → mark as "Behöver manuell ingest" (queue for the 24h SLA, log to a new `LawListImportRequest` table or just to Slack/email for MVP).
  4. **Preview + commit** — show user a 3-section table: ✅ matched (auto-add), ⚠️ uncertain (user picks from candidates), ❌ unmatched (queued). User clicks "Skapa laglista".
  5. Bulk-create `LawListItem` rows via existing server action.

### Surface 2 — Onboarding wizard branch (cut for Thursday if time-pressed)

- Add a step before company-info: *"Har du en befintlig laglista?"* → Yes routes to import flow before `ConfirmStep`; No routes to current generation flow.
- **If running short on Wednesday:** ship Surface 1 only, defer Surface 2 to a follow-up. Surface 1 unblocks the Notisum-switcher value prop alone.

### Tasks

- [ ] Verify / install `xlsx` parser (~10min)
- [ ] `LawListImportPanel` component with upload + column mapping UI (~1h)
- [ ] `parseLawListUpload(file)` server action (~30min)
- [ ] `matchLegalDocuments(rows)` server action with SFS exact + title fuzzy (~1h)
- [ ] Preview table component + commit action (~45min)
- [ ] Manual-ingest queue → simple Resend email to `imports@laglig.se` for MVP (no DB table) (~15min)
- [ ] Smoke test with a real Notisum export Excel (user provides) (~30min)

**Cut if needed:** LLM-based fuzzy matching (Step B can be Levenshtein-only for v1; LLM is the polish layer).

---

## 2.5 — Onboarding entry-modal Phase 1 + bottom-right launcher (Wed late PM, ~1.5h)

Decouple workspace-creation from auto-generate. Today the wizard finishes and immediately starts law-list generation; users have zero "look around first" time and the import path is invisible. Phase 1 surfaces a two-tile chooser on `/hem`; Phase 2 adds tutorial + feedback step (post-beta).

### Behaviour

1. **`createWorkspace` server action** stops auto-triggering law-list generation. After commit it redirects to `/hem` with no laglista yet (today's behaviour preserved when import flow exists in parallel — the modal becomes the first decision point).
2. **`/hem` detects "no laglista yet" state** (`workspace.law_lists.length === 0`) → mounts `<OnboardingEntryModal>` open by default.
3. **Modal step 1 — two tiles:**
   - **"Generera laglista"** — routes to existing generation flow (current `OnboardingWizard` post-confirm path, but invoked from /hem instead of auto-triggered).
   - **"Importera befintlig"** — routes to the import flow shipped in §2 (in-app create-list modal, Importera tab pre-selected).
   - Subtitle copy: *"Vi anpassar laglistan efter er verksamhet — du kan välja att generera en helt ny eller importera en befintlig från Excel."*
4. **Dismissable** — close button on the modal sets `localStorage` key `laglig:onboarding-modal-dismissed:${workspaceId}` so it doesn't re-mount on the next /hem visit. Re-open via the launcher (next bullet).
5. **Bottom-right launcher button** — fixed-position circle button (lower-right of viewport, mounted in workspace shell), icon: `Sparkles` or `HelpCircle`. Clicking opens the modal. **Same button doubles as feedback launcher in Phase 2** — one affordance, two purposes (feature tour + "Vad saknas?").
6. **Workspace-shell placement:** mount `<OnboardingLauncher>` in `app/(workspace)/layout.tsx` so it's visible across all workspace routes, not just /hem.

### Phase 2 (post-beta, deferred)

- Multi-step tutorial inside the modal (features tour, AI chat how-to, kontroller intro, anmärkningar registry once 23.x ships).
- Beta-specific feedback step ("Vad saknas?" textarea → `feedback@laglig.se` or Slack webhook).
- Step-progress tracker ("3 av 5 steg klart").
- Smarter dismissal logic (dismiss-with-completion vs dismiss-temporarily).
- Reset trigger so existing workspaces can opt back into the tour.

### Tasks (Phase 1)

- [ ] Strip auto-generate from `createWorkspace` server action; redirect to `/hem` post-commit (~15min)
- [ ] `<OnboardingEntryModal>` component (two tiles, dismissable, localStorage-scoped) (~30min)
- [ ] `<OnboardingLauncher>` button mounted in workspace layout (~20min)
- [ ] `/hem` detects no-laglista state and auto-opens modal first time (~10min)
- [ ] Wire "Generera" tile → existing generation flow trigger (~15min)
- [ ] Wire "Importera" tile → in-app create-list modal with Importera tab pre-selected (~10min)
- [ ] Smoke: brand new signup → land on /hem → modal opens → both routes work → dismiss + re-open via launcher (~15min)

**Cut if Wed runs long:** ship the modal + tile chooser without the launcher button (just the auto-open on first /hem visit). The launcher is the Phase 2 hook anyway; Phase 1 can land without it.

---

## 3 — Polish + DevOps (Thu AM, ~4h)

### Legal pages (~1.5h)

- `/integritetspolicy` (privacy policy)
- `/anvandarvillkor` (terms of service — note: `docs/legal/anvandarvillkor.md` exists, just needs surface)
- `/cookies` (cookie policy)
- `/databehandlingsavtal` (DPA — required for B2B GDPR, even if just a "Contact us" stub)
- Footer link block on landing + workspace shell

Use the existing `anvandarvillkor.md` content as the DPA / ToS basis. Privacy policy: copy a generic Swedish-startup template (Mannheimer Swartling has a free one) — adjust for Laglig specifics (Resend, Supabase, Stripe, Anthropic data processors). **Not legally reviewed for Thursday — flag in the doc as "v1, draft, formal review pending".**

### Supabase custom SMTP (~30min)

Story `OPS-supabase-auth-custom-smtp.md` already specs this. Quick steps:
1. Supabase Dashboard → Auth → SMTP → enable custom
2. Host `smtp.resend.com`, port 465, username `resend`, password = `RESEND_API_KEY`
3. From `noreply@laglig.se` (verify domain in Resend first)
4. Smoke-test: invite `+launchsmoke@kontorab.se` user, confirm email arrives via Resend

### Production Supabase branch (~1h)

We have dev / preview today. Need to mirror for prod. In Supabase Dashboard:
1. Create new project (or branch — verify which feature your plan tier supports). Production will own its own DB instance.
2. Apply all migrations: `pnpm prisma migrate deploy --schema=prisma/schema.prisma` against the new `DATABASE_URL`.
3. Seed admin user. Verify RLS policies applied (existing migration `20260430120000_enable_rls_public_tables`).
4. Update `.env.production` in Vercel: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
5. **Stripe test → live:** flip `STRIPE_SECRET_KEY` and `STRIPE_*_PRICE_ID` env vars to live-mode values. Verify webhook URL on Stripe Dashboard points at `https://laglig.se/api/webhooks/stripe`.

### Domain + DNS (~30min)

1. Point `laglig.se` apex + `www` to Vercel (A / CNAME).
2. Add to Vercel project domains.
3. Verify SSL provisions automatically.
4. Smoke-test: hit `https://laglig.se` → landing page renders, signup loads.

### Cron secrets (~15min)

`CRON_SECRET` env var set in production for the trial-expiration cron (and existing SFS sync crons). Vercel Cron Jobs configured per `vercel.json`.

---

## 4 — E2E test + go-live (Thu midday, ~3h)

Full happy-path smoke against production (or a staging mirror with prod Stripe in test mode):

### Test matrix

| Flow | Steps |
|---|---|
| Signup → tier pick → trial start | New user signs up with `?plan=team` query → tier-picker pre-selects Team → ConfirmStep → workspace created with `trial_picked_tier='TEAM'`, `trial_ends_at = now + 14d` |
| Seat enforcement during trial | Owner invites 3 users (Team allows 3) → 4th invite blocked with `SEAT_LIMIT_REACHED` |
| Export blocked during trial | Try to download cycle PDF → 403 with upgrade copy |
| Stripe upgrade | Open `/settings/billing` → click Upgrade → Checkout → return → `subscription_tier` flips to `TEAM` |
| Export allowed post-upgrade | Same PDF download succeeds |
| Trial expiration (manual) | Manually set `trial_ends_at` to past, run cron handler → workspace `status='PAUSED'` → user hits any route → redirect to billing |
| Enterprise inquiry path | Sign up with `?plan=enterprise` → workspace has `enterprise_inquiry_at` set → sales email arrives → trial doesn't auto-pause at day 14 |
| Onboarding entry-modal | New signup → land on /hem → modal opens with two tiles → click "Importera" → Importera tab pre-selected → dismiss → modal stays closed on refresh → click bottom-right launcher → modal re-opens |
| Excel import | Upload Notisum Excel → mapping UI → preview shows matched/uncertain/unmatched → commit → laglista exists |
| Onboarding email delivery | New signup → confirmation email arrives via Resend (custom SMTP working) |
| Auth | Magic-link, password-reset, email-change all deliver via Resend |
| Cron jobs | Trigger trial-expiration cron manually via `curl /api/cron/expire-trials` with bearer → expected workspaces flip |

If any test fails, fix before flipping DNS to point at production app.

### Go-live cutover

1. All E2E green ✅
2. Update marketing landing CTA to point at the live domain
3. Announce internally (founders + early-access list)
4. Monitor Sentry + Vercel logs for first 4h post-cutover

---

## Risks + cuts

**If Wednesday slips:**
- Cut Surface 2 of import (onboarding-wizard branch) → ship in-app modal only.
- Cut LLM fuzzy match → Levenshtein only.
- Cut day-13 reminder email → ship day-14 only.
- Cut onboarding launcher button → ship just the auto-open modal (re-trigger lives behind a settings link instead).
- Last resort: ship onboarding modal as Phase 0 (just remove the auto-generate, no chooser modal) — workspace lands on empty /hem with a "Skapa din första laglista" CTA. Worse UX, ~10min ship.

**If Thursday morning slips:**
- Cut DPA + cookie policy → ship privacy + terms only, add the others post-launch.
- Cut Surface 2 import entirely.
- Defer Enterprise-inquiry-aware expiration → simple "TRIAL → PAUSED at 14d" for everyone, sales-rep manually un-pauses.

**Hard blockers (do NOT skip):**
- Trial expiration cron working
- Export gating
- Stripe live mode + webhook
- Supabase custom SMTP (otherwise signup confirmation 429s kill onboarding)
- Production Supabase branch with migrations applied

**External risks:**
- Stripe live-mode webhook signing secret — different from test. Verify in dashboard.
- Resend domain verification (DKIM/SPF) for `laglig.se` — confirm before flipping SMTP. If not propagated, Auth emails bounce silently.
- Vercel build cold-cache — first prod deploy may take 10-15 min. Don't cut it close to noon Thursday.

---

## Definition of "ready to launch"

- [ ] 4.10 cron expires a test trial workspace
- [ ] 4.10 export gate returns 403 for trial workspaces
- [ ] Stripe Checkout in live mode flips tier successfully
- [ ] Excel import handles a real Notisum export (≥80% match rate on row 1)
- [ ] Resend delivers signup confirmation via custom SMTP
- [ ] Production Supabase reachable, RLS active, all migrations applied
- [ ] `https://laglig.se` resolves, SSL valid, signup form works
- [ ] Privacy + terms pages live (others can be stubs)
- [ ] One end-to-end signup-to-paid completed in production by a real human
- [ ] New signup lands on /hem and sees the onboarding entry-modal with both options visible
- [ ] "Beta" badge visible in workspace shell; landing CTA copy reads "Early access" / "Beta"

---

## Post-launch focus — Week 1+ (signal-driven)

Once the trial loop is closed and beta is live, primary effort shifts to **agent + harness improvements**. The legal data is commodity; the AI experience is the moat. Beta feedback drives prioritisation — don't pre-commit to a sequence.

### Already in flight / known scaffolding (don't re-derive)

- **Telemetry is wired** — `ChatUsageEvent` model + `/admin/usage` page (Story 14.27). Token, cost, cache-hit, reasoning, step-count per turn. Means new tools/skills can be measured against real usage from day 1.
- **Anthropic prompt cache v1** lives at workspace scope. **Promotion criteria for v2** (cross-workspace base): cache hit rate <50%, workspace count >100, or monthly AI COGS >$500. Beta will hit at least one of these in week 1–4. v2 restructures `buildSystemPrompt` to return cache-marked parts so the ~9k-token base is shared globally.
- **Extended thinking** is per-context (change=8k / task=3k / law=2k / global=disabled) at `app/api/chat/route.ts#THINKING_BUDGET`. Tunable per beta feedback — if users say "Lexa thinks too much," drop budgets. If they say "answers too shallow," raise them.
- **Streaming pacing** is server-side (`smoothStream({ chunking: /[\s\S]/, delayInMs: 8 })`). Single-source-of-truth — no client typewriter. Adjust `delayInMs` only.

### Existing backlog stories to triage post-beta

| Story | Title | Why it might surface fast |
|---|---|---|
| 14.6 | File knowledge extraction + embedding | Customers will upload styrdokument and expect Lexa to read them. High-leverage for retention. |
| 14.7d | File-search compliance-history tools | Same surface; tool-side counterpart to 14.6. |
| 14.12 | Smart context cards | "What is Lexa using?" transparency — common beta feedback request. |
| 14.13 | Retrieval ground-truth labeling | Behind-the-scenes; needed to measure retrieval quality empirically vs. anecdotally. |
| 14.19 | Edit + rerun chat messages (branching) | Power-user feature; if early users say "I had to start over to rephrase," this jumps the queue. |
| 3.11 | Optimize AI costs / caching | If COGS-per-trial exceeds $5, this becomes urgent. Telemetry will tell us. |

### New tools / skills to consider (signal-driven, not committed)

- **Document upload + Q&A on user files** — most-requested feature in similar B2B tools.
- **"Compare these two laws" tool** — diff-style prompt with section-by-section overlay.
- **"Fyll i denna kravpunkt" tool** — agent-assisted kravpunkt drafting from a law section.
- **"Audit-prep" multi-step tool** — generate cycle scope from current laglista + business profile.
- **Memory across chats per user** — currently each chat is fresh; cross-chat memory is a known want.

### GUI improvements queue

- Smart context cards (Story 14.12) — surface what Lexa is using, inline.
- Branching / edit-rerun (Story 14.19) — tree of conversation states.
- Tool-call result inline UX — currently rendered minimally; could be richer per tool type.
- "Föreslå sammanfattning" inline buttons across kravpunkter / law-list-item modal — turn passive content into active prompts.

### Process suggestion for week 1

1. **Daily 30-min beta-feedback triage.** Skim `feedback@laglig.se` (or Slack webhook firehose), Sentry errors, and `ChatUsageEvent` aggregates. Flag patterns.
2. **One agent improvement / day.** Small. Ship-fast. Measure impact via telemetry within 24h.
3. **Re-prioritise weekly.** Don't write a 3-week sprint plan; write a 1-week one and adjust.

This pairs with the public-beta framing — "we ship fast, you get heard, your needs shape the product." Compounds when users tell each other.

---

## Open questions for tomorrow morning

1. Enterprise-inquiry expiration: simple-extend-7-days or new `ENTERPRISE_PENDING` status? **Default: simple-extend** unless complexity is trivially low.
2. LLM fuzzy match for import: ship in v1 or follow-up? **Default: ship Levenshtein only** for Thursday.
3. Onboarding-wizard import branch (Surface 2): in-scope or follow-up? **Default: follow-up** unless Wednesday afternoon has slack.
4. Day-13 reminder email copy + sender — needs final review before sending to real users.
5. Production Supabase branch: separate project or branch feature? Depends on plan tier — verify in dashboard tomorrow AM.
