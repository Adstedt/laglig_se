# OPS — Configure custom SMTP (Resend) for Supabase Auth emails

## Status

Backlog (small ops task — no story-level effort, ~5-15 min in Supabase Dashboard).

## Story

As a **maintainer of the Laglig.se project**,
I want **Supabase Auth's signup-confirmation, magic-link, and password-reset emails to flow through our existing Resend account**,
so that **the built-in Supabase mailer's strict rate limit (~2-4 emails/hour, applied across email/IP/project dimensions) stops blocking UAT, customer onboarding, and operational signups**.

## Why this matters now

Surfaced during Epic 21 UAT prep on 2026-04-27 — a single signup attempt for a new test user (`alexander.adstedt+200@kontorab.se` invited as AUDITOR to Almåsa Havshotell) returned `429: email rate limit exceeded` from Supabase Auth despite no other auth emails being sent recently. Confirmed via Supabase Auth logs (`request_id: 9f2c30f6e81ad207-ARN`). This is the second time the rate limit has bitten during testing; will keep biting until custom SMTP is configured.

The codebase already uses Resend for transactional emails (`lib/external/resend.ts`, `RESEND_API_KEY` in `.env`), so no new vendor or billing decision is needed.

## Acceptance Criteria

1. Supabase Dashboard → Project Settings → Auth → SMTP Settings has "Enable Custom SMTP" toggled on.
2. SMTP host = `smtp.resend.com`, port = `465` (SSL) or `587` (TLS), username = `resend`, password = `RESEND_API_KEY`.
3. Sender email is a verified domain in the Resend account (e.g. `noreply@laglig.se`); sender name set to "Laglig".
4. After save, sending a test signup confirmation (e.g. invite a `+test@kontorab.se` user) succeeds without 429 and the email arrives via Resend (visible in Resend dashboard logs).
5. Verify all four Supabase Auth email templates still render correctly (signup confirmation, magic link, password reset, email change) by triggering each at least once.
6. Document the configuration in `docs/operations/auth-email-setup.md` (new file) so the next maintainer doesn't have to re-derive the settings.

## Risks / things to verify

- **Sender domain verification.** The "from" address must use a domain that's verified in Resend, otherwise emails will bounce silently. Check Resend Dashboard → Domains.
- **Reply-to address.** Default Resend behaviour is to use the sender as reply-to; verify that's appropriate for password-reset flows where users sometimes hit "Reply".
- **DKIM / SPF.** Resend handles these for verified domains; double-check by running `dig TXT laglig.se` to confirm the SPF + DKIM records are still present.
- **Resend daily quota.** Free tier = 100 emails/day, paid tier ($20/mo) = 50,000/mo. Estimate Auth-email volume; even at 10 signups/day plus password resets, free tier covers MVP comfortably.
- **Email deliverability for `+suffix` aliases.** Some receivers (rare, but happens) reject `+suffix` addresses. Test once with a non-aliased address (e.g. `test-uat@example.com`) to confirm the broader path works, not just the developer alias path.

## Files affected

- None in repo (Supabase Dashboard config only).
- New: `docs/operations/auth-email-setup.md` — short runbook for the configuration.

## Estimated effort

15 minutes to configure + 15 minutes to write the runbook + 30 minutes to test all four email templates = ~1 hour.

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-04-27 | 0.1 | Backlog stub created during Epic 21 UAT prep after `429: email rate limit exceeded` blocked an AUDITOR-role signup test. Documents the durable fix so it isn't lost. | Sarah (PO) |
