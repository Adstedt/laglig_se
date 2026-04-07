# 12. Unified Project Structure

## 12.1 Overview

Laglig.se follows a **monorepo architecture** with a single Next.js 16 application containing all frontend, backend, and infrastructure code. This unified structure simplifies deployment, ensures consistent tooling, and eliminates version mismatches between packages.

**Structure Principles:**

- **Feature-based organization:** Components grouped by feature, not type
- **Clear separation of concerns:** app/, lib/, components/ have distinct purposes
- **Co-location:** Keep related files together (tests, styles, types)
- **Minimal nesting:** Maximum 3-4 levels deep for discoverability
- **Convention over configuration:** Predictable file locations

---

## 12.2 Complete Project Structure

```
laglig_se/
├── .github/                      # GitHub configuration
│   ├── workflows/
│   │   ├── ci.yml               # Main CI pipeline
│   │   ├── e2e.yml              # E2E test workflow
│   │   └── cron-monitor.yml     # Cron job monitoring
│   └── CODEOWNERS              # Code ownership rules
│
├── .husky/                      # Git hooks
│   ├── pre-commit              # Lint staged files
│   └── pre-push                # Type check before push
│
├── app/                         # Next.js 16 App Router
│   ├── (public)/               # Public routes (no auth)
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Landing page
│   │   ├── lagar/              # Law pages (170,000+ SSR)
│   │   │   ├── page.tsx        # Law listing
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # Individual law page
│   │   │       └── opengraph-image.tsx
│   │   ├── rattsfall/          # Court cases
│   │   │   └── [court]/[id]/
│   │   │       └── page.tsx
│   │   └── eu/                 # EU legislation
│   │       └── [type]/[id]/
│   │           └── page.tsx
│   │
│   ├── (auth)/                 # Authentication routes
│   │   ├── layout.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── reset-password/
│   │       └── page.tsx
│   │
│   ├── (workspace)/             # Protected workspace routes (auth required)
│   │   ├── layout.tsx           # Workspace shell with sidebar
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── onboarding/          # Dynamic onboarding flow
│   │   │   └── page.tsx
│   │   ├── browse/              # Law browsing and catalogue
│   │   │   └── ...
│   │   ├── filer/               # File management
│   │   │   └── ...
│   │   ├── workspace/           # Workspace-scoped features
│   │   │   ├── styrdokument/    # Document management (Epic 17)
│   │   │   │   └── [documentId]/
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   └── ...
│   │   └── ...
│   │
│   ├── admin/                   # Admin backoffice (Epic 11)
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── workspaces/
│   │   │   │   └── page.tsx
│   │   │   ├── users/
│   │   │   │   └── page.tsx
│   │   │   └── cron/
│   │   │       └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── api/                    # API routes
│   │   ├── webhooks/
│   │   │   ├── stripe/
│   │   │   │   └── route.ts
│   │   │   └── fortnox/
│   │   │       └── route.ts
│   │   ├── cron/
│   │   │   ├── check-law-changes/
│   │   │   │   └── route.ts
│   │   │   └── generate-phase2-laws/
│   │   │       └── route.ts
│   │   ├── chat/
│   │   │   └── route.ts        # AI chat endpoint
│   │   └── public/
│   │       └── health/
│   │           └── route.ts
│   │
│   ├── actions/                # Server Actions (27 files)
│   │   ├── auth.ts
│   │   ├── admin-*.ts          # Admin actions (5 files, Epic 11)
│   │   ├── browse.ts
│   │   ├── change-assessment.ts # Epic 14
│   │   ├── change-events.ts    # Epic 14
│   │   ├── company-profile.ts  # Epic 15
│   │   ├── documents.ts        # Epic 17
│   │   ├── document-list.ts    # Epic 17
│   │   ├── workspace.ts
│   │   ├── ai-chat.ts
│   │   └── ...                 # See 5-api-specification.md for full list
│   │
│   ├── layout.tsx              # Root layout
│   ├── global-error.tsx       # Global error boundary
│   └── not-found.tsx          # 404 page
│
├── components/                  # React components
│   ├── ui/                     # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx
│   │   └── ...
│   │
│   ├── features/               # Feature-specific components
│   │   ├── onboarding/
│   │   │   └── ...
│   │   ├── ai-chat/            # Chat UI with streaming + reasoning
│   │   │   └── ...
│   │   ├── document-list/      # Law list management
│   │   │   └── ...
│   │   ├── documents/          # Document management (Epic 17)
│   │   │   ├── editor/         # Tiptap editor components
│   │   │   │   ├── document-editor.tsx
│   │   │   │   ├── editor-toolbar.tsx
│   │   │   │   ├── slash-command.tsx
│   │   │   │   └── ...
│   │   │   ├── document-filters.tsx
│   │   │   ├── document-status-badge.tsx
│   │   │   └── create-document-dialog.tsx
│   │   ├── compliance/         # Compliance workspace
│   │   │   └── ...
│   │   ├── templates/          # Template catalog (Epic 12)
│   │   │   └── ...
│   │   ├── admin/              # Admin backoffice (Epic 11)
│   │   │   └── ...
│   │   └── workspace/
│   │       └── ...
│   │
│   ├── shared/                 # Shared components
│   │   ├── navigation/
│   │   │   ├── main-nav.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── breadcrumbs.tsx
│   │   ├── notifications/
│   │   │   ├── notification-bell.tsx
│   │   │   └── notification-list.tsx
│   │   ├── seo/
│   │   │   └── meta-tags.tsx
│   │   └── analytics/
│   │       └── tracking.tsx
│   │
│   └── providers/              # React Context providers
│       ├── session-provider.tsx
│       ├── workspace-provider.tsx
│       ├── theme-provider.tsx
│       └── analytics-provider.tsx
│
├── lib/                        # Library code
│   ├── db/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── queries/
│   │       ├── law.ts
│   │       ├── user.ts
│   │       ├── workspace.ts
│   │       └── employee.ts
│   │
│   ├── agent/                  # AI Compliance Agent (Epic 14)
│   │   ├── system-prompt.ts   # Agent instructions
│   │   ├── tools/             # 8+ agent tools
│   │   └── skills/            # Headless agent skills
│   │
│   ├── agency/                 # Agency regulation ingestion (Epic 9)
│   │   ├── afs-scraper.ts
│   │   ├── afs-html-transformer.ts
│   │   └── afs-chapter-splitter.ts
│   │
│   ├── bolagsapi/              # BolagsAPI integration (Epic 15)
│   │   └── ...
│   │
│   ├── documents/              # Document processing (Epic 17)
│   │   ├── docx-to-tiptap.ts
│   │   ├── tiptap-to-docx.ts
│   │   └── tiptap-to-pdf.ts
│   │
│   ├── auth/
│   │   ├── auth-options.ts    # NextAuth config
│   │   ├── session.ts         # Session helpers
│   │   └── rbac.ts           # Role-based access
│   │
│   ├── cache/
│   │   ├── redis.ts           # Upstash Redis client
│   │   └── strategies.ts      # Cache patterns
│   │
│   ├── external/
│   │   ├── riksdagen.ts       # Riksdagen API
│   │   ├── domstolsverket.ts  # Court API
│   │   ├── eurlex.ts          # EU legislation API
│   │   ├── bolagsverket.ts    # Company data API
│   │   ├── stripe.ts          # Stripe client
│   │   └── resend.ts          # Email client
│   │
│   ├── utils/
│   │   ├── cn.ts              # className helper
│   │   ├── format.ts          # Formatters
│   │   ├── validation.ts      # Zod schemas
│   │   └── constants.ts       # App constants
│   │
│   └── hooks/                 # Custom React hooks
│       ├── use-workspace.ts
│       ├── use-auth.ts
│       ├── use-debounce.ts
│       └── use-media-query.ts
│
├── prisma/                     # Database schema
│   ├── schema.prisma          # Main schema file
│   ├── migrations/            # Migration files
│   │   └── ...
│   └── seed.ts               # Seed script
│
├── public/                     # Static files
│   ├── favicon.ico
│   ├── robots.txt
│   ├── sitemap.xml            # Generated
│   └── images/
│       ├── logo.svg
│       └── og-image.png
│
├── scripts/                    # Build & maintenance scripts
│   ├── generate-sitemap.ts   # Sitemap generator
│   ├── ingest-laws.ts        # Law ingestion script
│   ├── generate-embeddings.ts # Embedding generation
│   └── check-licenses.ts     # License compliance
│
├── styles/                     # Global styles
│   └── globals.css            # Tailwind directives
│
├── tests/                      # Test files
│   ├── unit/
│   │   ├── lib/
│   │   └── components/
│   ├── integration/
│   │   ├── api/
│   │   └── actions/
│   └── e2e/
│       ├── onboarding.spec.ts
│       ├── kanban.spec.ts
│       └── ai-chat.spec.ts
│
├── types/                      # TypeScript types
│   ├── next-auth.d.ts         # NextAuth type extensions
│   ├── environment.d.ts       # Environment variables
│   └── global.d.ts           # Global type definitions
│
├── emails/                     # React Email templates
│   ├── welcome.tsx
│   ├── law-change.tsx
│   ├── invite.tsx
│   └── digest.tsx
│
├── docs/                       # Documentation
│   ├── PRD.md                # Product requirements
│   ├── architecture.md       # This document
│   ├── api.md                # API documentation
│   └── deployment.md         # Deployment guide
│
├── .env.example               # Environment template
├── .eslintrc.json            # ESLint config
├── .gitignore
├── .prettierrc               # Prettier config
├── docker-compose.yml        # Local services
├── middleware.ts             # Next.js middleware
├── next.config.js           # Next.js config
├── package.json
├── pnpm-lock.yaml
├── README.md
├── tailwind.config.ts       # Tailwind config
├── tsconfig.json           # TypeScript config
└── vitest.config.ts        # Vitest config
```

