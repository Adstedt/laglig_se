# Agency föreskrifter — ingestion directory

> **Generated** from the catalog by `scripts/agency-ingestion-status.ts` — do not hand-edit. Re-run after any agency ingestion.
> Last generated: 2026-06-16 · **358 ingested docs** across 13 agencies.

| Prefix | Issuing authority | Ingested (with content / total) | Ingestion method |
|--------|-------------------|----------------------------------|------------------|
| `AFS` | Arbetsmiljöverket | 81 | Consolidated PDF (av.se) · Story 9.1 |
| `MSBFS` | MSB (Myndigheten för samhällsskydd och beredskap) | 60 / 61 | Agency PDF · Story 9.2 |
| `BFS` | Boverket | 52 / 56 | Agency PDF · Story 9.3 |
| `SOSFS` | Socialstyrelsen | 43 | Consolidated HTML (socialstyrelsen.se) · Story 9.5 |
| `SSMFS` | Strålsäkerhetsmyndigheten | 40 | Agency PDF · Story 9.3 |
| `HSLF-FS` | Socialstyrelsen / Rättsmedicinalverket | 33 | Consolidated HTML (socialstyrelsen.se) · Story 9.5 |
| `ELSÄK-FS` | Elsäkerhetsverket | 20 | Agency PDF · Story 9.3 |
| `NFS` | Naturvårdsverket | 13 | Agency PDF · Story 9.2 |
| `SRVFS` | Räddningsverket (legacy) | 7 | Agency PDF · Story 9.3 |
| `KIFS` | Kemikalieinspektionen | 3 | Agency PDF · Story 9.3 |
| `(unattributed)` | — | 3 | — |
| `STAFS` | Swedac | 1 | Agency PDF · Story 9.3 |
| `SKVFS` | Skatteverket | 1 | Agency PDF · Story 9.3 |
| `SCB-FS` | Statistiska centralbyrån | 1 / 2 | Agency PDF · Story 9.3 |

## Notes

- **Ingested = `content_type: AGENCY_REGULATION`** rows in `LegalDocument`. "with content" = has `html_content` (a few are metadata-only stubs).
- **`HSLF-FS`** is a shared series — most docs are Socialstyrelsen-issued; co-signatory issuers (e.g. Rättsmedicinalverket) are attributed per-document via `regulatory_body`. **`SOSFS`** is Socialstyrelsen-only by definition.
- **3 unattributed** rows have no `agency_prefix`/`regulatory_body` mapping (prefix not in `lib/agency/regulatory-bodies.ts`). Add the prefix→authority mapping + re-run the attribution backfill.
- Attribution map: `lib/agency/regulatory-bodies.ts`. Socialstyrelsen issuer detail: `data/socialstyrelsen-issuers.json`.
