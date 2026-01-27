# 3. Tech Stack

**This is the DEFINITIVE technology selection for Laglig.se.** All development must use these exact versions unless explicitly updated through architecture review. This table serves as the single source of truth for dependencies, tools, and services.

## 3.1 Technology Stack Table

| Category                       | Technology                           | Version                                       | Purpose                                                      | Rationale                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------ | --------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend Language**          | TypeScript                           | 5.5+ (bundled with Next.js 16)                | Type-safe JavaScript for entire codebase                     | Prevents runtime errors, better IDE support, self-documenting code. Required for Next.js App Router patterns. Next.js 16 bundles TypeScript 5.5+.                                                                                                                                                                                       |
| **Frontend Framework**         | Next.js                              | 16 (App Router)                               | React meta-framework with SSR, routing, API routes           | Best-in-class SSR for 170K SEO pages, Vercel-optimized, Server Components reduce client bundle, App Router required for Server Actions. Turbopack by default for 2-5× faster builds.                                                                                                                                                    |
| **UI Library**                 | React                                | 19 (bundled with Next.js 16)                  | Component-based UI                                           | Industry standard, massive ecosystem, required by Next.js, Server Components support. Next.js 16 bundles React 19 (stable).                                                                                                                                                                                                             |
| **UI Component Library**       | shadcn/ui (Radix UI + Tailwind)      | Latest (not versioned, copy-paste components) | Unstyled accessible primitives + Tailwind styling            | Accessibility built-in (WCAG 2.1 AA), customizable (not opaque npm package), OpenAI-inspired minimalism compatible, small bundle impact.                                                                                                                                                                                                |
| **CSS Framework**              | Tailwind CSS                         | 3.4+                                          | Utility-first CSS framework                                  | Rapid UI development, design tokens compatible, tree-shaking reduces bundle, consistent with PRD Front-End Spec, integrates with shadcn/ui.                                                                                                                                                                                             |
| **State Management (Global)**  | Zustand                              | 4.5+                                          | Lightweight state for Kanban board                           | 2KB bundle, selective subscriptions (no Context re-render issues), persistence middleware, optimistic updates support. Only used for Kanban - Context elsewhere.                                                                                                                                                                        |
| **State Management (Session)** | React Context                        | Built-in (React 19)                           | User session, workspace, permissions                         | Zero bundle cost, sufficient for slow-changing state, Next.js Server Components compatible.                                                                                                                                                                                                                                             |
| **State Management (AI Chat)** | Vercel AI SDK                        | 5.0+                                          | AI chat message history, streaming                           | Purpose-built for LLM streaming, transport-based architecture, parts-based message structure, handles message state automatically, optimistic updates, error recovery, retries. AI Elements for shadcn/ui integration.                                                                                                                  |
| **Form Management**            | React Hook Form                      | 7.51+                                         | Uncontrolled form inputs with validation                     | Better performance than controlled inputs, integrates with Zod for validation, small bundle (9KB), fewer re-renders.                                                                                                                                                                                                                    |
| **Validation**                 | Zod                                  | 3.22+                                         | Runtime type validation and schema                           | Type-safe validation, integrates with React Hook Form, Server Action input validation, consistent validation across frontend/backend.                                                                                                                                                                                                   |
| **Icons**                      | Lucide Icons                         | 0.365+                                        | Icon library                                                 | 2px stroke, rounded caps (matches PRD design), tree-shakeable, React components, OpenAI-style minimalism compatible.                                                                                                                                                                                                                    |
| **Backend Language**           | TypeScript                           | 5.4+ (same as frontend)                       | Type-safe server-side code                                   | Shared types between frontend/backend, prevents API contract mismatches, Server Actions type safety.                                                                                                                                                                                                                                    |
| **Backend Framework**          | Next.js API Routes + Server Actions  | 14.2+                                         | Serverless API endpoints + type-safe mutations               | Hybrid approach: Server Actions for internal mutations (type-safe, no API routes), REST for webhooks/cron/public API (external integrations).                                                                                                                                                                                           |
| **API Style**                  | Hybrid (Server Actions + REST)       | N/A                                           | Internal: Server Actions, External: REST                     | Server Actions for 90% user-facing mutations (better DX, type safety), REST for webhooks (Stripe, Fortnox), cron jobs, public API. No tRPC (App Router Server Actions are "tRPC-lite").                                                                                                                                                 |
| **Database**                   | Supabase PostgreSQL                  | PostgreSQL 15.1 (Supabase managed)            | Primary relational database with pgvector                    | ACID compliance, pgvector extension for embeddings (saves $70/mo Pinecone), EU region (GDPR), 170K+ documents + embeddings, Supabase managed (backups, monitoring).                                                                                                                                                                     |
| **Vector Database**            | pgvector (extension)                 | 0.7.0+                                        | Semantic similarity search for RAG                           | HNSW index (<100ms queries), avoids Pinecone costs until 100K queries/day (NFR17), PostgreSQL native (no separate service), cosine similarity operator.                                                                                                                                                                                 |
| **ORM**                        | Prisma                               | 5.12+                                         | Type-safe database queries                                   | Auto-generated TypeScript types, migration management, connection pooling, prevents SQL injection, integrates with Supabase.                                                                                                                                                                                                            |
| **Cache**                      | Upstash Redis                        | Latest (serverless)                           | RAG response cache, law metadata cache, search results       | Serverless pricing (pay-per-request), EU region (GDPR), REST API (Vercel Edge compatible), 75%+ hit rate target saves $6K/mo OpenAI costs at scale.                                                                                                                                                                                     |
| **File Storage**               | Supabase Storage                     | Latest                                        | User-uploaded PDFs (kollektivavtal), documents               | S3-compatible, integrated with Supabase Auth (RLS policies), EU region, CDN delivery for public files.                                                                                                                                                                                                                                  |
| **Authentication**             | Supabase Auth + NextAuth.js          | Supabase Auth 2.0+, NextAuth 4.24+            | User authentication, session management                      | Supabase Auth: JWT tokens, magic links, OAuth providers. NextAuth: Session handling in Next.js, middleware integration. Hybrid approach for best of both.                                                                                                                                                                               |
| **AI LLM**                     | TBD (OpenAI/Anthropic)               | Configurable via env                          | RAG completions, law summaries, question answering           | Model selection TBD pending testing. Options: OpenAI GPT-4 Turbo, Anthropic Claude. AI SDK 5.0 provider abstraction allows runtime model switching. Decision criteria: Swedish language quality, citation accuracy, cost/performance ratio.                                                                                             |
| **AI Embeddings**              | OpenAI text-embedding-3-small        | text-embedding-3-small                        | Document chunking embeddings                                 | 1536 dimensions, $0.02/1M tokens (10x cheaper than large), sufficient accuracy for Swedish legal text, 3-4 hours to embed 170K documents.                                                                                                                                                                                               |
| **AI SDK**                     | Vercel AI SDK + AI Elements          | 5.0+ (`ai`, `@ai-sdk/react`)                  | LLM streaming, React hooks, provider abstraction             | `useChat()` hook with transport-based architecture, parts-based message structure (`UIMessage`), status states (submitted/streaming/ready/error), `experimental_throttle` for smooth UI. AI Elements provides shadcn/ui-compatible chat components (`Message`, `MessageContent`, `Response`). Provider-agnostic (OpenAI/Anthropic/etc). |
| **Email Service**              | Resend                               | Latest API                                    | Transactional emails, digests, notifications                 | React Email templates (type-safe), 100 emails/day free tier, excellent DX, EU delivery optimization, webhooks for bounces.                                                                                                                                                                                                              |
| **Email Templates**            | React Email                          | 2.1+                                          | Type-safe email templates in React/TSX                       | Write emails as React components, compile to HTML, preview server, version control friendly, integrates with Resend.                                                                                                                                                                                                                    |
| **Payments**                   | Stripe                               | Latest API (stripe npm package 14.21+)        | Subscription billing, invoices, Fortnox integration          | Industry standard, Swedish payment methods (Swish, Klarna), webhooks for events, Stripe Tax for EU VAT, customer portal. Uses official stripe Node.js SDK.                                                                                                                                                                              |
| **Monitoring (Errors)**        | Sentry                               | 7.109+ (Next.js SDK)                          | Error tracking, performance monitoring, user sessions        | Source maps for stack traces, release tracking, user feedback, performance metrics (Web Vitals), 5K errors/mo free tier.                                                                                                                                                                                                                |
| **Monitoring (Performance)**   | Vercel Analytics                     | Built-in                                      | Web Vitals, page performance, user analytics                 | Zero config, privacy-friendly, Core Web Vitals tracking (LCP, FID, CLS), real user monitoring.                                                                                                                                                                                                                                          |
| **Frontend Testing**           | Vitest                               | 1.4+                                          | Unit tests for utilities, components (React Testing Library) | Fast (Vite-powered), TypeScript support, compatible with Jest API, ESM support, 60-70% coverage target.                                                                                                                                                                                                                                 |
| **Component Testing**          | React Testing Library                | 14.2+                                         | Test React components (user interactions, accessibility)     | Tests user behavior not implementation, accessibility-first, integrates with Vitest, WCAG compliance testing.                                                                                                                                                                                                                           |
| **Backend Testing**            | Vitest                               | 1.4+ (same as frontend)                       | Unit tests for Server Actions, utilities, RAG pipeline       | Shared test config with frontend, TypeScript support, mock external services (OpenAI, Supabase).                                                                                                                                                                                                                                        |
| **E2E Testing**                | Playwright                           | 1.42+                                         | End-to-end user flows (onboarding → dashboard → AI chat)     | Cross-browser (Chrome, Firefox, Safari), mobile viewports, screenshot testing, trace viewer for debugging, CI integration.                                                                                                                                                                                                              |
| **Build Tool**                 | Next.js (built-in)                   | 14.2+                                         | TypeScript compilation, bundling, optimization               | Zero config, automatic code splitting, tree shaking, image optimization, Edge runtime support.                                                                                                                                                                                                                                          |
| **Bundler**                    | Turbopack (Next.js 16)               | Built-in (default)                            | Fast bundling for dev & production                           | 2-5× faster production builds, up to 10× faster Fast Refresh, Rust-powered, incremental compilation. Now default in Next.js 16 - no flags needed.                                                                                                                                                                                       |
| **Package Manager**            | pnpm                                 | 9.0+                                          | Dependency management                                        | Faster than npm (symlink-based), disk space efficient, strict (prevents phantom dependencies), monorepo-ready.                                                                                                                                                                                                                          |
| **IaC Tool**                   | N/A (Vercel managed)                 | N/A                                           | Infrastructure as code                                       | Vercel auto-provisions infrastructure, Supabase UI for database config. No Terraform/Pulumi needed for MVP. Manual config documented in docs/. Post-MVP: Consider Terraform if multi-cloud.                                                                                                                                             |
| **CI/CD**                      | GitHub Actions + Vercel              | GitHub Actions, Vercel CLI                    | Linting, type-checking, tests, automated deployments         | GitHub Actions: Run tests on PR. Vercel: Auto-deploy on merge to main (production), preview deploys on PR. Lighthouse CI on PR.                                                                                                                                                                                                         |
| **Linting**                    | ESLint                               | 8.57+                                         | Code quality, catch errors, enforce conventions              | Next.js config, TypeScript support, accessibility rules (eslint-plugin-jsx-a11y), import order, no-unused-vars.                                                                                                                                                                                                                         |
| **Formatting**                 | Prettier                             | 3.2+                                          | Consistent code formatting                                   | Auto-format on save, integrates with ESLint, Tailwind plugin for class sorting, team consistency.                                                                                                                                                                                                                                       |
| **Type Checking**              | TypeScript Compiler                  | 5.4+ (tsc, bundled with Next.js)              | Static type checking in CI                                   | Runs in GitHub Actions, fails build on type errors, strict mode enabled, composite project for performance.                                                                                                                                                                                                                             |
| **Git Hooks**                  | Husky + lint-staged                  | Husky 9.0+, lint-staged 15.2+                 | Pre-commit linting, type-checking                            | Prevents bad commits (lint errors, type errors), runs Prettier on staged files, fast (only changed files).                                                                                                                                                                                                                              |
| **API Documentation**          | N/A (TypeScript types serve as docs) | N/A                                           | API contracts                                                | Server Actions have TypeScript signatures (self-documenting), REST endpoints documented in architecture.md. Post-MVP: Consider OpenAPI spec if public API.                                                                                                                                                                              |
| **Logging**                    | Vercel Logs + Sentry                 | Built-in + Sentry SDK                         | Structured logging, error aggregation                        | Vercel Logs: console.log output (7-30 day retention). Sentry: Structured logs + breadcrumbs, 90 day retention, searchable.                                                                                                                                                                                                              |
| **Background Jobs**            | Vercel Cron                          | Built-in                                      | Scheduled tasks (change detection, digests, Phase 2 law gen) | Native Vercel integration, cron syntax (`0 8 * * *` for 8am daily), serverless function execution, 10 min max runtime.                                                                                                                                                                                                                  |
| **Feature Flags**              | Vercel Edge Config                   | Built-in                                      | Gradual rollouts, A/B testing, kill switches                 | Low latency (<10ms), globally distributed, update without deploy, free tier (1KB storage). Post-MVP: Consider LaunchDarkly if complex rules needed.                                                                                                                                                                                     |
| **Analytics**                  | Vercel Analytics                     | Built-in                                      | User behavior, page views, conversions                       | Privacy-friendly (no cookies), GDPR compliant, zero config, tracks custom events, free tier (25K events/mo).                                                                                                                                                                                                                            |
| **SEO**                        | Next.js Metadata API                 | Built-in (Next.js 16)                         | Meta tags, Open Graph, structured data                       | Server-side metadata generation, dynamic OG images, sitemap.xml generation for 170K pages, robots.txt.                                                                                                                                                                                                                                  |
| **Accessibility Testing**      | axe DevTools + pa11y CI              | axe 4.8+, pa11y 7.1+                          | Automated accessibility audits                               | axe: Browser extension for manual testing. pa11y: CI integration, fails build on WCAG violations, tests all 170K pages.                                                                                                                                                                                                                 |
| **Rate Limiting**              | Upstash Ratelimit                    | @upstash/ratelimit 1.0+                       | API rate limiting, abuse prevention                          | Distributed rate limiting (Redis-backed), multiple algorithms (sliding window, token bucket), NFR8 requirement (10 req/min per IP), integrates with Upstash Redis.                                                                                                                                                                      |
| **PDF Processing**             | pdf-parse                            | 1.1+                                          | Extract text from PDF files                                  | Parses kollektivavtal PDFs (PRD Story 3.6), extracts text for RAG indexing, Node.js compatible, handles Swedish characters (UTF-8).                                                                                                                                                                                                     |
| **Drag & Drop**                | @dnd-kit/core + @dnd-kit/sortable    | 6.1+                                          | Kanban board drag-and-drop interactions                      | Accessible drag-and-drop (keyboard support), touch-friendly (mobile), collision detection, smooth animations, PRD Epic 6 requirement.                                                                                                                                                                                                   |
| **Date/Time Formatting**       | date-fns                             | 3.3+                                          | Swedish locale date formatting                               | Format dates as "3 timmar sedan", "igår", Swedish month names, timezone handling, tree-shakeable (only import needed functions), smaller bundle than moment.js.                                                                                                                                                                         |
| **Environment Validation**     | @t3-oss/env-nextjs                   | 0.9+                                          | Type-safe environment variable validation                    | Validates .env at build time (fails early vs runtime crashes), Zod-based schema, prevents missing API keys in production, T3 Stack component.                                                                                                                                                                                           |
| **Cron Monitoring**            | Sentry Cron Monitoring               | Built-in (Sentry SDK)                         | Alert on failed/missed cron jobs                             | Tracks cron job execution, alerts if job fails or doesn't run on schedule, integrates with existing Sentry setup, critical for daily change detection.                                                                                                                                                                                  |
| **API Mocking**                | Mock Service Worker (MSW)            | 2.2+                                          | Mock external APIs in tests                                  | Intercepts OpenAI, Stripe, Supabase calls in tests, network-level mocking (works with any HTTP client), prevents test flakiness, avoids API costs in CI.                                                                                                                                                                                |
| **Image Optimization**         | sharp                                | Auto-installed by Next.js                     | Image processing for profile pictures                        | Next.js Image component auto-installs sharp as production dependency, resizes/optimizes user avatars (PRD Story 3.9), WebP conversion, 60% smaller file sizes.                                                                                                                                                                          |
| **Code Coverage**              | c8                                   | Built-in (Vitest)                             | Test coverage reporting                                      | Istanbul-compatible coverage (line, branch, function), integrates with Vitest (`vitest --coverage`), 60-70% coverage target, HTML reports for CI.                                                                                                                                                                                       |

