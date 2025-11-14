# Section 9 Summary

The database schema now includes **45+ entities** supporting all **38 workflows** identified in Section 8:

✅ **Complete Coverage:**

- All user stories from PRD have corresponding database support
- Every workflow can be implemented with current schema
- No missing entities for MVP features

✅ **Key Design Patterns:**

- **Multi-tenancy:** Workspace-based isolation
- **Soft deletes:** Status fields for recovery
- **JSON flexibility:** Metadata and context storage
- **Vector search:** pgvector for AI/RAG features
- **Audit trails:** Complete activity tracking
- **Session-based onboarding:** Redis for temporary data

✅ **Performance Optimized:**

- Strategic indexes for common queries
- Denormalized fields where appropriate
- Cached data in JSON columns
- Vector embeddings pre-computed

✅ **Scalability Ready:**

- Prepared for millions of laws
- Supports thousands of workspaces
- Background job processing
- Usage tracking for billing

The schema is now **100% aligned** with all PRD requirements and workflows.

---## 10. Frontend Architecture

## 10.1 Overview

The Laglig.se frontend architecture leverages **Next.js 16 App Router** with **React Server Components (RSC)** as the foundation, optimizing for both **SEO performance** (170,000+ SSR pages) and **interactive user experiences** (drag-and-drop Kanban, real-time AI chat). The architecture follows a **component-first approach** with clear separation between server and client components, minimizing JavaScript bundle size while maximizing interactivity where needed.

**Core Principles:**

- **Server-First Rendering:** Default to RSC, use client components only when necessary
- **Progressive Enhancement:** SSR content works without JavaScript, enhance with interactivity
- **Component Composition:** Small, focused components composed into features
- **Type Safety:** Full TypeScript coverage with strict mode
- **Performance Obsessed:** Sub-2s load times for all pages

---

## 10.2 Component Architecture

### 10.2.1 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                     App Layout (RSC)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Navigation (Client)                 │    │
│  │  - Workspace Switcher                               │    │
│  │  - User Menu                                        │    │
│  │  - Notification Bell                                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Page (RSC)                        │    │
│  │  ┌──────────────┐  ┌──────────────────────────┐    │    │
│  │  │ Sidebar      │  │    Main Content          │    │    │
│  │  │ (Conditional)│  │    (Page Specific)       │    │    │
│  │  │              │  │                          │    │    │
│  │  │ - Law Lists  │  │  ┌──────────────────┐   │    │    │
│  │  │ - HR Menu    │  │  │ Feature Component │   │    │    │
│  │  │ - Settings   │  │  │   (RSC/Client)    │   │    │    │
│  │  │              │  │  └──────────────────┘   │    │    │
│  │  └──────────────┘  └──────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              AI Chat Sidebar (Client)               │    │
│  │  - Drag & Drop Context                              │    │
│  │  - Message History                                  │    │
│  │  - Streaming Responses                              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 10.2.2 Component Categories

**1. Layout Components (Server Components)**

```typescript
// app/layout.tsx
export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  // Server-side data fetching
  const session = await getServerSession()

  return (
    <html>
      <body>
        <SessionProvider session={session}>
          <Navigation /> {/* Client Component */}
          {children}
          <AIChatSidebar /> {/* Client Component */}
        </SessionProvider>
      </body>
    </html>
  )
}
```

**2. Page Components (Server Components)**

```typescript
// app/lagar/[id]/page.tsx
"use cache" // Next.js 16 explicit caching

export default async function LawPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params // Next.js 16 async params
  const law = await fetchLaw(id)

  return (
    <>
      <LawHeader law={law} />
      <LawContent law={law} />
      <RelatedDocuments lawId={id} />
      <ChangeHistory lawId={id} />
    </>
  )
}
```

**3. Interactive Components (Client Components)**

```typescript
// components/kanban/kanban-board.tsx
"use client"

import { DndContext } from '@dnd-kit/core'
import { useKanbanStore } from '@/stores/kanban'

export function KanbanBoard() {
  const { columns, moveCard } = useKanbanStore()

  return (
    <DndContext onDragEnd={handleDragEnd}>
      {/* Drag & drop implementation */}
    </DndContext>
  )
}
```

**4. Hybrid Components (Partial Prerendering)**

```typescript
// components/dashboard/compliance-widget.tsx
export async function ComplianceWidget() {
  const stats = await getComplianceStats() // Server

  return (
    <div>
      <ComplianceChart stats={stats} /> {/* Static */}
      <RefreshButton /> {/* Client - only this hydrates */}
    </div>
  )
}
```