---

## 12.3 Directory Purposes

### Core Directories

**`app/`** - Next.js 16 App Router

- Contains all routes, layouts, and API endpoints
- Follows file-based routing convention
- Server Components by default

**`components/`** - React Components

- `ui/` - Base UI components (buttons, inputs)
- `features/` - Feature-specific components
- `shared/` - Components used across features
- `providers/` - React Context providers

**`lib/`** - Core Business Logic

- Database queries, external APIs, utilities
- No React dependencies (pure TypeScript)
- Reusable across server and client

**`prisma/`** - Database Layer

- Schema definition and migrations
- Type generation for TypeScript
- Seed scripts for development

### Supporting Directories

**`scripts/`** - Build & Maintenance

- One-time scripts (data ingestion)
- Build-time scripts (sitemap generation)
- Maintenance scripts (license checking)

**`tests/`** - Test Suite

- Mirrors source structure
- Co-located with features
- E2E tests for critical paths

**`types/`** - TypeScript Definitions

- Global type extensions
- Third-party module declarations
- Shared interfaces

**`emails/`** - Email Templates

- React Email components
- Type-safe email templates
- Preview server support

---

## 12.4 File Naming Conventions

```typescript
// Components - PascalCase
components / features / kanban / KanbanBoard.tsx
components / ui / Button.tsx

// Utilities - camelCase
lib / utils / formatDate.ts
lib / auth / getSession.ts

// Server Actions - camelCase
app / actions / updateLawStatus.ts

// API Routes - lowercase with hyphens
app / api / webhooks / stripe / route.ts
app / api / cron / check - law - changes / route.ts

// Types - PascalCase for types/interfaces
types / User.ts
types / Workspace.ts

// Constants - UPPER_SNAKE_CASE
lib / utils / constants.ts
export const MAX_FILE_SIZE = 10485760

// Hooks - camelCase with 'use' prefix
lib / hooks / useWorkspace.ts
lib / hooks / useDebounce.ts

// Test files - same name with .test or .spec
components / features / kanban / KanbanBoard.test.tsx
app / api / webhooks / stripe / route.test.ts
```

