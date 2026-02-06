---
document_type: 'master-index'
version: '1.0'
total_files: 12
total_lists_analyzed: 9
total_unique_documents: 477
total_document_rows: 657
generated: '2026-02-05'
---

# Standardlaglistor — Analys & Agenttrainingsmaterial

Master index for laglig.se's law list analysis project. This directory contains
12 files analyzing 9 Notisum-inspired law list domains, providing cross-list
synthesis, and serving as agent training material for building laglig.se's own
law list templates.

**Copyright note:** All section names, summaries, commentary, and categorization
schemes in these files are original laglig.se content. Laws are referenced only
by their official SFS/AFS/EU numbers and official statute titles (public domain).
No Notisum descriptive text has been reproduced.

---

## File Inventory

### Per-List Analysis Files (01-09)

Each file follows a consistent 7-section template: Overview, Section Breakdown,
Source Type Analysis, Content Pattern Assessment, Laglig.se Recommendations,
Relationship to Other Lists, and Agent Training Annotations.

| File                                                                     | List                           | Docs | Sections  | Status               | Size                    |
| ------------------------------------------------------------------------ | ------------------------------ | ---- | --------- | -------------------- | ----------------------- |
| [01-arbetsmiljo.md](01-arbetsmiljo.md)                                   | Arbetsmiljo                    | 112  | 9         | Fully categorized    | Gold standard reference |
| [02-arbetsmiljo-tjansteforetag.md](02-arbetsmiljo-tjansteforetag.md)     | Arbetsmiljo for tjansteforetag | 55   | 7         | Fully categorized    | Subset of 01            |
| [03-miljo.md](03-miljo.md)                                               | Miljo                          | 98   | 9         | Fully categorized    | Second reference        |
| [04-miljo-tjansteforetag.md](04-miljo-tjansteforetag.md)                 | Miljo for tjansteforetag       | 32   | 6         | Partially structured | Subset of 03            |
| [05-miljo-sverige.md](05-miljo-sverige.md)                               | Miljo Sverige                  | 64   | —         | Uncategorized        | Proposed sections       |
| [06-informationssakerhet-sverige.md](06-informationssakerhet-sverige.md) | Informationssakerhet Sverige   | 42   | 5 (empty) | Partially structured | Completed mapping       |
| [07-fastighet-bygg.md](07-fastighet-bygg.md)                             | Fastighet-Bygg                 | 110  | —         | Uncategorized        | Proposed sections       |
| [08-halsa-sjukvard.md](08-halsa-sjukvard.md)                             | Halsa och sjukvard             | 91   | —         | Uncategorized        | Proposed sections       |
| [09-livsmedel-sverige.md](09-livsmedel-sverige.md)                       | Livsmedel Sverige              | 53   | —         | Uncategorized        | Proposed sections       |

### Synthesis Files (10-11)

| File                                                     | Purpose                                                                                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [10-cross-list-analysis.md](10-cross-list-analysis.md)   | 9x9 overlap matrix, complete source registry (30 prefixes), shared law inventory, subset relationships, content richness comparison    |
| [11-agent-training-guide.md](11-agent-training-guide.md) | Swedish legal hierarchy, law list construction patterns, section naming conventions, compliance summary style guide, quality checklist |

---

## Key Terminology

| Term               | Definition                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Laglista**       | A curated list of laws, regulations, and guidance documents for a specific compliance domain         |
| **SFS**            | Svensk forfattningssamling — the Swedish Code of Statutes                                            |
| **AFS**            | Arbetsmiljoverkets forfattningssamling — Work Environment Authority regulations                      |
| **Foreskrift**     | Binding agency regulation (myndighetsforeskrift)                                                     |
| **Allmanna rad**   | Non-binding general guidance from an agency                                                          |
| **SSDD index**     | Section (2 digits) + Document (2 digits) index numbering scheme, e.g. 0310 = section 03, document 10 |
| **Tjansteforetag** | Service company — a subset variant of a law list excluding industry-specific provisions              |
| **Amnesfokus**     | Notisum's "topic focus" pages — 18 topic areas with curated regulatory overviews                     |

---

## Summary Statistics