### 10.2.3 Component Organization

```
components/
├── ui/                         # shadcn/ui base components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
├── features/                   # Feature-specific components
│   ├── onboarding/
│   │   ├── onboarding-wizard.tsx
│   │   ├── company-lookup.tsx
│   │   └── question-flow.tsx
│   ├── kanban/
│   │   ├── kanban-board.tsx
│   │   ├── kanban-card.tsx
│   │   └── kanban-column.tsx
│   ├── ai-chat/
│   │   ├── chat-interface.tsx
│   │   ├── message-list.tsx
│   │   └── context-panel.tsx
│   └── law-list/
│       ├── law-card.tsx
│       ├── law-list.tsx
│       └── law-filters.tsx
├── shared/                     # Shared across features
│   ├── navigation/
│   ├── notifications/
│   └── workspace-switcher/
└── providers/                  # React Context providers
    ├── session-provider.tsx
    ├── workspace-provider.tsx
    └── theme-provider.tsx
```

---

## 10.3 State Management Strategy

### 10.3.1 State Categories

**1. Server State (React Server Components)**

- Law content, user data, workspace settings
- Fetched server-side, passed as props
- No client-side state needed

**2. URL State (Next.js 16 Routing)**

- Filters, search params, pagination
- Managed via `searchParams` and router
- Shareable, bookmarkable

**3. Session State (React Context)**

- User session, workspace context, permissions
- Slow-changing, needed globally
- Wrapped at root layout

**4. UI State (Component State)**

- Form inputs, modals, tooltips
- Local to component
- React `useState`

**5. Feature State (Zustand)**

- Kanban board, drag-and-drop
- Complex state with actions
- Selective subscriptions

### 10.3.2 Implementation Patterns

**Server State Pattern**

```typescript
// No client-side fetching needed
export default async function LawListPage() {
  const laws = await db.law.findMany()
  return <LawList laws={laws} />
}
```

**URL State Pattern**

```typescript
// app/lagar/page.tsx
export default async function LawsPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string, search?: string }>
}) {
  const { category, search } = await searchParams
  const laws = await fetchLaws({ category, search })

  return (
    <>
      <LawFilters /> {/* Updates URL */}
      <LawGrid laws={laws} />
    </>
  )
}
```

**Session State Pattern**

```typescript
// providers/session-provider.tsx
"use client"

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({
  children,
  session
}: {
  children: React.ReactNode
  session: Session | null
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  )
}
```

**Feature State Pattern (Zustand)**

```typescript
// stores/kanban.ts
import { create } from 'zustand'

interface KanbanStore {
  columns: Column[]
  cards: Card[]
  moveCard: (cardId: string, columnId: string) => void
  optimisticUpdate: (update: Update) => void
  rollback: (updateId: string) => void
}

export const useKanbanStore = create<KanbanStore>((set) => ({
  columns: [],
  cards: [],
  moveCard: async (cardId, columnId) => {
    // Optimistic update
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === cardId ? { ...card, columnId } : card
      ),
    }))

    // Server update
    try {
      await updateCardColumn(cardId, columnId)
    } catch {
      // Rollback on error
      set((state) => ({
        /* rollback logic */
      }))
    }
  },
}))
```

---

## 10.4 Routing Architecture

### 10.4.1 Route Structure

```
app/
├── (public)/                   # Public routes (no auth)
│   ├── page.tsx               # Landing page
│   ├── lagar/                 # 170,000+ law pages
│   │   ├── page.tsx           # Law listing
│   │   └── [id]/
│   │       └── page.tsx       # Individual law (SSR)
│   ├── rattsfall/             # Court cases
│   │   └── [court]/[id]/
│   │       └── page.tsx       # Court case page
│   └── eu/                    # EU legislation
│       └── [type]/[id]/
│           └── page.tsx       # EU document page
├── (auth)/                    # Auth routes
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── reset-password/page.tsx
├── (app)/                     # Protected app routes
│   ├── dashboard/page.tsx
│   ├── kanban/page.tsx
│   ├── ai-chat/page.tsx
│   ├── hr/
│   │   ├── employees/page.tsx
│   │   └── [id]/page.tsx
│   └── settings/
│       ├── page.tsx
│       ├── workspace/page.tsx
│       └── billing/page.tsx
└── api/                       # API routes
    ├── webhooks/
    ├── cron/
    └── public/
```

### 10.4.2 Routing Patterns

**1. Dynamic Routes with Caching**

