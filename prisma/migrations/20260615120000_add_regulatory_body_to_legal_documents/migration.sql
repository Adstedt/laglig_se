-- Epic myndighetsföreskrifter: first-class issuing-authority columns on legal_documents.
--
-- regulatory_body  = publisher (e.g. "Socialstyrelsen", "Arbetsmiljöverket"). Required because
--                    the shared HSLF-FS series spans ~8 agencies, so the publisher is NOT
--                    derivable from the document_number prefix (unlike AFS/SOSFS).
-- agency_prefix    = författningssamling prefix (e.g. "AFS", "SOSFS", "HSLF-FS"). Derivable from
--                    document_number, stored for indexed faceting ("all HSLF-FS" / "all AFS").
--
-- Both nullable: existing SFS/EU/court rows stay NULL. Agency rows backfilled separately.

ALTER TABLE "legal_documents" ADD COLUMN "regulatory_body" TEXT;
ALTER TABLE "legal_documents" ADD COLUMN "agency_prefix" TEXT;

CREATE INDEX "idx_regulatory_body" ON "legal_documents" ("regulatory_body");
