# 4. Technical Constraints and Integration Requirements

## 4.1 Existing Technology Stack

**Languages:** TypeScript (strict), JavaScript (minimal)
**Frameworks:** Next.js 15 (App Router) with React Server Components + Server Actions, React 19, SWR for client-side caching
**Database:** PostgreSQL via Prisma ORM; Supabase hosted
**Infrastructure:** Vercel-hosted Next.js app, Supabase Postgres, Redis for caching (selective), Anthropic Claude API for AI features
**External Dependencies:** `@anthropic-ai/sdk`, `zod`, `date-fns`, shadcn/ui component set, `streamdown` + `@streamdown/code` for markdown, Swedish government data feeds (SFS, agency föreskrifter)

## 4.2 Integration Approach

**Database Integration Strategy:** Additive Prisma schema changes only. Five new tables with proper FK relations to `LawList`, `LawListItem`, `LawListItemRequirement`, `User`, `Workspace`, `Task`. One back-reference nullable column on `Task` (`compliance_finding_id`). Migration is reversible. All new tables follow existing naming conventions (snake_case DB, camelCase TS).

**API Integration Strategy:** New server actions under `app/actions/compliance-audit-cycle.ts`, `app/actions/compliance-audit-item.ts`, `app/actions/compliance-finding.ts`, `app/actions/compliance-audit-report.ts`. All actions wrap `withWorkspace()` and `hasPermission()` following existing patterns in `law-list-item-requirements.ts`. No REST API route added — server actions only, consistent with current architecture.

**Frontend Integration Strategy:** New route segment `/laglistor/kontroller/**` with RSC data-fetching for page-level reads and SWR for interactive mutations. SWR keys: `compliance-audit-cycles:${workspaceId}`, `compliance-audit-cycle:${cycleId}`, `compliance-audit-items:${cycleId}`, `compliance-findings:${cycleId}`. Cross-cache invalidation via `globalMutate` on relevant keys when linked artifacts or source LawListItem status change. Reuse of `compliance-detail-table` components and existing `LinkedArtifactsPanel`.

**Testing Integration Strategy:** Vitest unit tests for server actions + canonicalisation routine; React Testing Library component tests for the scope selector, bedömning editor, and seal confirmation dialog; Playwright end-to-end tests covering the critical paths (create cycle → set bedömning → sign off all → complete → seal → download PDF). Existing test infrastructure and patterns apply; no new test framework.

## 4.3 Code Organization and Standards

**File Structure Approach:**

```
app/actions/
  compliance-audit-cycle.ts
  compliance-audit-item.ts
  compliance-finding.ts
  compliance-audit-report.ts
  compliance-evidence-snapshot.ts

app/(workspace)/laglistor/kontroller/
  page.tsx                              (list view)
  skapa/page.tsx                        (creation wizard)
  [cycleId]/page.tsx                    (detail page with tabs)
  [cycleId]/rapport/pdf/route.ts        (PDF download route)

components/features/compliance-audit/
  cycle-list/
  cycle-creation-wizard/
  cycle-detail/
  scope-selector/                       (reuses compliance-detail-table)
  item-bedomning-editor/
  finding-editor/
  seal-confirmation-dialog/
  revisionsrapport-view/

lib/compliance-audit/
  canonicalize.ts                       (canonical-JSON serialisation)
  seal-hash.ts                          (SHA-256 computation)
  revisionsrapport-renderer.ts          (HTML renderer for the report)
  cycle-materialisation.ts              (initial item-set build)
```

**Naming Conventions:** Follow existing convention — kebab-case file names, PascalCase React components, camelCase functions, snake_case DB columns, UPPER_SNAKE_CASE enums. Module prefix `ComplianceAudit*` for all new types/entities.

**Coding Standards:** Existing `docs/architecture/17-coding-standards.md` applies. Server actions `'use server'` at file top, Zod schema for all inputs, workspace+permission check at entry, Prisma transactions for multi-step mutations, `revalidatePath` after mutations, return structured results.

