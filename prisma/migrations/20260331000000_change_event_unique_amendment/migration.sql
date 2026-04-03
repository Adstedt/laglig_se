-- Story 8.21: Add unique partial index to prevent duplicate ChangeEvents
-- One ChangeEvent per (document_id, amendment_sfs) for named amendments.
-- Rows with amendment_sfs = NULL are excluded (NEW_LAW, METADATA_UPDATE, etc.)

CREATE UNIQUE INDEX change_events_document_amendment_unique
ON change_events (document_id, amendment_sfs)
WHERE amendment_sfs IS NOT NULL;
