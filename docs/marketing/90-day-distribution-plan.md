# Laglig.se — 90-day solo distribution plan

**Window:** 2026-06-18 → 2026-09-16. **Constraint:** one person, also building product.
**Core principle:** machines + the product do the volume; your scarce hours go only to leverage
(one action → many customers). Don't run every channel — run the automated core (PLG + SEO + Ads)
and make *one* human bet (consultant/auditor partners).

## The 4 levers (in priority order)
1. **Product-led growth** — free catalog (top-of-funnel) + org-number self-serve onboarding + the
   **auditor referral loop** ("gratis för revisorn"). Your unfair solo advantage. Runs while you sleep.
2. **SEO / programmatic pages** — Epic 26 engine; new pages are editorial, AI-assisted. Compounds.
3. **Google Ads** — buys speed now (money, not time). Already live.
4. **Consultant/auditor partners** — the channel this market actually runs on. Your one human bet.

## Weekly cadence (the repeatable rhythm — ~1 day/week on distribution)
- **Mon (30 min):** check dashboard — signups, trial→paid, Ads spend/CAC, GSC impressions. Note 1 thing to fix.
- **Tue–Wed (½ day):** the phase's main build (pages / funnel / partner outreach).
- **Thu (1 hr):** publish 1 SEO page (AI-drafted, you polish) + 1 LinkedIn post.
- **Fri (30 min):** Ads check + reply to any partner/lead threads.

---

## Phase 0 — Foundation (this week, Jun 18–22)
Close the loops so every later action is measurable. ~1 day total.
- [ ] GA4: mark `signup_completed` as a **key event**; confirm Ads conversion flips to "Recording".
- [ ] Ship the **cookie/privacy Consent Mode disclosure** (the open follow-up).
- [ ] Define your 3 north-star metrics + baseline them: **new trials/week**, **trial→paid %**, **organic impressions (GSC)**.
- [ ] HubSpot: confirm lifecycle stages + one nurture email in Resend fire on signup.
- [ ] Write your one-line positioning + the 3 CTAs you'll reuse everywhere ("Kom igång gratis" / "Boka demo").

## Phase 1 — Capture existing demand (Days 1–30, ~Jun 18–Jul 17)
**Goal: turn the traffic/intent that already exists into trials. Fastest payback.**

**Google Ads (automated, ~2 hrs/week)**
- Launch 1 search campaign, small budget (~150 SEK/day) on **competitor-conquesting + category** terms from `keyword-research-seeds.md` (`notisum alternativ`, `lagbevakning`, `laglista`, `regelefterlevnad system`).
- Point ads at `/jamfor/notisum` + `/kom-igang` (build these two pages first — see SEO below).
- Let Smart Bidding optimize on the `signup_completed` conversion. Review weekly; cut losers.

**Product / PLG (highest-leverage build)**
- Ship the **auditor referral loop**: a prominent "Bjud in din revisor — gratis" step in onboarding + post-signup. This is your compounding viral wedge — one customer surfaces you to an auditor who has many clients.
- Tighten the org-number → laglista → trial funnel; remove any friction step (measure drop-off in GA4).

**SEO (compounding, start now)**
- Ship the **comparison pages first** — highest commercial intent, fastest to rank: `/jamfor/notisum`, `/jamfor/karnov`, `/jamfor/excel`. AI-drafts, you polish.
- Ship `/kom-igang` (paid-traffic landing) + `/demo` (HubSpot Meetings embed).

**Metric to hit:** ads + organic producing a *measurable* weekly trial number; auditor-invite rate > 0.

## Phase 2 — Build the compounding engine (Days 31–60, ~Jul 18–Aug 16)
**Goal: SEO content cadence + recruit your first 2–3 partners.**

**SEO (the main time investment now)**
- Run the Semrush keyword-gap (laglig vs Notisum/Aptor/Karnov — see `competitors.md`) → prioritized page backlog.
- Ship **1 page/week, AI-assisted**: industry pages (`/branscher/bygg`, `hotell-restaurang`, `it`) + topic pages (`/omraden/gdpr`, `nis2`, `arbetsmiljo`). These map to your highest-volume clusters.
- Internal-link each new page to relevant catalog laws (your moat) and vice-versa.

**Partner motion begins (your human bet — start light)**
- Build a list of ~20 independent **ISO/QHSE/sustainability consultants & auditors** (not the competitors who bundle their own tool — the independents).
- Personal outreach to ~10 via HubSpot Sequence (short, founder-to-founder): pitch the **free auditor login + "your clients get a smarter AI tool, you get one view across all of them."**
- Goal: **2–3 partners** who'll trial it with a client.

**Content distribution (low effort, compounding)**
- 1 LinkedIn post/week repurposing each new page (you're the face — solo founders sell trust).

**Metric to hit:** 6–8 marketing pages live; GSC impressions trending up; 2–3 partner conversations.

## Phase 3 — Lean into what works (Days 61–90, ~Aug 17–Sep 16)
**Goal: double down on the winning channel; formalize the partner loop.**
- **Review:** which channel produced the cheapest trials → put more time/budget there, cut the rest.
- **Partners:** convert the 2–3 warm consultants into a simple **referral program** (referral link/code, attribution in HubSpot, a clear incentive). Ask each happy partner for 1 intro.
- **Proof:** turn your first real customers into 1–2 **case studies / `/kundcase`** pages — these recruit the *next* partners and lift Ads/SEO conversion. (Note: Almåsa is off-limits per prior decision — use a referenceable customer.)
- **SEO:** keep the 1 page/week cadence; add comparison pages for any competitor showing up in your keyword gap.
- **Ads:** scale budget only on the campaigns with proven trial→paid; add winning topic/industry keywords.

**Metric to hit:** a repeatable weekly trial number you trust + 1 working referral partner + 2 case studies.

---

## What to deliberately NOT do (solo discipline)
- ❌ Manually prospect SMBs one-by-one — that's what self-serve + Ads are for.
- ❌ Build affiliate/partner *tooling* before validating with a few manual partner deals.
- ❌ High-touch enterprise sales, events, big paid campaigns — need a team you don't have.
- ❌ Spread across 5 channels — automated core (PLG + SEO + Ads) + one human bet (partners). That's it.

## Dashboard (check Mondays)
| Metric | Source | Target trend |
|---|---|---|
| New trials / week | GA4 `signup_completed` | up and to the right |
| Trial → paid % | Stripe / app | establish baseline, then improve |
| Organic impressions | Google Search Console | up (SEO compounding) |
| Ads CAC (cost / paid signup) | Google Ads + Stripe | below your LTV ceiling |
| Auditor invites / signups | app event | > 0, rising |
| Active partners | HubSpot | 0 → 1 → 3 |

## Tie-ins to existing work
- Ads conversion + GA4: fixed & verified (PRs #78/#79).
- Cold outreach + demo booking: HubSpot Sales Pro Sequences + Meetings (Epic 28).
- SEO pages: Epic 26 template engine; fuel with `keyword-research-seeds.md` + `competitors.md`.