---

## 3.2 Notable Technology Decisions

**Why Next.js App Router (not Pages Router)?**

- Server Components reduce client bundle by 40-60% (law metadata rendered server-side)
- Streaming SSR improves TTFB for 170K law pages (SEO benefit)
- Server Actions eliminate 90% of API routes (type-safe mutations without REST boilerplate)
- React 18+ features (Suspense, Transitions) for better UX
- PRD Story 1.1 explicitly requires App Router

**Why Supabase (not AWS RDS or self-hosted PostgreSQL)?**

- pgvector extension (avoids $70/mo Pinecone until 100K queries/day)
- Integrated Auth (reduces complexity vs. AWS Cognito)
- EU region (GDPR compliance for Swedish users)
- Managed backups, monitoring, point-in-time recovery
- Free tier sufficient for MVP (500MB → paid at Month 6)
- Developer experience: Supabase Studio UI, instant API generation

**Why Upstash Redis (not Redis Labs or AWS ElastiCache)?**

- Serverless pricing: pay-per-request, no idle costs (Vercel-friendly)
- REST API: works with Vercel Edge Functions (no TCP connection required)
- EU region: Frankfurt (GDPR compliance)
- Cost-effective: Free tier (10K req/day) → $20/mo (100K req/day) → saves $6K/mo OpenAI costs via caching
- Alternative (Redis Labs) requires $5/mo minimum + TCP (not Edge-compatible)

