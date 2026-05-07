# Import-pipeline test fixtures

Sample source files used by the parser unit tests at
`tests/unit/lib/import/parser.test.ts` and the integration tests at
`tests/integration/app/actions/law-list-import.test.ts`.

All five fixtures are produced by `scripts/generate-import-fixtures.ts` —
re-run the script to regenerate any of them. The committed binaries are the
canonical source for tests.

## Files

| File                              | Source style         | Rows | What it exercises                                                                                                                                                                                                                                                                               |
| --------------------------------- | -------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notisum-export-sample.xlsx`      | Notisum-style export | 30   | Full column set (SFS-nr, Lagens namn, Rättsområde, Egen status, Kommentar). Heuristic should map titel ↔ "Lagens namn", sfs_nummer ↔ "SFS-nr", omrade ↔ "Rättsområde", kommentar ↔ "Kommentar". Includes 3 deliberately misleading rows (paraphrased title, missing SFS, extra whitespace). |
| `lex-nu-export-sample.xlsx`       | Lex.nu-style export  | 25   | Simpler 4-column set (Titel, SFS, Område, Datum). No Kommentar column — heuristic should leave kommentar=null.                                                                                                                                                                                  |
| `consultant-excel-sample.xlsx`    | Consultant Excel     | 50   | Title-only matching (no SFS column). Tests the `lagansvarig` content heuristic via Swedish person-name patterns + the `kommentar` long-text heuristic. Mix of real laws + 3 deliberately non-law rows ("Vår interna brandsäkerhetspolicy", "LAS", "MBL").                                       |
| `internal-spreadsheet-sample.csv` | Swedish-Excel CSV    | 15   | Semicolon delimiter (Excel SE default) + UTF-8 BOM. Tests Papa Parse auto-detect + BOM stripping.                                                                                                                                                                                               |
| `paste-input-sample.txt`          | Single-column paste  | 10   | Title-only newline-separated text. Tests the `parsePaste` single-column fallback (no tab characters).                                                                                                                                                                                           |

## Sourcing

Real Swedish law titles were drawn from the existing `LegalDocument` catalog
where possible (so matching tests can verify against ground-truth IDs in
24.3). Where the catalog had no entry, plausible Swedish-law-list rows were
hand-authored. SFS numbers are real where the title is real.

Misleading rows (3-5 per fixture) are deliberately mixed in to exercise
heuristic edge cases: paraphrased titles, missing SFS numbers, extra
whitespace, lowercase titles, and abbreviations like "LAS" / "MBL".

## Re-generating

```bash
pnpm tsx scripts/generate-import-fixtures.ts
```

Re-run after editing fixture data in the script. The script overwrites the
binary files; commit the updated binaries.

## Story 24.3 matcher benchmark

`matcher-benchmark.json` — 50-row fixture for the live-API benchmark test at
`tests/integration/lib/import/matcher.benchmark.test.ts`. Authored by
`scripts/generate-matcher-benchmark.ts` against the live `LegalDocument`
catalog. Mandatory series mix per Story 24.3 AC 17:

| Series            | Count | Tests                                                                                                         |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| `SFS`             | 30    | exact-match path on canonical `SFS YYYY:NNN` form                                                             |
| `AFS`             | 6     | open-set agency exact match (chapter-sliced rows excluded — they share canonical with siblings)               |
| `EU`              | 4     | EU regulation + directive (catalog stores in dual format: `Regulation (EU) ...` AND `3YYYY[RL]NNNN` CELEX)    |
| `OTHER_AGENCY`    | 3     | non-AFS agencies (MSBFS, BFS, ELSÄK-FS, etc.) — proves `parseDocumentNumber` is genuinely open-set end-to-end |
| `PREFIX_MISMATCH` | 3     | source row has missing or wrong prefix — Branch B suffix-fallback should rescue at MEDIUM+                    |
| `NEGATIVE`        | 4     | rows that should land `UNMATCHED` (false-positive gate)                                                       |

Re-generate the fixture when the catalog grows or the agency-prefix mix
changes:

```bash
pnpm tsx scripts/generate-matcher-benchmark.ts
```

The script queries by `content_type` + prefix filters; deterministic given
a stable catalog. Commit the regenerated `matcher-benchmark.json`.
