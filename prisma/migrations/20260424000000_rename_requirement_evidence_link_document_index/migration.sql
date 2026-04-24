-- Drift repair: rename the unique index on requirement_evidence_links(requirement_id, workspace_document_id)
-- to match the name Prisma derives from schema.prisma's @@unique([requirement_id, workspace_document_id]).
--
-- Background: migration 20260413000000_story_17_16_kravpunkter_requirements created the index as
-- "requirement_evidence_links_requirement_id_workspace_document_id_key" (67 chars). Postgres silently
-- truncates identifiers to 63 chars, so the actual stored name became
-- "requirement_evidence_links_requirement_id_workspace_document_id" — while Prisma's auto-derived name
-- is "requirement_evidence_links_requirement_id_workspace_documen_key". Same constraint, same columns,
-- only the name differs. Left unfixed, a fresh-environment `prisma migrate deploy` would end up with the
-- wrong index name and Prisma Client lookups could fail.

ALTER INDEX "requirement_evidence_links_requirement_id_workspace_document_id"
    RENAME TO "requirement_evidence_links_requirement_id_workspace_documen_key";
