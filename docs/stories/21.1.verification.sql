-- ============================================================================
-- Story 21.1 — Production verification script (v2: result-grid output)
-- ============================================================================
-- Paste this ENTIRE block into Supabase SQL Editor and click RUN (▶).
--
-- What it does: creates a tiny fake workspace/user/laglista/cycle chain inside
-- a transaction, runs 4 behavioural checks, writes each check's result into a
-- temp table, SELECTs that table so the grid shows you the results, then
-- ROLLBACKs the whole transaction. NOTHING is persisted.
--
-- Expected output: 4 rows in the result grid, all with status = 'PASS':
--   n | check_name                              | status | detail
--  ---+-----------------------------------------+--------+------------------------------------------------------
--   1 | XOR CHECK constraint exists             | PASS   | constraint compliance_evidence_snapshots_xor_check found
--   2 | Both-populated snapshot rejected        | PASS   | CHECK violation raised as expected
--   3 | Cascade delete from cycle               | PASS   | item + finding removed when cycle deleted
--   4 | FK Restrict on referenced law_list_item | PASS   | FK violation raised as expected
--
-- Any row with status = 'FAIL' = a real schema issue. Paste back to me.
-- Safe to run multiple times — IDs are randomised per run and nothing commits.
-- ============================================================================

BEGIN;

-- Temp table for results, dropped on ROLLBACK
CREATE TEMP TABLE _sy21_results (
  n          INT,
  check_name TEXT,
  status     TEXT,
  detail     TEXT
) ON COMMIT DROP;

DO $$
DECLARE
  suffix       TEXT := replace(gen_random_uuid()::text, '-', '');
  v_user       TEXT;
  v_ws         TEXT;
  v_doc        TEXT;
  v_ll         TEXT;
  v_lli        TEXT;
  v_cycle      TEXT;
  v_cycle2     TEXT;
  v_item       TEXT;
  v_item2      TEXT;
  v_finding    TEXT;
  v_xor_exists BOOLEAN;
  v_cnt        INT;
