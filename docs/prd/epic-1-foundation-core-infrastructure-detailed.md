# Epic 1: Foundation & Core Infrastructure (DETAILED)

**Goal:** Establish project foundation (Next.js app, database, auth, deployment pipeline) while delivering initial public law pages to validate SEO strategy.

**Value Delivered:** Working application infrastructure + 100 public law pages generating early SEO traffic + ability to deploy features continuously.

---

## Story 1.1: Initialize Next.js 14 Project with TypeScript and Tailwind

**As a** developer,
**I want** to set up a Next.js 14 project with TypeScript, Tailwind CSS, and essential tooling,
**so that** I have a modern development environment ready for rapid feature development.

**Acceptance Criteria:**

1. Next.js 14+ installed with App Router (not Pages Router)
2. TypeScript configured with strict mode enabled
3. Tailwind CSS installed and configured with custom color tokens (primary, success, warning, error)
4. ESLint + Prettier configured for code quality and formatting
5. Git repository initialized with `.gitignore` (exclude `node_modules`, `.env.local`, `.next`)
6. Project runs locally with `npm run dev` showing default Next.js homepage
7. No build errors or TypeScript warnings

---

## Story 1.2: Set Up Supabase PostgreSQL Database with Prisma ORM

**As a** developer,
**I want** to connect to Supabase PostgreSQL and configure Prisma ORM,
**so that** I have a type-safe database layer for all data operations.

**Acceptance Criteria:**

1. Supabase project created (free tier) with PostgreSQL database
2. Prisma installed and initialized
3. Database connection string configured in `.env.local`
4. Initial Prisma schema created with User and Workspace models
5. First migration generated and applied successfully
6. Prisma Client generated with TypeScript types
7. Database connection tested successfully
8. pgvector extension enabled in Supabase

---

## Story 1.3: Implement Authentication (Supabase Auth + NextAuth.js)

**As a** user,
**I want** to sign up and log in using email/password, Google, or Microsoft,
**so that** I can access my personalized workspace.

**Acceptance Criteria:**

1. Supabase Auth configured with email/password provider
2. Google OAuth provider configured
3. Microsoft OAuth provider configured
4. NextAuth.js integrated for session management
5. Login page with email/password form and OAuth buttons
6. Sign-up page with password complexity validation
7. Email verification flow (6-digit code)
8. Password reset flow
9. Protected routes redirect to login if not authenticated
10. Session cookies set with 30-day expiration, HTTP-only
11. User profile accessible at `/api/auth/me`

---

## Story 1.4: Deploy to Vercel with CI/CD Pipeline

**As a** developer,
**I want** to automatically deploy to Vercel on every push to main,
**so that** I can continuously deliver features without manual deployment.

**Acceptance Criteria:**

1. Vercel project created and linked to GitHub
2. Automatic deployments for main branch (production)
3. Preview deployments for all PRs
4. Environment variables configured in Vercel
5. Build succeeds without errors
6. Production URL accessible
7. GitHub Actions workflow runs: ESLint, TypeScript, Prettier
8. Failed checks block PR merges

---

## Story 1.5: Create Initial Law Pages (SSR for SEO) - 100 Laws

**As a** visitor,
**I want** to view Swedish laws on public pages optimized for Google,
**so that** I can discover Laglig.se through organic search.

**Acceptance Criteria:**

1. Riksdagen API integration fetches 100 SFS laws
2. Law data stored in laws table
3. Dynamic route `/alla-lagar/[lawSlug]` renders law pages
4. Law pages use SSR for SEO
5. Each page includes: title, SFS number, full text, published date
6. Meta tags configured (title, description, Open Graph)
7. Sitemap.xml generated listing all 100 laws
8. Robots.txt allows all crawlers
9. Core Web Vitals meet "Good" thresholds
10. Pages render correctly on desktop and mobile

---

## Story 1.6: Set Up Error Tracking and Logging (Sentry)

**As a** developer,
**I want** to automatically capture errors in production,
**so that** I can debug issues without manual reports.

**Acceptance Criteria:**

1. Sentry account created
2. Sentry SDK installed
3. Sentry initialized in client and server configs
4. Source maps uploaded to Sentry
5. Test error captured successfully in dashboard
6. Error reports include: stack trace, user context, environment
7. Email alerts for critical errors
8. Sentry integrated with Vercel

---

## Story 1.7: Implement Security Headers (CSP, X-Frame-Options)

**As a** security-conscious product owner,
**I want** to protect users from XSS and clickjacking,
**so that** the application meets security best practices.

**Acceptance Criteria:**

1. CSP header configured in Next.js middleware and/or next.config.mjs
2. CSP allows: self, Vercel, Supabase, OpenAI, Sentry
3. CSP configured appropriately for Next.js App Router stack (unsafe-inline for styles required by Tailwind/shadcn)
4. X-Frame-Options: DENY header set
5. X-Content-Type-Options: nosniff header set
6. Referrer-Policy: strict-origin-when-cross-origin set
7. Strict-Transport-Security (HSTS) header set
8. Security headers tested with securityheaders.com (score A/A+)
9. No CSP violations in browser console during normal application use

---

## Story 1.8: Set Up Input Validation (Zod Schemas)

**As a** developer,
**I want** to validate all user inputs server-side with type-safe schemas,
**so that** I prevent injection attacks.

**Acceptance Criteria:**

1. Zod library installed
2. Validation schemas created for user signup/login
3. API routes validate request bodies using Zod
4. Example: POST `/api/auth/signup` validates email format, password complexity
5. Validation errors return clear messages
6. No raw user input passed to database queries
7. XSS prevention: React auto-escapes, no dangerouslySetInnerHTML

---

## Story 1.9: Create Landing Page with Hero Section

**As a** visitor,
**I want** to understand Laglig.se's value proposition on the homepage,
**so that** I can decide if the product is right for me.

**Acceptance Criteria:**

1. Homepage renders with hero section
2. Headline: "Vi håller koll på lagarna – du håller koll på affären"
3. Subheadline: "AI-driven lagefterlevnad..."
4. Primary CTA: "Se din laglista"
5. Secondary CTA: "Utforska funktioner"
6. Hero visual: placeholder image or gradient
7. Legal disclaimer in footer
8. Navigation bar: Logo, Features, Pricing, About, Login, Sign up
9. Mobile-responsive (320px-1920px)
10. Page loads in <2 seconds

---

## Story 1.10: Configure Monitoring and Analytics (Vercel Analytics)

**As a** product owner,
**I want** to track page views and Core Web Vitals,
**so that** I can measure SEO performance and engagement.

**Acceptance Criteria:**

1. Vercel Analytics enabled
2. Analytics tracking code added to app/layout.tsx
3. Dashboard shows: page views, unique visitors, top pages
4. Core Web Vitals tracked: LCP, FID, CLS, TTFB
5. Analytics data accessible in Vercel dashboard
6. No GDPR issues (Vercel Analytics is cookieless)

---

**Epic 1 Complete: 10 stories, 3-4 weeks estimated**
