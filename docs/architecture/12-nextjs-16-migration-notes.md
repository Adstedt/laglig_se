# 1.2 Next.js 16 Migration Notes

**Framework Version:** Next.js 16 (stable) with React 19

**Key Benefits for Laglig.se:**

- **Turbopack by Default:** 2-5× faster production builds, critical for 170,000+ pages
- **Explicit Caching with "use cache":** Better control for law pages vs dynamic content
- **Improved Performance:** Up to 10× faster Fast Refresh during development
- **Node.js 20.9+ Required:** Upgraded from Node.js 18.18+ requirement

**Critical Breaking Changes:**

```typescript
// Async params and searchParams (applies to ALL routes)
// BEFORE (Next.js 14/15)
export default function Page({ params, searchParams }) {
  const id = params.id // Synchronous
}

// AFTER (Next.js 16) - REQUIRED PATTERN
export default async function Page({ params, searchParams }) {
  const { id } = await params // Must await
  const query = await searchParams // Must await
}
```

**Other Breaking Changes:**

- **Image Optimization:** Default cache TTL increased to 4 hours (from 60 seconds)
- **Parallel Routes:** All slots require explicit `default.js` files
- **Middleware:** Consider renaming `middleware.ts` → `proxy.ts` (old name still works)

**Migration Tool:** Use `npx @next/codemod@canary upgrade latest` for automated updates

---