| Metric                       | Value                                               |
| ---------------------------- | --------------------------------------------------- |
| Lists analyzed               | 9                                                   |
| Total document rows (CSV)    | 657                                                 |
| Unique law references        | ~477                                                |
| Laws in 1 list only          | 369 (77%)                                           |
| Laws in 2 lists              | 58 (12%)                                            |
| Laws in 3+ lists             | 50 (11%)                                            |
| Maximum list overlap         | 5 lists (GDPR, Dataskyddslag, Visselblasarlagen)    |
| Regulatory prefixes found    | 30                                                  |
| Most common prefix           | SFS (365 occurrences, 56%)                          |
| Fully categorized lists      | 3 (Arbetsmiljo, Arb. tjansteforetag, Miljo)         |
| Partially structured lists   | 2 (Miljo tjansteforetag, Informationssakerhet)      |
| Uncategorized lists          | 4 (Fastighet-Bygg, Halsa, Livsmedel, Miljo Sverige) |
| Lists with proposed sections | 6 (all uncategorized + partially structured)        |

---

## Data Sources

| File                         | Location                   | Contains                                                                             |
| ---------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `notisum-full-data.json`     | `data/notisum-amnesfokus/` | Arbetsmiljo, Arb. tjansteforetag, Miljo, Halsa och sjukvard — full document content  |
| `laglistor-data.json`        | `data/notisum-amnesfokus/` | Fastighet-Bygg, Informationssakerhet, Livsmedel, Miljo tjansteforetag, Miljo Sverige |
| `laglistor-all-combined.csv` | `data/notisum-amnesfokus/` | All 9 lists in flat CSV (657 rows, 11 columns)                                       |
| `amnesfokus-summary.csv`     | `data/notisum-amnesfokus/` | 18 Notisum topic areas with metadata                                                 |

---

## Subset Relationships

```
Arbetsmiljo (112 docs)
  └── Arbetsmiljo for tjansteforetag (55 docs) — 100% subset

Miljo (98 docs)
  └── Miljo for tjansteforetag (32 docs) — 94% subset (30/32 shared)

Miljo Sverige (64 docs) — NOT a Miljo subset; actually workplace/HR focused
  ├── 58% overlap with Arbetsmiljo (37/64)
  └── 47% overlap with Arb. tjansteforetag (30/64)
```

---

## Content Richness Overview

| List                 | Expert Commentary | Compliance Summaries | Compliance Detail |
| -------------------- | ----------------- | -------------------- | ----------------- |
| Arbetsmiljo          | 100%              | 100%                 | 0%                |
| Arb. tjansteforetag  | 100%              | 100%                 | 0%                |
| Miljo                | 100%              | 97%                  | 0%                |
| Halsa och sjukvard   | 99%               | 100%                 | 0%                |
| Miljo tjansteforetag | 100%              | 100%                 | 0%                |
| Informationssakerhet | ~90%              | ~80%                 | 0%                |
| Fastighet-Bygg       | ~70%              | 0%                   | 0%                |
| Livsmedel            | ~70%              | 0%                   | 0%                |
| Miljo Sverige        | ~70%              | 0%                   | 0%                |

---

## How to Use These Files

### For building a new law list

1. Start with [11-agent-training-guide.md](11-agent-training-guide.md) for construction patterns and conventions
2. Check [10-cross-list-analysis.md](10-cross-list-analysis.md) for shared laws and existing coverage
3. Use [01-arbetsmiljo.md](01-arbetsmiljo.md) as the gold standard template reference
4. Follow the SSDD index scheme and section naming conventions documented in file 11

### For extending an existing list

1. Read the per-list analysis file (01-09) for the relevant domain
2. Check the "Laglig.se Recommendations" section for proposed improvements
3. Cross-reference with file 10 for overlap with other lists

### For writing compliance summaries

1. See file 11, Section 5: "Compliance Summary Style Guide"
2. Use first-person plural, obligation-focused voice ("Vi ska...", "Vi behover...")
3. Follow the original examples provided (not Notisum's text)

### For understanding regulatory bodies

1. File 10, Section 4 has the complete source registry (30 prefixes)
2. File 11, Section 1 explains the Swedish legal hierarchy
3. File 11, Section 9 provides a quick-reference regulatory body table
