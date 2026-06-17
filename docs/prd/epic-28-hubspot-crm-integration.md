# Epic 28: HubSpot CRM Integration — Brownfield Enhancement

**Status:** Draft (PO, 2026-06-17)
**Owner:** Alexander
**Branch:** `feat/hubspot-integration`
**Companion docs:** `docs/onboarding-strategy.md` (funnel design — partially aspirational), `docs/marketing-site-strategy.md` (CTA pattern), `docs/prd/epic-26-marketing-pages-seo-content-engine.md` (supersedes the Cal.com assumption in Story 26.10), `docs/architecture/3-tech-stack.md`.

**Goal:** Wire laglig.se into HubSpot so that every meaningful prospect and customer touch — anonymous trial, email capture, signup, workspace activation, paid conversion, demo booking — lands as a clean, attributed contact record in the CRM, and so the sales motion (cold outreach, demo scheduling) runs *from* HubSpot. The integration is **server-side-first and non-blocking**: HubSpot is a downstream consumer of lifecycle events, never on the critical path of auth or billing.

**Value Delivered:** Today there is **no CRM integration anywhere in the codebase** (no HubSpot/CRM client in `lib/`, no `Lead` model in Prisma — the funnel in `onboarding-strategy.md` is intent, not implementation). Marketing attribution exists only as UTM tagging (`lib/marketing/utm.ts`) feeding GA4/Vercel Analytics. That means: prospects who book a demo or sign up are invisible to the sales process until they're already paying; cold outreach has no synced lead list; and there's no single record tying a marketing touch → trial → signup → customer. This epic closes that gap by establishing a typed HubSpot client, consent-gated tracking, lifecycle sync at the real code hook points, HubSpot-native demo booking, and a clear division of labor between Resend (automated nurture email) and HubSpot (CRM + sales sequences + meetings).

---

## HubSpot tier reality (the binding constraint)

**Plans in use:** Marketing Hub **Starter** + Sales Hub **Professional**. The design is scoped strictly to what these unlock.

| Capability | Plan | In scope? | Notes |
|---|---|---|---|
| Contacts / Companies / CRM API (v3) | All tiers | ✅ Core | Backbone of lifecycle sync. Idempotent upsert by email. |
| Tracking code + `hubspotutk` cookie | Marketing Starter | ✅ | Consent-gated; marketing pages only. |
| Forms + basic lists/segmentation | Marketing Starter | ✅ (light) | Simple content/contact forms only — NOT the org-number signup flow. |
| **Sequences** (cold outreach) | **Sales Pro** | ✅ | The cold-outreach engine. 1:1, multi-step, rep-driven. |
| **Meetings** (scheduler) | **Sales Pro** | ✅ | Demo booking. Round-robin/team links. Supersedes Cal.com (Epic 26.10). |
| Deal pipelines + sales workflow automation | Sales Pro | ✅ | Deal created on signup/trial; closed-won on paid. |
| Multi-step **marketing** nurture workflows | Marketing **Pro** | ❌ Not available | Nurture email stays in **Resend** (see division of labor). |
| **Custom behavioral events** | Marketing **Enterprise** | ❌ Not available | Use contact properties + standard activity timeline instead. |
| Predictive lead scoring | Enterprise | ❌ Not available | Compute a score property our side, push as a custom property. |

### Division of labor (decided)

- **Resend (our stack)** owns *automated lifecycle/nurture email* — the Day-1/Day-3/Day-7 sequences in `onboarding-strategy.md`, transactional emails, abandonment recovery. React Email templates, EU delivery, no tier ceiling, full GDPR control.
- **HubSpot** owns the *CRM record*, *Sales Sequences* (human-driven cold outreach), *Meetings* (demo booking), *deal pipeline*, and *list segmentation*. Contact properties pushed from our side make HubSpot lists/sequences targetable.

---

## Architecture approach

Three integration surfaces, server-side-first:

1. **Attribution layer (client, marketing pages only).** HubSpot tracking script mounted on `app/(marketing)` routes — gated through the existing **Consent Mode v2** `analytics` category (`lib/consent/`), so it never loads without consent. Drops `hubspotutk`. Reuses existing UTM infra (`lib/marketing/utm.ts`). Not loaded inside the authenticated app.

2. **Lifecycle sync layer (server).** A thin typed client `lib/marketing/hubspot/` over CRM API v3. **Non-blocking, fire-and-forget (queued)** upserts at the real hook points in code:
   - `app/actions/auth.ts → signupAction` (Supabase `auth.signUp`) → contact, `lifecyclestage = lead`.
   - `app/actions/workspace.ts:197 → createWorkspace` (the true activation event) → company (org_number, SNI, name) + contact association + `lifecyclestage = opportunity`, deal created.
   - `app/api/webhooks/stripe/route.ts` → `lifecyclestage = customer`, deal closed-won.
   - (Pre-signup) email-capture MQL — *gated on the `Lead` model being built (Story 28.4)*.
   Each call passes `hubspotutk` for identity stitching and is gated on marketing consent. **A HubSpot outage must never break signup, workspace creation, or billing** — failures are caught, logged to Sentry, and reconciled by cron (Story 28.7).