**Documentation Standards:** Inline JSDoc only where non-obvious; rely on TypeScript types as primary documentation. Story-level documentation in `docs/stories/epic-21-*` per existing pattern.

## 4.4 Deployment and Operations

**Build Process Integration:** No build changes. `pnpm build` continues to work. Prisma schema change triggers automatic type regeneration via `prisma generate`.

**Deployment Strategy:** Single deploy via existing Vercel pipeline. Database migration applied before deploy via standard `prisma migrate deploy`. No feature flag required — feature is gated behind new UI routes and new permission scope, so invisible to users until sales enables or until GA.

**Monitoring and Logging:** Existing application logging (server action entry/exit + errors) applies. PDF-generation async job uses existing background-task logging pattern. Cycle seal events logged at `info` level with workspace + cycle IDs. No new monitoring dashboards in MVP.

**Configuration Management:** No new environment variables required in MVP. Phase 4+ (AI-assisted bedömning) will reuse existing `ANTHROPIC_API_KEY`.

## 4.5 Risk Assessment and Mitigation

**Technical Risks:**

- **PDF render fidelity risk:** The existing HTML→PDF stack (to be confirmed by Architect) may not produce certification-grade output. Mitigation: Architect to benchmark current pipeline on a sample revisionsrapport; if insufficient, evaluate Puppeteer or `@react-pdf/renderer` as alternatives. Story 21.11/21.12 are deliberately split so the renderer (HTML) can ship before the PDF generator is finalised.
- **Canonicalisation drift risk:** If canonical-JSON serialisation differs across code paths (e.g., after future model changes), seal hashes become unreproducible. Mitigation: golden-fixture unit test in `lib/compliance-audit/canonicalize.ts`; CI runs the test on every PR; any schema change to cycle entities requires updating the fixture with an explicit migration note.
- **Evidence-file-deletion risk:** An evidence file linked to a sealed cycle can still be deleted from `WorkspaceFile` or `WorkspaceDocument` — the seal hash then references a file that no longer exists. Mitigation: server actions on file/document delete check for references in `ComplianceEvidenceSnapshot` and either (a) block deletion, or (b) soft-delete and retain blob until the oldest referencing cycle is archived. Decision deferred to Architect.
- **Permission-scope leakage risk:** A user gains lead_auditor_user_id on a cycle but loses their workspace role; they should no longer be able to seal. Mitigation: `audit:seal` check combines (role has `audit:seal`) OR (user is cycle's lead_auditor AND still has workspace membership).

**Integration Risks:**

- **Task model contamination:** Auto-spawned corrective-action Tasks could pollute existing task views with cycle-generated entries. Mitigation: Tasks gain a nullable `compliance_finding_id` back-reference; existing task views are unaffected in query but gain an optional badge/filter for "from kontroll".
- **ActivityLog volume:** Per-item bedömning edits are frequent during cycle execution. Mitigation: debounce motivering edits at the UI layer (save on blur or 2s idle, not keystroke); per-item bedömning status change is a low-frequency event and safe to log.
- **SWR cache fragmentation:** Multiple new cache keys. Mitigation: centralise key construction in `lib/swr-keys/compliance-audit.ts` to avoid typos.

**Deployment Risks:**

- **Migration lock-contention on `Task` table:** Adding a nullable column on a large existing table can lock the table briefly. Mitigation: Prisma migration uses standard Postgres `ADD COLUMN NULL` which is online in modern Postgres. No default value backfill needed.
- **Forward-only seal:** A deploy that incorrectly computes seal hashes would silently corrupt new seals. Mitigation: pre-deploy staging run against a seed cycle; verify hash stability across two identical seal runs on the same cycle in staging.

**Mitigation Strategies (summary):** Golden-fixture canonicalisation tests; seal action wrapped in explicit Prisma transaction; all cycle mutations guarded by an `assertCycleEditable()` helper; staging environment seal-verification test in CI; Architect sign-off on HTML→PDF stack choice before Story 21.12 starts.

---
