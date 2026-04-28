# Migration: Collapse SEAL into AVSLUTAD (Story 21.26)

This folder contains the migration that retires the `SEALED` cycle state.

## Run order

1. **Pre-flight checks** (read-only — run first to know what you're committing to)
2. **`migration.sql`** (the actual migration — destructive on `seal_hash` + `compliance_evidence_snapshots`)
3. **Post-flight verification** (read-only — run after to confirm the migration landed correctly)
4. **Record in `_prisma_migrations`** (so future `prisma migrate deploy` doesn't try to re-run it)

You can run the SQL directly in **Supabase Dashboard → SQL Editor** or via psql. The migration is wrapped in a single `BEGIN;…COMMIT;` block — if any step fails, the whole thing rolls back.

---

## Pre-flight checks

Run these first so you know what's about to happen. Save the row counts; you'll compare them against post-flight.

```sql
-- How many SEALED cycles are about to flip to AVSLUTAD?
SELECT count(*) AS sealed_cycles_count
FROM compliance_audit_cycles
WHERE status = 'SEALED';

-- How many cycles have a non-null seal_hash that will be dropped?
SELECT count(*) AS cycles_with_seal_hash
FROM compliance_audit_cycles
WHERE seal_hash IS NOT NULL;

-- How many reports of each kind exist?
SELECT report_kind, count(*) AS report_count
FROM compliance_audit_reports
GROUP BY report_kind;

-- How many cycles have BOTH a COMPLETE row and a SEALED row in
-- compliance_audit_reports? (these are the conflict cases — SEALED rows
-- get deleted, COMPLETE rows preserved.)
SELECT count(DISTINCT cycle_id) AS cycles_with_both_kinds
FROM compliance_audit_reports
WHERE cycle_id IN (
  SELECT cycle_id FROM compliance_audit_reports
  WHERE report_kind = 'COMPLETE'
)
AND cycle_id IN (
  SELECT cycle_id FROM compliance_audit_reports
  WHERE report_kind = 'SEALED'
);

-- How many evidence-snapshot rows are about to be dropped?
SELECT count(*) AS snapshot_rows
FROM compliance_evidence_snapshots;

-- Total cycle count (must stay the same after migration — no rows lost)
SELECT count(*) AS total_cycles
FROM compliance_audit_cycles;
```

**Expected ballpark:** likely all `SEALED` rows are test data (single digits or zero in production). If you see hundreds, pause and check — that suggests the migration has more impact than this plan assumed.

---

## Apply the migration

Copy the entire contents of **`migration.sql`** (next to this README) into Supabase SQL Editor and run. The `BEGIN;…COMMIT;` wrapper means any error rolls back the whole thing.

---

## Post-flight verification

```sql
-- 1. Enum should now be exactly the four values
SELECT enum_range(NULL::"ComplianceCycleStatus") AS cycle_status_enum;
-- Expected: {PLANERAD,PAGAENDE,AVSLUTAD,ARKIVERAD}

-- 2. seal_hash column is gone
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'compliance_audit_cycles' AND column_name = 'seal_hash';
-- Expected: 0 rows

-- 3. ReportKind enum collapsed
SELECT enum_range(NULL::"ReportKind") AS report_kind_enum;
-- Expected: {COMPLETE}

-- 4. compliance_evidence_snapshots table is gone
SELECT to_regclass('public.compliance_evidence_snapshots') AS table_check;
-- Expected: NULL

-- 5. No cycle row was lost (compare to pre-flight total_cycles)
SELECT count(*) AS total_cycles_after FROM compliance_audit_cycles;
-- Expected: same number as pre-flight

-- 6. No SEALED rows remain anywhere
SELECT 'cycles' AS table_name, count(*) AS sealed_remaining
FROM compliance_audit_cycles WHERE status::text = 'SEALED'
UNION ALL
SELECT 'reports', count(*)
FROM compliance_audit_reports WHERE report_kind::text = 'SEALED';
-- Expected: 0 rows (or zero-count rows)

-- 7. sealed_at + sealed_by_user_id columns still exist (they stay; populated
-- by completeCycle going forward)
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'compliance_audit_cycles'
  AND column_name IN ('sealed_at', 'sealed_by_user_id');
-- Expected: both rows present, both is_nullable = YES
```

If any check fails, share the output before I do the code refactor.

---

## Record the migration so Prisma knows it ran

Prisma tracks applied migrations in the `_prisma_migrations` table. If you run the SQL via Supabase Editor (not via `prisma migrate deploy`), you need to insert the bookkeeping row manually so future `prisma migrate deploy` invocations don't try to re-run it.

```sql
INSERT INTO "_prisma_migrations" (
  "id",
  "checksum",
  "finished_at",
  "migration_name",
  "logs",
  "rolled_back_at",
  "started_at",
  "applied_steps_count"
) VALUES (
  gen_random_uuid()::text,
  'manual-application-no-checksum',
  now(),
  '20260427160000_collapse_seal_into_avslutad',
  NULL,
  NULL,
  now(),
  1
);
```

The `checksum` value is normally a hash of the migration file content. Setting it to a sentinel string is acceptable for manually-applied migrations — the only consequence is that `prisma migrate diff` will warn about a checksum mismatch, but `migrate deploy` won't re-run the migration.

**Alternative:** if you'd rather use the Prisma CLI, just run:

```
npx prisma migrate resolve --applied "20260427160000_collapse_seal_into_avslutad"
```

That records the bookkeeping row with a proper checksum. Equivalent to the INSERT above but cleaner.

---

## After the migration lands

Tell me it's applied and I'll do the code refactor in a single PR:
- `prisma/schema.prisma` updates (drop SEALED enum value, drop seal_hash column, drop ComplianceEvidenceSnapshot model, drop ReportKind.SEALED)
- `npx prisma generate` to refresh the Prisma client types
- All the server + UI + test + UAT changes per the approved plan

If you don't tell me it landed, I'll wait — the code refactor will fail typecheck against the un-migrated schema.

## Rollback (only if something went wrong)

The migration does NOT keep a backup of `seal_hash` or `compliance_evidence_snapshots`. If you need to roll back after the migration ran successfully, you'd need to:

1. Restore from the most recent Supabase backup that predates the migration.
2. Manually re-create the `compliance_evidence_snapshots` table from the schema definition (find it in git history at `prisma/schema.prisma`).
3. Re-add the `SEALED` enum value: `ALTER TYPE "ComplianceCycleStatus" ADD VALUE 'SEALED';`
4. Re-add the `seal_hash` column: `ALTER TABLE compliance_audit_cycles ADD COLUMN seal_hash TEXT;`

This is destructive recovery — the seal_hash data and snapshot rows from the dropped table will need to come from a backup, not the live DB.

If you want to be extra safe before applying, take a manual Supabase backup or DB snapshot first.
