-- Enable RLS on every public table to deny PostgREST/Realtime/pg_graphql
-- access via the leaked anon key. Prisma connects as the `postgres` role
-- (BYPASSRLS), so server-side queries are unaffected. No policies are
-- defined: RLS-enabled-no-policy = default deny for non-bypass roles.

ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."amendment_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."amendments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."change_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."change_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_usage_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."company_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_audit_cycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_audit_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_audit_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_cycle_task_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_findings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_status_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."content_chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."court_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cron_job_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cross_references" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."document_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."document_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."document_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."eu_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."file_list_item_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."file_task_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_list_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_list_item_requirements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_list_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_list_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."legal_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."legislative_refs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."requirement_evidence_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."section_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."task_columns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."task_list_item_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."template_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."template_sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_document_list_item_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_document_task_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_document_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_document_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;

-- Prisma's internal migration-tracking table. No PII, but enabling RLS
-- clears the Supabase linter warning. Prisma's role bypasses, so migrate
-- continues to read/write it normally.
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Verification: this query must return zero rows after migration applies.
-- (Commented because Prisma migrate cannot evaluate assertions; run manually.)
--
-- SELECT schemaname, tablename
-- FROM pg_tables
-- WHERE schemaname = 'public' AND NOT rowsecurity;