**Why Zustand (not Redux, Jotai, or full Context)?**

- Minimal (2KB gzipped) vs. Redux Toolkit (15KB)
- Selective subscriptions prevent Kanban board re-render issues (Context re-renders all consumers)
- Persistence middleware for offline resilience (localStorage)
- Only used for Kanban - React Context sufficient for session/workspace
- Server Components eliminate most client state needs

**Why Hybrid API Approach (Server Actions + REST)?**

- Server Actions: 90% of user mutations (type-safe, no API versioning, automatic revalidation)
- REST: 10% external integrations (webhooks from Stripe/Fortnox, cron jobs, public API)
- tRPC rejected: App Router Server Actions provide similar benefits without library overhead
- GraphQL rejected: Overkill for CRUD operations, adds complexity

**Why LLM Model is TBD (OpenAI vs Anthropic)?**

- **Decision pending testing** - Both OpenAI GPT-4 and Anthropic Claude are viable options
- AI SDK 5.0 provides provider abstraction - can switch models via environment variable
- Key evaluation criteria:
  - Swedish language quality (legal terminology accuracy)
  - Citation accuracy (zero-hallucination requirement)
  - Streaming performance
  - Cost per query at scale
- Options under consideration:
  - OpenAI GPT-4 Turbo: 128K context, function calling, $0.01/1K input
  - Anthropic Claude Sonnet 4: Competitive Swedish support, $0.003/1K input
  - Anthropic Claude Opus 4: Premium quality, higher cost
