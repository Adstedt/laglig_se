# 1.3 API Strategy Decision

**✅ CONFIRMED: Hybrid Approach**

**Server Actions (Internal Operations):**

- User authentication flows (login, signup, password reset)
- Form submissions (create law list, update workspace settings)
- Kanban drag-and-drop mutations (move card, update status)
- AI chat interactions (submit question, provide feedback)
- **Benefits:** Type-safe, no API routes, automatic revalidation, better DX

**REST API Routes (External Integrations):**

- Webhooks: `/api/webhooks/stripe`, `/api/webhooks/fortnox`
- Public data API: `/api/public/laws/:id`, `/api/public/search` (for future partners)
- Admin operations: `/api/admin/ingest`, `/api/admin/jobs`
- Cron jobs: `/api/cron/detect-changes`, `/api/cron/send-digests`
- **Benefits:** Standard HTTP, cacheable, external-integration-friendly, Vercel Cron compatible

**Implementation Pattern:**

```typescript
// Server Actions (app/actions/workspace.ts)
'use server'
export async function createWorkspace(formData: FormData) {
  const session = await getSession()
  // Type-safe, runs on server, auto-revalidates
  return prisma.workspace.create({ ... })
}

// REST API (app/api/webhooks/stripe/route.ts)
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  // Standard webhook handling, external access
  return NextResponse.json({ received: true })
}
```

**Rationale:**

- Server Actions for 90% of user-facing mutations (better DX, type safety)
- REST for 10% external/scheduled operations (webhooks, cron, public API)
- No tRPC (avoids complexity, App Router Server Actions are "tRPC-lite")

---
