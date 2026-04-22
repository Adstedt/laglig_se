# Pre-Story Decisions Required from Architect

Before Story 21.12 (PDF) and Story 21.9 (seal) begin, the Architect addendum must resolve:

1. **HTML→PDF stack**: existing Laglig pipeline or new (Puppeteer / `@react-pdf/renderer`)?
2. **Canonical-JSON library**: use `json-canonicalize` (RFC 8785) or hand-rolled? Recommendation: RFC 8785 compliant.
3. **Evidence-file-deletion policy**: block deletion while referenced by any `ComplianceEvidenceSnapshot`? Soft-delete with retention? This is the biggest open operational question.
4. **Seal reversal**: strongly recommended "never" — reversal requires new cycle. Confirm or flag alternative.
5. **PDF storage location**: reuse existing WorkspaceFile storage (S3/Supabase Storage)? Or dedicated bucket for audit artefacts?

---