- Final decision after A/B testing with 100 Swedish legal queries

**Why text-embedding-3-small (not text-embedding-3-large)?**

- 10x cheaper ($0.02/1M vs. $0.13/1M tokens)
- 1536 dimensions (vs. 3072) sufficient for Swedish legal text retrieval accuracy
- At 170K documents: $200 one-time cost vs. $1,300 (saves $1,100)
- Performance tested: <2% accuracy loss vs. large model for legal document retrieval

**Why Playwright (not Cypress)?**

- Cross-browser testing (Chrome, Firefox, Safari) out of box
- Better mobile viewport testing (PRD requires tablet/mobile)
- Trace viewer for debugging CI failures (video, screenshots, network logs)
- Faster test execution (parallel by default)
- TypeScript-first (better DX)

**Why Vercel (not AWS, Azure, self-hosted)?**

- Best-in-class Next.js hosting (zero config SSR, Edge optimization)
- Preview deployments on every PR (invaluable for solo founder velocity)
- Built-in CDN, analytics, cron, Edge Config (no separate services)
- Cost-effective: Free tier → $20/mo Pro → $40/mo at 10K users (vs. $200+ AWS equivalent)
- Instant rollbacks, environment variables UI, Lighthouse CI integration

**Why shadcn/ui (not Material UI, Ant Design, Chakra)?**

