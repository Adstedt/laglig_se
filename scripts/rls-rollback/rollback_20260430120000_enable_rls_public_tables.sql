-- Rollback for migration 20260430120000_enable_rls_public_tables
-- Disables RLS on every public table this migration enabled it on.
-- Apply manually via psql against DIRECT_URL if you need to revert.
--
-- After running this you will ALSO need to remove the migration row from
-- _prisma_migrations or Prisma will think the migration is still applied:
--   DELETE FROM _prisma_migrations
--   WHERE migration_name = '20260430120000_enable_rls_public_tables';

ALTER TABLE "public"."activity_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."admin_audit_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."amendment_documents" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."amendments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."change_assessments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."change_events" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_messages" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_usage_events" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."comments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."company_profiles" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_audit_cycles" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_audit_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_audit_reports" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_cycle_task_links" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_findings" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."compliance_status_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."content_chunks" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."court_cases" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cron_job_runs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."cross_references" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."document_subjects" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."document_versions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."document_visits" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."eu_documents" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."file_list_item_links" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."file_task_links" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_list_groups" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_list_item_requirements" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_list_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_list_templates" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_lists" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."law_sections" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."legal_documents" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."legislative_refs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notification_preferences" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notifications" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."requirement_evidence_links" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."section_changes" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."task_columns" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."task_list_item_links" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tasks" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."template_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."template_sections" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."users" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_document_list_item_links" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_document_task_links" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_document_templates" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_document_versions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_documents" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_files" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_invitations" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_members" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspaces" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_prisma_migrations" DISABLE ROW LEVEL SECURITY;