```typescript
// app/lagar/[id]/page.tsx
'use cache'
export const revalidate = 3600 // 1 hour

export async function generateStaticParams() {
  // Pre-generate top 1000 most viewed laws
  const laws = await getTopLaws(1000)
  return laws.map((law) => ({ id: law.id }))
}
```

**2. Parallel Routes for Modals**

```typescript
// app/(app)/@modal/law/[id]/page.tsx
export default function LawModal({ params }) {
  // Renders as modal overlay
  return <Modal><LawDetail id={params.id} /></Modal>
}
```

**3. Route Groups for Layout Sharing**

```typescript
// app/(app)/layout.tsx - Shared for all app routes
export default function AppLayout({ children }) {
  return (
    <div className="flex">
      <Sidebar />
      <main>{children}</main>
      <AIChatPanel />
    </div>
  )
}
```

**4. Intercepting Routes for Quick Preview**

```typescript
// app/(.)lagar/[id]/page.tsx
// Intercepts law links to show preview modal
export default function LawPreview({ params }) {
  return <QuickPreviewModal lawId={params.id} />
}
```

---

## 10.5 Data Fetching Strategy

### 10.5.1 Fetching Patterns

**1. Server Components (Default)**

```typescript
// Direct database access in components
export default async function LawList() {
  const laws = await prisma.law.findMany({
    where: { status: 'ACTIVE' },
    take: 50
  })
  return <LawGrid laws={laws} />
}
```

**2. Server Actions (Mutations)**

```typescript
// app/actions/law.ts
'use server'

export async function updateLawStatus(lawId: string, status: string) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')

  return await prisma.lawInWorkspace.update({
    where: { id: lawId },
    data: { status },
  })
}
```

**3. Client-Side Fetching (Real-time)**

```typescript
// For WebSocket connections, polling
"use client"
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function NotificationBell() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('notifications')
      .on('INSERT', () => setCount(c => c + 1))
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [])

  return <Bell count={count} />
}
```

**4. Streaming (AI Responses)**

```typescript
// components/ai-chat/chat.tsx
"use client"
import { useChat } from 'ai/react'

export function AIChat() {
  const { messages, input, handleSubmit } = useChat({
    api: '/api/chat',
    onFinish: (message) => {
      // Handle completed stream
    }
  })

  return (
    <form onSubmit={handleSubmit}>
      <MessageList messages={messages} />
      <ChatInput value={input} />
    </form>
  )
}
```

### 10.5.2 Caching Strategy

```typescript
// Per Next.js 16 caching controls
"use cache"                    // Opt-in caching for law pages
export const revalidate = 3600 // Time-based revalidation

// On-demand revalidation
import { revalidatePath, revalidateTag } from 'next/cache'

export async function updateLaw(id: string) {
  // Update database
  await prisma.law.update(...)

  // Invalidate cache
  revalidatePath(`/lagar/${id}`)
  revalidateTag('laws')
}
```

---

## 10.6 Performance Optimization

### 10.6.1 Bundle Optimization

**1. Code Splitting**

```typescript
// Dynamic imports for heavy components
const PDFViewer = dynamic(() => import('@/components/pdf-viewer'), {
  loading: () => <Skeleton />,
  ssr: false // Client-only component
})
```

**2. Tree Shaking**

```typescript
// Import only what's needed
import { Calendar } from 'lucide-react' // ✅
// Not: import * as Icons from 'lucide-react' // ❌
```

**3. Bundle Analysis**

```json
// package.json
{
  "scripts": {
    "analyze": "ANALYZE=true next build"
  }
}
```

### 10.6.2 Image Optimization

```typescript
// Use Next.js Image component
import Image from 'next/image'

export function EmployeeAvatar({ src, alt }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={50}
      height={50}
      className="rounded-full"
      loading="lazy"
      placeholder="blur"
      blurDataURL={shimmer}
    />
  )
}
```

### 10.6.3 Font Optimization

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
})