3. **Demo booking (Sales Hub Pro Meetings).** `/demo` embeds the HubSpot Meetings scheduler; the **"Boka demo"** secondary CTA (next to "Kom igång gratis", per `marketing-site-strategy.md`) routes there carrying UTM params. Booking natively creates the contact + logs the meeting in the CRM — zero sync code. **This supersedes the Cal.com embed assumed in Epic 26 Story 26.10.**

---

## Stories

Sequenced for safe, incremental rollout. 28.1–28.3, 28.7, 28.8 are tier-agnostic foundation; 28.5 (Meetings) and 28.6 (Sequences) lean on Sales Hub Pro.

### Story 28.1 — HubSpot client foundation (server)
Create `lib/marketing/hubspot/` — a typed wrapper over CRM API v3. Private App token via `HUBSPOT_PRIVATE_APP_TOKEN`, validated through `@t3-oss/env-nextjs` (`lib/env.ts`). Idempotent `upsertContact()` (dedup by email), `upsertCompany()`, association helpers, and a custom-property map (org_number, sni_code, plan, lifecycle, marketing source). All calls wrapped in a fire-and-forget executor that swallows + Sentry-logs failures. **No UI, no user-facing change.** Unit-tested with MSW mocking the HubSpot API.

### Story 28.2 — Consent-gated tracking script (marketing pages)
Mount the HubSpot tracking code on `app/(marketing)` routes only, gated through the existing Consent Mode v2 `analytics` category — loads on grant, suppressed on deny, re-evaluated on consent change (mirror the GA4 pattern in `lib/consent/gtag.ts`). Add a server helper to read `hubspotutk` from cookies for identity stitching in Story 28.3. Verify no script loads in the authenticated app and none loads pre-consent.

### Story 28.3 — Lifecycle sync at real hook points (server)
Wire non-blocking upserts into `signupAction`, `createWorkspace`, and the Stripe webhook (mapping above), passing `hubspotutk` and gating on marketing consent. Create/advance the HubSpot deal on activation and close-won on paid. Each hook is wrapped so a HubSpot failure is invisible to the user and queued for reconciliation. E2E: signup with a stubbed HubSpot still completes; contact appears with correct lifecycle + properties.

### Story 28.4 — Pre-signup lead capture (MQL) — *depends on `Lead` model*
Implement the email-capture MQL step from `onboarding-strategy.md`. **Prerequisite: add the `Lead` model to Prisma** (currently missing — `prisma/schema.prisma` has `User`/`Workspace`/`WorkspaceMember` only). On email capture (consent-gated): persist `Lead` row + upsert MQL contact (`lifecyclestage = marketingqualifiedlead`) with session/company data. Resend fires the "Din laglista är sparad" email. *Migration is hand-applied by Alexander — provide the command, do not run it.*

### Story 28.5 — Demo booking via HubSpot Meetings (supersedes Epic 26.10 Cal.com)
Build `/demo` embedding the Sales Hub Pro Meetings scheduler. Wire the **"Boka demo"** secondary CTA across marketing pages (hero/mid/footer per `marketing-site-strategy.md`), carrying UTM via `buildUtmUrl()`. Optional: a modal scheduler from the secondary CTA for warm traffic, backed by the `/demo` page for direct/ad links. **Update Epic 26 Story 26.10 to drop the Cal.com embed.** Verify a booking produces an attributed contact + logged meeting.

### Story 28.6 — Cold-outreach + nurture orchestration (division of labor)
Document and implement the split: automated nurture stays in **Resend** (driven by `Lead`/workspace state + Vercel cron); HubSpot **Sales Sequences** are used for human-driven cold outreach against MQL/lead lists synced via contact properties. Set up the contact properties + basic Marketing Starter lists that make sequences/lists targetable. No marketing-workflow automation is built in HubSpot (tier-unavailable). Deliverable includes a short runbook for the sales user.

### Story 28.7 — Reconciliation cron + observability
A Vercel cron that backfills/repairs contacts whose sync failed (since 28.3 is non-blocking): scan for un-synced lifecycle transitions, retry upserts, dead-letter persistent failures. Sentry alerts on failure-rate threshold. Idempotency guarantees no duplicate contacts/deals on retry.

### Story 28.8 — GDPR / DPA / privacy disclosures
HubSpot becomes a data **processor** for Swedish customer PII (US-based — confirm EU data hosting availability / rely on SCCs). Update the subprocessor list (`/underbitraden`) and privacy/cookie policy to disclose HubSpot tracking + CRM processing. Verify consent gating end-to-end (no PII to HubSpot without marketing consent). Confirm contact-delete / data-subject-request path. *Legal copy reviewed by Alexander.*