- Copy-paste components (not opaque npm package) → full customization
- Radix UI primitives → WCAG 2.1 AA accessibility built-in
- Tailwind-based → consistent with PRD Front-End Spec
- Minimal bundle impact (only copy what you use)
- OpenAI-inspired minimalism compatible (unstyled primitives)
- Material UI rejected: Heavy bundle (300KB+), opinionated design
- Chakra rejected: Theme complexity, not Tailwind-based

**Why Prisma (not Drizzle, TypeORM)?**

- Best TypeScript integration (auto-generated types)
- Schema-first migrations (version controlled)
- Supabase compatibility (PostgreSQL connection pooling)
- Mature ecosystem, large community
- Introspection for brownfield databases
- Drizzle considered: Lighter but less mature, migrations more manual

**Why React Email (not MJML, plain HTML)?**

- Type-safe email templates (TSX components)
- Shared React knowledge (no new syntax like MJML)
- Preview server for local testing
- Version control friendly (readable TSX vs. MJML XML)
- Compiles to HTML for Resend API

**Why pnpm (not npm, yarn)?**

- 3x faster installs than npm (symlink-based)
- Disk space efficient (shared packages across projects)
- Strict mode prevents phantom dependencies (catches missing package.json entries)
- Monorepo-ready (if needed later)
- Growing adoption (Vercel, Next.js use pnpm)