BEGIN
  v_user    := 'qa21-u-'  || suffix;
  v_ws      := 'qa21-w-'  || suffix;
  v_doc     := 'qa21-d-'  || suffix;
  v_ll      := 'qa21-l-'  || suffix;
  v_lli     := 'qa21-i-'  || suffix;
  v_cycle   := 'qa21-c-'  || suffix;
  v_cycle2  := 'qa21-c2-' || suffix;
  v_item    := 'qa21-ai-' || suffix;
  v_item2   := 'qa21-ai2-'|| suffix;
  v_finding := 'qa21-f-'  || suffix;

  -- ──────────────────────────────────────────────────────────────────────────
  -- CHECK 1/4 — XOR CHECK constraint exists on compliance_evidence_snapshots
  -- ──────────────────────────────────────────────────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'compliance_evidence_snapshots_xor_check'
      AND conrelid = 'compliance_evidence_snapshots'::regclass
  ) INTO v_xor_exists;

  IF v_xor_exists THEN
    INSERT INTO _sy21_results VALUES
      (1, 'XOR CHECK constraint exists', 'PASS',
       'constraint compliance_evidence_snapshots_xor_check found');
  ELSE
    INSERT INTO _sy21_results VALUES
      (1, 'XOR CHECK constraint exists', 'FAIL',
       'constraint compliance_evidence_snapshots_xor_check NOT found');
    -- Abort early: if check 1 fails, the rest don't make sense.
    RETURN;
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- Setup — minimal prereq chain
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO users (id, email, email_verified, created_at)
    VALUES (v_user, v_user || '@qa21.example', TRUE, now());

  INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at)
    VALUES (v_ws, 'QA21 Test WS', 'qa21-ws-' || suffix, v_user, now(), now());

  INSERT INTO legal_documents (
    id, content_type, document_number, slug, title, source_url, status, created_at, updated_at
  ) VALUES (
    v_doc, 'SFS_LAW', 'SFS-QA21-' || suffix, 'qa21-doc-' || suffix,
    'QA21 Test Doc', 'https://example.test/qa21', 'ACTIVE', now(), now()
  );

  INSERT INTO law_lists (id, workspace_id, name, created_at, updated_at)
    VALUES (v_ll, v_ws, 'QA21 laglista', now(), now());

  INSERT INTO law_list_items (id, law_list_id, document_id, added_at, updated_at)
    VALUES (v_lli, v_ll, v_doc, now(), now());

  INSERT INTO compliance_audit_cycles (
    id, workspace_id, law_list_id, name, scope_definition, audit_type,
    scheduled_start, scheduled_end, law_change_cutoff_date, status,
    lead_auditor_user_id, created_by_user_id, created_at, updated_at
  ) VALUES (
    v_cycle, v_ws, v_ll, 'QA21 Cycle 1', '{"kind":"all"}'::jsonb, 'INTERN',
    now(), now() + interval '1 day', now(), 'PAGAENDE',
    v_user, v_user, now(), now()
  );

  -- ──────────────────────────────────────────────────────────────────────────
  -- CHECK 2/4 — XOR CHECK rejects snapshot with BOTH file + document populated
  -- ──────────────────────────────────────────────────────────────────────────
  BEGIN
    INSERT INTO compliance_evidence_snapshots (
      id, cycle_id, evidence_kind, evidence_file_id, evidence_document_id, evidence_sha256, captured_at
    ) VALUES (
      'qa21-ev-' || suffix, v_cycle, 'FILE', 'fake-file-id', 'fake-doc-id', repeat('a', 64), now()
    );
    -- If we reach here, the CHECK let the bad row through — FAIL.
    INSERT INTO _sy21_results VALUES
      (2, 'Both-populated snapshot rejected', 'FAIL',
       'INSERT was accepted — XOR CHECK is broken');
  EXCEPTION
    WHEN check_violation THEN
      INSERT INTO _sy21_results VALUES
        (2, 'Both-populated snapshot rejected', 'PASS',
         'CHECK violation raised as expected');
  END;

  -- ──────────────────────────────────────────────────────────────────────────
  -- CHECK 3/4 — Cascade delete: cycle → items + findings
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO compliance_audit_items (id, cycle_id, law_list_item_id, created_at, updated_at)
    VALUES (v_item, v_cycle, v_lli, now(), now());

  INSERT INTO compliance_findings (
    id, cycle_id, type, title, description, created_at, updated_at
  ) VALUES (
    v_finding, v_cycle, 'OBSERVATION', 'QA21 finding', 'desc', now(), now()
  );

  DELETE FROM compliance_audit_cycles WHERE id = v_cycle;

  SELECT count(*) INTO v_cnt FROM compliance_audit_items WHERE id = v_item;
  IF v_cnt > 0 THEN
    INSERT INTO _sy21_results VALUES
      (3, 'Cascade delete from cycle', 'FAIL', 'audit item survived cycle delete');
  ELSE
    SELECT count(*) INTO v_cnt FROM compliance_findings WHERE id = v_finding;
    IF v_cnt > 0 THEN
      INSERT INTO _sy21_results VALUES
        (3, 'Cascade delete from cycle', 'FAIL', 'finding survived cycle delete');
    ELSE
      INSERT INTO _sy21_results VALUES
        (3, 'Cascade delete from cycle', 'PASS',
         'item + finding removed when cycle deleted');
    END IF;
  END IF;

  -- ──────────────────────────────────────────────────────────────────────────
  -- CHECK 4/4 — FK Restrict: law_list_item cannot be deleted while cycle item references it
  -- ──────────────────────────────────────────────────────────────────────────
  INSERT INTO compliance_audit_cycles (
    id, workspace_id, law_list_id, name, scope_definition, audit_type,
    scheduled_start, scheduled_end, law_change_cutoff_date, status,
    lead_auditor_user_id, created_by_user_id, created_at, updated_at
  ) VALUES (
    v_cycle2, v_ws, v_ll, 'QA21 Cycle 2', '{"kind":"all"}'::jsonb, 'INTERN',
    now(), now() + interval '1 day', now(), 'PAGAENDE',
    v_user, v_user, now(), now()
  );

  INSERT INTO compliance_audit_items (id, cycle_id, law_list_item_id, created_at, updated_at)
    VALUES (v_item2, v_cycle2, v_lli, now(), now());

  BEGIN
    DELETE FROM law_list_items WHERE id = v_lli;
    -- If we reach here, the restrict FK let the delete through — FAIL.
    INSERT INTO _sy21_results VALUES
      (4, 'FK Restrict on referenced law_list_item', 'FAIL',
       'delete was allowed — FK Restrict is broken');
  EXCEPTION
    WHEN foreign_key_violation THEN
      INSERT INTO _sy21_results VALUES
        (4, 'FK Restrict on referenced law_list_item', 'PASS',
         'FK violation raised as expected');
  END;
END $$;

-- Show results in the grid (this is what you should see after clicking RUN):
SELECT * FROM _sy21_results ORDER BY n;

-- Undo everything — temp table dropped, seed data reverted.
ROLLBACK;
