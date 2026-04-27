# Epic 21 — Supabase Migration Manifest

**Status:** All 4 migrations applied to Supabase production via SQL Editor (user-applied-migration workflow established in Story 21.1).
**Author:** Sarah (PO) — 2026-04-27
**Purpose:** Single canonical record of which Epic 21 schema changes shipped, when they were applied, and how to verify each.

Epic 21 follows a **user-applied-migration** workflow: Prisma generates the SQL, the developer commits the migration file under `prisma/migrations/`, and the user applies it manually via Supabase SQL Editor before merging. This is because the project's shadow database has a pre-existing unrelated issue with `document_visits` (different `document_id` column type — uuid vs text) that breaks `prisma migrate dev`. The convention was documented in Story 21.1 v0.x and has been used for every Epic 21 migration since.

---

## 1. `20260422090000_add_compliance_audit_cycle`

**Story:** 21.1 — Compliance Audit Schema Foundations
**Path:** `prisma/migrations/20260422090000_add_compliance_audit_cycle/migration.sql`
**Applied:** 2026-04-22 by user
**Risk:** Additive — creates 5 new tables + 4 new enums, adds 1 nullable FK column to `Task`, no existing column modified.

**What it creates:**
- Tables: `compliance_audit_cycles`, `compliance_audit_items`, `compliance_findings`, `compliance_evidence_snapshots`, `compliance_audit_reports`, `compliance_cycle_task_links`.
- Enums: `AuditType`, `ComplianceCycleStatus`, `EfterlevnadsBedomning`, `FindingType`, `FindingSeverity`, `FindingState`.
- Adds `compliance_finding_id String?` (nullable FK) to `tasks`.
- 13 indexes total across the new tables.

**Verification SQL:**

```sql
-- Confirm the 5 new tables + 1 join exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'compliance_%'
ORDER BY table_name;
-- Expected: 6 rows.

-- Confirm enums
SELECT typname FROM pg_type WHERE typname IN
  ('AuditType', 'ComplianceCycleStatus', 'EfterlevnadsBedomning',
   'FindingType', 'FindingSeverity', 'FindingState')
ORDER BY typname;
-- Expected: 6 rows.

-- Confirm the new FK on Task
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'compliance_finding_id';
-- Expected: 1 row.
```

**Rollback:** drop the 5+1 tables, drop the 6 enums, drop the FK column on `tasks`. Manual rollback SQL not authored — restore from backup if needed.

---

## 2. `20260422120000_add_compliance_audit_item_unique_cycle_lawitem`

**Story:** 21.4 — Cycle Creation Wizard + Materialisation (SCHEMA-002 carry-forward from 21.1)
**Path:** `prisma/migrations/20260422120000_add_compliance_audit_item_unique_cycle_lawitem/migration.sql`
**Applied:** 2026-04-22 by user (during Story 21.4 dev session)
**Risk:** Additive — single `CREATE UNIQUE INDEX` on `(cycle_id, law_list_item_id)`. No data backfill required (the table is empty in any pre-21.4 environment).

**What it creates:**
- `CREATE UNIQUE INDEX "compliance_audit_items_cycle_id_law_list_item_id_key" ON "compliance_audit_items"("cycle_id", "law_list_item_id");`
- DB-level enforcement that one ComplianceAuditItem exists per (cycle, law_list_item) pair — defence-in-depth against a double-click race in `materialiseCycleItems`.

**Verification SQL:**

```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'compliance_audit_items'
  AND indexname = 'compliance_audit_items_cycle_id_law_list_item_id_key';
-- Expected: 1 row.
```

**Rollback:** `DROP INDEX "compliance_audit_items_cycle_id_law_list_item_id_key";`

**Backup artefacts:** `prisma/migrations/misc/21.4.migration.sql` + `prisma/migrations/misc/21.4.rollback.sql` (delivered as user-apply artefacts; identical to the canonical migration file plus a rollback companion).

---

## 3. `20260424030000_add_compliance_audit_report_unique_cycle_kind`

**Story:** 21.9 — Cycle Seal Hash + Evidence Snapshot (CONSTRAINT-001 fix during QA pass)
**Path:** `prisma/migrations/20260424030000_add_compliance_audit_report_unique_cycle_kind/migration.sql`
**Applied:** 2026-04-24 by user (during Story 21.9 v0.4 QA-fix session)
**Risk:** Additive — single composite `@@unique` on `(cycle_id, report_kind)`. Required to support the refactor from `findFirst+create/update` to `upsert` in the seal transaction.

**What it creates:**
- Composite unique index on `compliance_audit_reports.(cycle_id, report_kind)`.

**Verification SQL:**

```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'compliance_audit_reports'
  AND indexname LIKE '%cycle_id_report_kind%';
-- Expected: 1 row.
```

**Rollback:** `DROP INDEX "<the matching index name>";`

---

## 4. `20260426120000_add_compliance_audit_cycle_description`

**Story:** 21.4 v0.7 post-shipping addendum — Bakgrund free-text field
**Path:** `prisma/migrations/20260426120000_add_compliance_audit_cycle_description/migration.sql`
**Applied:** 2026-04-26 by user
**Risk:** Additive — single `ALTER TABLE … ADD COLUMN description TEXT;`, no NOT NULL, no default. Existing rows remain NULL. Backwards-compatible with all pre-shipping cycle reads.

**What it creates:**
- `ALTER TABLE "compliance_audit_cycles" ADD COLUMN "description" TEXT;`

**Verification SQL:**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'compliance_audit_cycles' AND column_name = 'description';
-- Expected: 1 row, data_type = 'text', is_nullable = 'YES'.
```

**Rollback:** `ALTER TABLE "compliance_audit_cycles" DROP COLUMN "description";`

---

## 5. Apply order

The four migrations are independent (no inter-dependencies between #2, #3, #4) but #1 must run before #2/#3/#4 because they extend tables created by #1.

```
20260422090000_add_compliance_audit_cycle                               # Story 21.1 — required first
20260422120000_add_compliance_audit_item_unique_cycle_lawitem           # Story 21.4 — depends on #1
20260424030000_add_compliance_audit_report_unique_cycle_kind            # Story 21.9 — depends on #1
20260426120000_add_compliance_audit_cycle_description                   # Story 21.4 v0.7 — depends on #1
```

Filename timestamps already encode this order — Prisma applies them lexicographically.

---

## 6. Future migration: Story 21.10 (deferred)

**Status:** Backlogged (`docs/stories/backlog/backend/21.10.assert-cycle-editable-runtime-guard.md`).
**Schema impact:** None expected — 21.10 is a runtime-guard refactor, no schema changes.
**Risk to UAT:** None — defence-in-depth only.

---

## 7. Notes for production deploys

- **Always apply via SQL Editor**, never via `prisma migrate deploy` from the dev machine — the shadow DB issue mentioned above will fail the deploy.
- **Verify after each apply** with the SQL snippets above before proceeding to the next migration.
- **Backup before applying** — Supabase managed-database snapshots are recommended.
- The four migrations above are non-destructive (no `DROP COLUMN`, no `ALTER COLUMN TYPE`, no data deletion). Rollback is simple if needed.