---

## 3.3 Version Update Policy

**Major Version Updates:**

- Require architecture review if breaking changes affect core patterns
- Test in staging environment before production
- Document migration path in docs/migrations/

**Minor/Patch Updates:**

- Apply monthly via Dependabot PRs
- Run full test suite (unit + integration + e2e)
- Review changelog for security fixes, deprecations

**Security Updates:**

- Apply immediately regardless of version
- Monitor GitHub Security Advisories
- Sentry tracks dependency vulnerabilities

**LTS Policy:**

- Next.js: Stay within latest major version (14.x)
- Node.js: Use Active LTS (20.x currently)
- React: Update to latest stable within 3 months
- PostgreSQL: Supabase manages, follow their LTS

---

## 3.4 Development Environment Requirements

**Minimum Requirements:**

- **Node.js:** 20.x LTS (20.11+ recommended, Active LTS)
- **pnpm:** 9.0+
- **Git:** 2.40+
- **Editor:** VS Code (or similar IDE with TypeScript/ESLint support)

**Required VS Code Extensions:**

- `dbaeumer.vscode-eslint` - ESLint integration
- `esbenp.prettier-vscode` - Prettier code formatter
- `bradlc.vscode-tailwindcss` - Tailwind CSS IntelliSense
- `Prisma.prisma` - Prisma schema syntax highlighting
- `ms-playwright.playwright` - Playwright test runner integration
- `usernamehw.errorlens` - Inline error display (recommended)