---

## 12.5 Import Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/app/*": ["./app/*"],
      "@/types/*": ["./types/*"],
      "@/hooks/*": ["./lib/hooks/*"],
      "@/utils/*": ["./lib/utils/*"],
      "@/styles/*": ["./styles/*"]
    }
  }
}
```

**Usage:**

```typescript
// Instead of:
import { Button } from '../../../components/ui/button'
import { getSession } from '../../../lib/auth/session'

// Use:
import { Button } from '@/components/ui/button'
import { getSession } from '@/lib/auth/session'
```

---

## 12.6 Environment Files

```bash
# Development
.env.local              # Local development variables
.env.development        # Development defaults

# Testing
.env.test              # Test environment

# Production
.env.production        # Production defaults (committed)
.env.production.local  # Production secrets (not committed)

# Example structure
.env.example           # Template for all required vars
```

**Variable Naming:**

```bash
# Public variables (exposed to client)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SENTRY_DSN=https://...

# Server-only variables
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_...

# Service URLs
SUPABASE_URL=https://...
UPSTASH_REDIS_REST_URL=https://...
```

---

## 12.7 Configuration Files

**`next.config.js`** - Next.js Configuration

```javascript
module.exports = {
  experimental: {
    dynamicIO: true,
    typedRoutes: true,
  },
  images: {
    domains: ['supabase.co'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}
```

**`tailwind.config.ts`** - Tailwind Configuration

```typescript
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
    },
  },
}
```

**`middleware.ts`** - Authentication & Routing

```typescript
export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*', '/hr/:path*', '/settings/:path*'],
}
```

---

## 12.8 Development vs Production Structure

**Development Only:**

```
├── .env.local             # Local secrets
├── docker-compose.yml     # Local PostgreSQL, Redis
├── tests/                 # Test files
├── scripts/dev/          # Development scripts
└── prisma/seed.ts        # Seed data
```

**Production Build Output:**

```
.next/
├── cache/                # Build cache
├── server/              # Server-side code
├── static/              # Static assets
└── BUILD_ID            # Deployment version
```

**Deployment Structure (Vercel):**

```
- Automatic from GitHub
- Environment variables via Vercel UI
- Serverless functions from app/api/
- Edge functions for middleware
- Static assets on CDN
```

---

## 12.9 Monorepo Benefits

**Why Monorepo for Laglig.se:**

1. **Single deployment unit** - No version mismatches
2. **Shared TypeScript types** - End-to-end type safety
3. **Unified tooling** - One ESLint, Prettier, TypeScript config
4. **Simplified CI/CD** - Single pipeline
5. **Atomic changes** - Frontend/backend changes in one PR

**Trade-offs Considered:**

- ✅ Simpler than Turborepo/Lerna for single app
- ✅ No package versioning complexity
- ❌ Can't scale to multiple apps (acceptable for MVP)
- ❌ Larger clone size (mitigated by shallow clones)

---
