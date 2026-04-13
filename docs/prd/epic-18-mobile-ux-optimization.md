# Epic 18: Mobile UX Optimization — Brownfield Enhancement

**Goal:** Optimize both public-facing SEO pages and the authenticated workspace UI for mobile devices so that all core user flows — discovering, reading, browsing, and managing legal compliance — deliver a polished experience on phones and tablets without regressing the desktop experience.

**Delivers:** Responsive layouts and touch-friendly interactions across public legal content pages (`/lagar/[id]`, `/alla-lagar`, `/rattskallor`, `/eu/*`, `/foreskrifter/*`) and authenticated workspace surfaces (`/dashboard`, `/laglistor`, `/browse/*`, `/tasks`, `/settings`). Introduces mobile-specific components (bottom sheets, drawers) where native web patterns fall short.

**Requirements covered:** NFR4 (usability), NFR5 (responsive design) — no new functional requirements; this epic improves existing feature delivery on mobile.

**Estimated stories:** Rolling (see *Scope Note* below). Initial seed of ~6–10 stories expected after first mobile review pass.

**Dependencies:** None — all epics whose surfaces are touched (2, 6, 8, 14, 16, 17) are operational. Works against the current state of the app.

**Priority:** High — SEO moat (170,000+ public pages) is actively harmed by poor mobile UX on organic-search landings, directly impacting conversion.

**Note:** Brownfield enhancement. CSS/component-level changes only — no API or data model changes expected.

---

## Status

Planned

## Epic Description

### Existing System Context

- **Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 3.4+, shadcn/ui (Radix), Zustand, Vercel AI SDK
- **Current state:** Built desktop-first. Public marketing pages (landing, auth) are already responsive. Public legal content pages (`/lagar/[id]`, `/alla-lagar`, `/rattskallor`, `/eu`) and the authenticated workspace (`/dashboard`, `/laglistor`, `/browse/*`, `/tasks`, `/settings`) have gaps on screens < 768px.
- **SEO context:** The project has a significant SEO moat with 170,000+ public legal content pages. Mobile optimization of these public pages is especially important — non-users arriving via search on mobile devices must have a high-quality reading and discovery experience.

### Enhancement Details

- **What's being changed:** Responsive layout, component rendering, touch interactions, and content adaptation across public legal pages and workspace views for mobile viewports.
- **How it integrates:** Changes are at the CSS/component level. The approach depends on what each story requires — may range from Tailwind responsive prefixes to conditional rendering to new mobile-specific components (e.g., bottom sheets, drawers). No API or data model changes expected.
- **Success criteria:** All pages render cleanly and are fully functional on iPhone SE (375px) through iPhone 15 Pro Max (430px). No horizontal scroll on any page. Touch targets meet 44px minimum. No desktop regressions.

### Dual Scope

| Surface | Why it matters | Priority |
|---------|---------------|----------|
| **Public pages** (`/lagar/[id]`, `/alla-lagar`, `/rattskallor`, `/eu/*`, `/foreskrifter/*`) | SEO moat — these pages are how non-users discover Laglig. A poor mobile experience on organic search results directly impacts conversion. | High |
| **Workspace pages** (`/dashboard`, `/laglistor`, `/browse/*`, `/tasks`, `/settings`) | Authenticated users managing compliance on the go. Current experience has layout breaks and usability gaps on mobile. | High |

### Scope Note (PO)

This epic is shaped as a **rolling/umbrella epic** rather than a closed 1–3 story brownfield enhancement, because the discovery approach (page-by-page mobile review) means story scope emerges over time. Accept the tradeoff that "Done" for Epic 18 is defined by the mobile-review checklist in the Definition of Done rather than by a fixed story count. **If the Story Index grows beyond ~8–10 stories, split into sibling epics** — a natural cleavage is public-pages (Epic 18a) vs. workspace (Epic 18b). This keeps each child epic finitely scoped and reviewable.

## Stories

Stories will be added incrementally as the app is reviewed page-by-page on mobile devices. Each story should:

- Target a specific page or component group
- Include screenshots or descriptions of the mobile issues being addressed
- Define acceptance criteria testable on a real device or Chrome DevTools mobile emulation
- Specify that desktop layout must not regress

### Story Index

_(Populated during mobile review sessions. Seeded candidates below are placeholders — confirm during review before moving to `in-progress/`.)_

| # | Story | Status | Target |
|---|-------|--------|--------|
| — | — | — | — |

**Candidate seeds** (to be confirmed and scoped during first mobile review):

- Public law reader (`/lagar/[id]`) — chapter navigation, ToC, section anchors, table rendering
- Law list browsing (`/alla-lagar`, `/rattskallor`, `/eu/*`) — filter UI, result cards, pagination
- Workspace dashboard (`/dashboard`) — kanban columns, card density, at-a-glance widgets
- Laglistor table (`/laglistor`) — table vs. card toggle already defaults to table; verify mobile default and horizontal overflow
- Legal document modal (`/laglistor` item detail) — tabs, compliance actions, kravpunkter checklist on narrow viewports
- Task management (`/tasks`) — kanban on narrow viewports, task detail drawer
- Settings (`/settings`) — form layouts, tab navigation

## Compatibility Requirements

- [x] Existing APIs remain unchanged — no API changes expected
- [x] Database schema changes are backward compatible — no schema changes expected
- [ ] UI changes follow existing patterns — uses existing Tailwind/shadcn patterns, may introduce mobile-specific components (sheets, drawers) where needed
- [x] Performance impact is minimal — CSS-level changes, no new data fetching

## Risk Mitigation

- **Primary Risk:** Desktop regression — a mobile fix inadvertently breaks the desktop layout
- **Mitigation:** All changes scoped with Tailwind breakpoint prefixes or conditional rendering. Manual verification at both mobile and desktop viewports for every story. Playwright viewport tests if warranted.
- **Rollback Plan:** All changes are CSS/component-level and easily revertible per-commit.

## Definition of Done

- [ ] All stories in the Story Index completed with acceptance criteria met
- [ ] Every modified page verified at 375px (iPhone SE), 390px (iPhone 12), and 1440px (desktop)
- [ ] No horizontal scrolling on any page at any mobile viewport
- [ ] Touch targets meet 44x44px minimum on interactive elements
- [ ] No regression in existing desktop functionality
- [ ] Lighthouse mobile scores maintained or improved on key public pages

---

## Story Manager Handoff

Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing system running **Next.js 16 (App Router), React 19, Tailwind CSS, shadcn/ui**.
- **Integration points:** existing page routes under `app/(marketing)/lagar/`, `app/(marketing)/alla-lagar/`, `app/(marketing)/rattskallor/`, `app/(marketing)/eu/`, `app/(marketing)/foreskrifter/`, and the authenticated `app/(workspace)/*` tree.
- **Existing patterns to follow:** Tailwind breakpoint prefixes (`sm:`, `md:`, `lg:`), shadcn `Sheet`/`Drawer` primitives for mobile overlays, Radix-based components for accessibility. Reuse existing layout primitives before introducing new ones.
- **Critical compatibility requirements:** no desktop regression; no API or schema changes; Lighthouse mobile scores must not regress on public pages.
- Each story must include verification that existing desktop functionality remains intact at 1440px and that the targeted page is fully usable at 375px.

The epic should maintain system integrity while delivering a polished mobile experience across the public SEO surface and the authenticated workspace.