**TypeScript Path Aliases Configuration:**

```json
// tsconfig.json (already configured)
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/app/*": ["./src/app/*"]
    }
  }
}
```

**ESLint Accessibility Configuration:**

```json
// .eslintrc.json (add to extends array)
{
  "extends": ["next/core-web-vitals", "plugin:jsx-a11y/recommended"],
  "plugins": ["jsx-a11y"]
}
```

**Recommended Setup:**

```bash
# Install Node.js 20 LTS
nvm install 20
nvm use 20

# Install pnpm
npm install -g pnpm@9

# Clone and setup
git clone <repo>
cd laglig_se
pnpm install

# Copy environment template
cp .env.example .env.local

# Generate Prisma client
pnpm prisma generate

# Run dev server
pnpm dev
```

**Required Environment Variables:**

```bash
# Database
DATABASE_URL="postgresql://..."          # Supabase connection string
DIRECT_URL="postgresql://..."           # Supabase direct connection (migrations)

# Authentication
NEXTAUTH_SECRET="..."                   # Generate: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"    # Local dev URL
SUPABASE_URL="https://....supabase.co"
SUPABASE_ANON_KEY="..."

# AI Services
OPENAI_API_KEY="sk-..."

# Redis Cache
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# Email
RESEND_API_KEY="re_..."

# Payments
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Monitoring
NEXT_PUBLIC_SENTRY_DSN="https://..."
SENTRY_AUTH_TOKEN="..."
```

---

## 3.5 Tech Stack Alternatives Considered & Rejected

| Technology    | Alternative Considered                  | Why Rejected                                                                                                                                          |
| ------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js       | Remix, SvelteKit, Nuxt                  | Next.js best Vercel integration, largest community, Server Components maturity                                                                        |
| Supabase      | AWS RDS + Cognito                       | Higher complexity (5+ services), slower setup (weeks vs. days), no pgvector in RDS                                                                    |
| Upstash Redis | Redis Labs, AWS ElastiCache             | Redis Labs: $5/mo minimum + TCP (not Edge compatible). ElastiCache: Requires VPC, no serverless                                                       |
| Zustand       | Redux Toolkit, Jotai, Recoil            | Redux: 15KB bundle (7x larger), boilerplate. Jotai: Atom API complexity. Recoil: Meta-owned, uncertain future                                         |
| OpenAI GPT-4  | Claude Sonnet 3.5, Gemini Pro           | Claude: Slightly worse Swedish. Gemini: No function calling (citations). Open-source: Hallucination risk                                              |
| Vercel        | AWS Amplify, Netlify, Railway           | AWS Amplify: Slower deploys, worse DX. Netlify: No Edge Functions. Railway: Less mature, no preview deploys                                           |
| Playwright    | Cypress, Selenium                       | Cypress: No Safari testing, slower. Selenium: Complex setup, flaky tests, maintenance burden                                                          |
| Prisma        | Drizzle, TypeORM, Kysely                | Drizzle: Less mature, manual migrations. TypeORM: Decorator hell, ActiveRecord pattern not ideal. Kysely: SQL-first (prefer schema-first)             |
| shadcn/ui     | Material UI, Ant Design, Chakra         | Material UI: 300KB bundle, Google aesthetic (not minimal). Ant Design: Chinese design language. Chakra: Theme complexity                              |
| React Email   | MJML, Handlebars, plain HTML            | MJML: New syntax to learn, not React. Handlebars: No type safety. Plain HTML: Tedious, hard to maintain                                               |
| Tailwind CSS  | CSS Modules, Styled Components, Emotion | CSS Modules: More boilerplate. Styled Components: Runtime cost, larger bundle. Emotion: Similar to Styled Components                                  |
| Vitest        | Jest                                    | Jest: Slower, CommonJS issues with ESM, worse TypeScript support. Vitest: Vite-powered, 10x faster, better ESM support                                |
| T3 Stack      | N/A                                     | Considered using create-t3-app starter but rejected: tRPC not ideal for 170K SSR pages (REST/Server Actions better for CDN caching)                   |
| Pinecone      | pgvector (chosen)                       | Pinecone: $70/mo minimum, vendor lock-in. pgvector: Free (included in Supabase), PostgreSQL-native, migrate to Pinecone at 100K queries/day if needed |
| pnpm          | Bun, npm, yarn                          | Bun: Unproven stability (v1.0 just released), potential compatibility issues. npm: 3x slower. yarn: Not as strict as pnpm                             |
| Next.js       | Astro                                   | Astro: Better for content sites (blogs), not for interactive apps. No Server Actions, smaller ecosystem, less mature for full-stack SaaS              |
| Supabase      | Convex                                  | Convex: Opinionated schema (no Prisma), vendor lock-in, $25/mo minimum. Supabase: PostgreSQL-standard, more control, pgvector extension               |

