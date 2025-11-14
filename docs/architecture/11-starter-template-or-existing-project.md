# 1.1 Starter Template or Existing Project

**Status:** Greenfield project - No starter template used

**Evaluated Options:**

1. **T3 Stack (create-t3-app)** - Next.js + tRPC + Prisma + Tailwind + NextAuth
   - ❌ **Rejected:** tRPC optimized for client-side mutations, not ideal for 170K SSR pages (REST/Server Actions better for CDN caching)
   - ✅ **Adopted pieces:** Prisma, Tailwind, NextAuth patterns (but not full T3 structure)

2. **Vercel Next.js Templates** - Various Vercel-maintained starters
   - ❌ **Rejected:** Generic blog/commerce templates don't address RAG, vector search, or legal content architecture

3. **Custom Architecture** ✅ **Selected**
   - Optimized for SEO-heavy content sites with AI
   - Addresses Swedish legal domain specifics (language, GDPR, multi-content-type database)
   - Allows clean integration of pgvector without template constraints

**Key Constraints from PRD:**

- **Platform:** Vercel (deployment) + Supabase (database + auth) - PRD Story 1.2, 1.3
- **Framework:** Next.js 16 App Router (not Pages Router) - PRD Story 1.1
- **Database:** PostgreSQL with pgvector extension - PRD Story 3.1
- **Monolith Structure:** Single Next.js application - PRD Repository Structure section

**Architectural Freedom:**

- Component organization patterns (PRD references shadcn/ui but not structure)
- State management (Zustand suggested, React Context also viable)
- Testing approach (Vitest + Playwright specified, but coverage targets flexible)

**Decision:** Proceed with custom architecture, borrowing patterns from T3 Stack (Prisma, type-safety) but not full template.

---