**Estimated stories:** 8 (28.1–28.8). 28.1–28.3 are the highest-leverage foundation; 28.4 is gated on the `Lead` model; 28.5–28.6 deliver the sales motion; 28.7–28.8 harden + comply.

---

## Compatibility Requirements

- [ ] Existing auth, workspace-creation, and Stripe flows remain functional **even if HubSpot is fully down** (all sync is non-blocking, caught, queued).
- [ ] No changes to existing Server Action / API contracts — HubSpot calls are additive side-effects only.
- [ ] Database changes (Story 28.4 `Lead` model) are additive/backward-compatible; migration hand-applied by Alexander.
- [ ] Tracking script obeys the existing Consent Mode v2 mechanism — no new consent UI, no regression to the cookie banner.
- [ ] Demo-booking change is coordinated with Epic 26 (26.10 updated, not duplicated).
- [ ] Marketing pages keep their performance budget — tracking script loaded post-consent, async.

## Risk Mitigation

- **Primary Risk:** A HubSpot API failure or latency spike blocks signup / workspace creation / billing.
  - **Mitigation:** All sync is fire-and-forget behind a guarded executor; failures Sentry-logged and reconciled by cron (28.7). No HubSpot call is `await`ed on the user's critical path.
- **Secondary Risk:** PII sent to a US processor without consent (GDPR/IMY exposure).
  - **Mitigation:** Every push gated on the marketing-consent category; disclosed in subprocessor list + privacy policy (28.8); EU hosting / SCCs confirmed.
- **Tertiary Risk:** Duplicate contacts/deals from retries or double-fired events.
  - **Mitigation:** Idempotent upsert by email + deal idempotency keys; reconciliation cron is idempotent.
- **Rollback Plan:** Each surface is independently reversible — remove the tracking script (28.2), no-op the sync executor via an env flag (`HUBSPOT_SYNC_ENABLED=false`), and the `/demo` page can revert to a `mailto:`/contact fallback. No destructive schema changes; the `Lead` table is additive.

## Definition of Done

- [ ] All stories completed with acceptance criteria met.
- [ ] Signup / workspace creation / billing verified to succeed with HubSpot stubbed AND with HubSpot erroring.
- [ ] Contacts appear in HubSpot with correct lifecycle stage + properties at each transition; demo bookings produce attributed contacts.
- [ ] Consent gating verified (no PII / no tracking pre-consent).
- [ ] Privacy/subprocessor disclosures updated and legally reviewed.
- [ ] Resend ↔ HubSpot division of labor documented; sales runbook delivered.
- [ ] No regression in existing auth, onboarding, marketing, or billing flows.

---

## Dependencies & Source Artefacts

- **`lib/marketing/utm.ts`** — existing UTM tagging, reused by demo CTA + tracking attribution.
- **`lib/consent/` (Consent Mode v2, merged 2026-05-15)** — tracking script gates through the `analytics` category here.
- **`app/actions/auth.ts` (`signupAction`)**, **`app/actions/workspace.ts:197` (`createWorkspace`)**, **`app/api/webhooks/stripe/route.ts`** — the three server hook points for lifecycle sync.
- **`docs/onboarding-strategy.md`** — funnel design (3-stage MQL model); note its `Lead` model and `marketingAutomation` client are **not yet built** (Story 28.4 builds them).
- **Epic 26, Story 26.10** — currently assumes Cal.com for `/demo`; **this epic supersedes that** with HubSpot Meetings (28.5).
- **`prisma/schema.prisma`** — gains a `Lead` model in 28.4 (currently `User`/`Workspace`/`WorkspaceMember`).
- **Resend + React Email** (existing) — owns automated nurture/lifecycle email.
- **HubSpot decisions (Alexander, 2026-06-17):** Meetings for demo booking; Marketing Hub Starter + Sales Hub Professional; standalone epic.

---

## Story Manager Handoff

Please develop detailed user stories for this brownfield epic. Key considerations:

- Enhancement to an existing Next.js 16 / Supabase Auth / Prisma / Stripe / Resend system on Vercel.
- **Integration points:** `signupAction`, `createWorkspace` (tx), Stripe webhook, marketing-page layout (tracking script), Consent Mode v2, UTM helper, new `Lead` model.
- **Existing patterns to follow:** Consent-gated script loading (`lib/consent/gtag.ts`), env validation (`@t3-oss/env-nextjs`), MSW for external-API tests, non-blocking side-effects, hand-applied migrations.
- **Critical compatibility requirement:** No HubSpot call may block or break auth, workspace creation, or billing — all sync is fire-and-forget + reconciled.
- Each story must include verification that existing functionality remains intact.

The epic should maintain system integrity while wiring laglig.se's lifecycle and sales motion into HubSpot.