export default function Layout({ children }) {
  return (
    <html className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

### 10.6.4 Prefetching Strategy

```typescript
// Automatic prefetching for visible links
<Link href="/lagar/SFS-1977-1160" prefetch={true}>
  Arbetsmiljölagen
</Link>

// Manual prefetching for likely navigation
import { useRouter } from 'next/navigation'

function OnboardingStep() {
  const router = useRouter()

  useEffect(() => {
    // Prefetch next step
    router.prefetch('/onboarding/step-2')
  }, [])
}
```

---

## 10.7 Error Handling

### 10.7.1 Error Boundaries

```typescript
// app/error.tsx - Catches client errors
"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to error reporting
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <h2>Något gick fel!</h2>
      <button onClick={reset}>Försök igen</button>
    </div>
  )
}
```

### 10.7.2 Not Found Pages

```typescript
// app/not-found.tsx
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold">404</h1>
      <p>Sidan kunde inte hittas</p>
      <Link href="/">Tillbaka till startsidan</Link>
    </div>
  )
}
```

### 10.7.3 Loading States

```typescript
// app/lagar/loading.tsx
export default function Loading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[...Array(9)].map((_, i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
  )
}
```

---

## 10.8 Accessibility Implementation

### 10.8.1 Semantic HTML

```typescript
// Use proper HTML elements
export function LawCard({ law }) {
  return (
    <article className="law-card">
      <header>
        <h2>{law.title}</h2>
      </header>
      <section>{law.summary}</section>
      <footer>
        <time dateTime={law.publishedDate}>
          {formatDate(law.publishedDate)}
        </time>
      </footer>
    </article>
  )
}
```

### 10.8.2 ARIA Labels

```typescript
// Provide context for screen readers
export function NotificationBell({ count }) {
  return (
    <button
      aria-label={`${count} olästa meddelanden`}
      aria-live="polite"
      aria-atomic="true"
    >
      <Bell />
      {count > 0 && <span className="sr-only">{count} nya</span>}
    </button>
  )
}
```

### 10.8.3 Keyboard Navigation

```typescript
// Ensure keyboard accessibility
export function KanbanCard({ card, onSelect }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(card)
        }
      }}
      onClick={() => onSelect(card)}
    >
      {card.title}
    </div>
  )
}
```

---

## 10.9 Internationalization (i18n)

While the MVP focuses on Swedish, the architecture supports future internationalization:

```typescript
// lib/i18n.ts
const dictionaries = {
  sv: () => import('./dictionaries/sv.json').then((m) => m.default),
  en: () => import('./dictionaries/en.json').then((m) => m.default),
}

export const getDictionary = async (locale: string) => {
  return dictionaries[locale]?.() ?? dictionaries.sv()
}

// app/[lang]/layout.tsx
export default async function Layout({
  children,
  params
}: {
  children: React.ReactNode
  params: { lang: string }
}) {
  const dict = await getDictionary(params.lang)

  return (
    <html lang={params.lang}>
      <body>{children}</body>
    </html>
  )
}
```

---

## 10.10 Testing Strategy

### 10.10.1 Component Testing

```typescript
// __tests__/components/law-card.test.tsx
import { render, screen } from '@testing-library/react'
import { LawCard } from '@/components/law-card'

describe('LawCard', () => {
  it('renders law title and number', () => {
    const law = {
      title: 'Arbetsmiljölagen',
      documentNumber: 'SFS 1977:1160'
    }

    render(<LawCard law={law} />)

    expect(screen.getByText('Arbetsmiljölagen')).toBeInTheDocument()
    expect(screen.getByText('SFS 1977:1160')).toBeInTheDocument()
  })
})
```

### 10.10.2 Integration Testing

```typescript
// __tests__/integration/onboarding.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingFlow from '@/app/onboarding/page'

test('complete onboarding flow', async () => {
  const user = userEvent.setup()
  render(<OnboardingFlow />)

  // Enter org number
  await user.type(screen.getByLabelText('Organisationsnummer'), '556677-8899')
  await user.click(screen.getByText('Nästa'))

  // Answer questions
  await waitFor(() => {
    expect(screen.getByText('Har ni kollektivavtal?')).toBeInTheDocument()
  })

  // ... rest of flow
})
```

---

## 10.11 Frontend Security

### 10.11.1 XSS Prevention

```typescript
// React automatically escapes content
// Dangerous HTML requires explicit opt-in
export function LawContent({ html }) {
  // Only use with trusted, sanitized content
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(html)
      }}
    />
  )
}
```

### 10.11.2 CSRF Protection

```typescript
// Server Actions have built-in CSRF protection
// Additional protection for API routes
import { csrf } from '@/lib/csrf'

export async function POST(request: Request) {
  await csrf.verify(request)
  // Handle request
}
```

### 10.11.3 Content Security Policy

```typescript
// next.config.js
const csp = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'connect-src': ["'self'", 'https://api.openai.com'],
}

module.exports = {
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: Object.entries(csp)
            .map(([key, values]) => `${key} ${values.join(' ')}`)
            .join('; '),
        },
      ],
    },
  ],
}
```

---
