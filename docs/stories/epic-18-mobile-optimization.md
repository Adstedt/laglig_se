# Epic 18: Mobile UX Optimization — Brownfield Enhancement

## Status

Planned

## Epic Goal

Optimize both public-facing SEO pages and the authenticated workspace UI for mobile devices so that all core user flows — discovering, reading, browsing, and managing legal compliance — deliver a polished experience on phones and tablets without regressing the desktop experience.

## Epic Description

### Existing System Context

- **Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 3.4+, shadcn/ui (Radix), Zustand, Vercel AI SDK
- **Current state:** Built desktop-first. Public marketing pages (landing, auth) are already responsive. Public legal content pages (`/lagar/[id]`, `/alla-lagar`, `/rattskallor`, `/eu`) and the authenticated workspace (`/dashboard`, `/laglistor`, `/browse/*`, `/tasks`, `/settings`) have gaps on screens < 768px.
- **SEO context:** The project has a significant SEO moat with 170,000+ public legal content pages. Mobile optimization of these public pages is especially important — non-users arriving via search on mobile devices must have a high-quality reading and discovery experience.

### Enhancement Details

- **What's being changed:** Responsive layout, component rendering, touch interactions, and content adaptation across public legal pages and workspace views for mobile viewports.
- **How it integrates:** Changes are at the CSS/component level. The approach depends on what each story requires — may range from Tailwind responsive prefixes to conditional rendering to new mobile-specific components (e.g., bottom sheets, drawers). No API or data model changes expected.
- **Success criteria:** All pages render cleanly and are fully functional on iPhone SE (375px) through iPhone 15 Pro Max (430px). No horizontal scroll on any page. Touch targets meet 44px minimum. No desktop regressions.

### Dual scope

| Surface | Why it matters | Priority |
|---------|---------------|----------|
| **Public pages** (`/lagar/[id]`, `/alla-lagar`, `/rattskallor`, `/eu/*`, `/foreskrifter/*`) | SEO moat — these pages are how non-users discover Laglig. A poor mobile experience on organic search results directly impacts conversion. | High |
| **Workspace pages** (`/dashboard`, `/laglistor`, `/browse/*`, `/tasks`, `/settings`) | Authenticated users managing compliance on the go. Current experience has layout breaks and usability gaps on mobile. | High |

## Stories

Stories will be added incrementally as the app is reviewed page-by-page on mobile devices. Each story should:

- Target a specific page or component group
- Include screenshots or descriptions of the mobile issues being addressed
- Define acceptance criteria testable on a real device or Chrome DevTools mobile emulation
- Specify that desktop layout must not regress

### Story Index

_(To be populated during mobile review sessions)_

| # | Story | Status | Target |
|---|-------|--------|--------|
| — | — | — | — |

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

- [ ] All stories completed with acceptance criteria met
- [ ] Every modified page verified at 375px (iPhone SE), 390px (iPhone 12), and 1440px (desktop)
- [ ] No horizontal scrolling on any page at any mobile viewport
- [ ] Touch targets meet 44x44px minimum on interactive elements
- [ ] No regression in existing desktop functionality
- [ ] Lighthouse mobile scores maintained or improved on key public pages