---

## 3.6 License Compliance Policy

**Acceptable Open Source Licenses:**

All dependencies MUST use one of these approved permissive licenses:

- **MIT License** - Most preferred (95% of our dependencies)
- **Apache 2.0** - Acceptable (includes patent grant protection)
- **BSD 2-Clause / BSD 3-Clause** - Acceptable (permissive)
- **ISC License** - Acceptable (similar to MIT)
- **CC0 / Public Domain** - Acceptable (fully permissive)

**Prohibited Licenses (Copyleft / Viral):**

These licenses are **FORBIDDEN** as they require releasing our source code:

- ❌ **GPL (GNU General Public License)** - Any version (v2, v3)
- ❌ **AGPL (Affero GPL)** - Requires source disclosure for SaaS
- ❌ **LGPL (Lesser GPL)** - Restricted, requires dynamic linking
- ❌ **CC BY-SA (ShareAlike)** - Viral copyleft for creative commons
- ❌ **SSPL (Server Side Public License)** - MongoDB's AGPL-like license

**Rationale:**

Laglig.se is a proprietary SaaS product. Copyleft licenses (GPL, AGPL) would legally require us to release our entire codebase as open source, which is incompatible with our business model. All selected dependencies use permissive licenses that allow commercial use without source disclosure requirements.

**License Auditing:**

```bash
# Check licenses of all dependencies
npx license-checker --summary

# Fail CI build if prohibited licenses detected
npx license-checker --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;CC0-1.0;Unlicense"
```

**Review Process:**

1. **Automated CI Check:** GitHub Actions runs `license-checker` on every PR
2. **Manual Review:** New dependencies with unusual licenses require architecture review
3. **Quarterly Audit:** Full license scan every 3 months (documented in docs/licenses/)
4. **Vendor Libraries:** Cloud services (Vercel, Supabase, OpenAI) use commercial licenses (acceptable)

**Exception Process:**

If a critical library uses LGPL (e.g., some PDF parsers):

1. Evaluate alternatives with permissive licenses first
2. If no alternative exists, consult legal counsel
3. Document exception with justification in docs/licenses/exceptions.md
4. Ensure proper dynamic linking (if applicable)

**Current Status:**

✅ All 56 production dependencies audited (January 2025)
✅ 100% use MIT, Apache 2.0, or BSD licenses
✅ No GPL/AGPL violations detected
✅ CI enforcement active in `.github/workflows/license-check.yml`

---
