# Agency Website Guide

Internal documentation for how Swedish regulatory agencies publish their regulations (föreskrifter), track amendments, and how we monitor for changes.

---

## 1. Arbetsmiljöverket (av.se) — AFS

**Ingestion method:** HTML scraping (Story 9.1, completed)

### Regulation Listing

- **Main page:** `https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/`
- Regulations are listed with links to individual pages containing full HTML text
- Each regulation page embeds the full text in `div.provision` (Episerver CMS)

### PDF Availability

- PDFs available but NOT used — HTML scraping is free, 100% accurate, and faster
- PDF URLs follow pattern: `https://www.av.se/globalassets/filer/publikationer/foreskrifter/afs{year}_{number}.pdf`

### Amendment Tracking

- Individual regulation pages list amendments inline
- Konsoliderade (consolidated) versions published as separate pages
- No separate amendment documents — consolidated text is updated in-place on the page

### URL Patterns

| Purpose | Pattern |
|---------|---------|
| Regulation page | `https://www.av.se/arbetsmiljoarbete-och-inspektioner/publikationer/foreskrifter/{slug}/` |
| PDF download | `https://www.av.se/globalassets/filer/publikationer/foreskrifter/afs{year}_{number}.pdf` |

### Monitoring Strategy

- Scrape the regulation listing page periodically
- Compare against known document list for new entries
- av.se does not provide RSS for regulation changes

---

## 2. MSB / MCF (msb.se → mcf.se) — MSBFS

**Ingestion method:** PDF → Claude (Story 9.2)

### Important: MSB Renamed to MCF

As of **January 1, 2026**, MSB (Myndigheten för samhällsskydd och beredskap) was renamed to **MCF (Myndigheten för civilt försvar)**. The domain `msb.se` now 301-redirects to `mcf.se`. All old URLs continue to work via redirect. The regulation series is still called **MSBFS** (not changed).

### Regulation Listing

- **Gällande (current):** `https://www.mcf.se/sv/regler/gallande-regler/`
- **Upphävda (revoked):** `https://www.mcf.se/sv/regler/upphavda-regler/`
- **About regulations:** `https://www.mcf.se/sv/regler/om-regler/`
- Organized by category (brandfarliga varor, transport, skydd mot olyckor, etc.)

### Individual Regulation Pages

**URL pattern:** `https://www.mcf.se/sv/regler/gallande-regler/msbfs-{YYYY}{N}/`

The slug removes the colon and concatenates year+number: `msbfs-20104` for MSBFS 2010:4.

### PDF Download Patterns

MSB/MCF uses **three different PDF URL patterns** depending on the era:

| Era | Pattern | Example |
|-----|---------|---------|
| Pre-2019 | `msb.se/externdata/rs/{GUID}.pdf` | MSBFS 2010:4 → `84efa9ee-324a-4ebc-913a-753b06e4bf0d.pdf` |
| 2019-2020 | `msb.se/siteassets/dokument/regler/forfattningar/msbfs-{Y}-{N}.pdf` | MSBFS 2020:1 |
| 2021+ | `msb.se/contentassets/{GUID}/msbfs-{Y}-{N}.pdf` | MSBFS 2023:2, 2025:2 |

**All msb.se URLs redirect to mcf.se equivalents.**

PDF URLs cannot be reliably predicted — must be discovered from the regulation page or lagen.nu.

### Amendment Tracking

- **Ändringsförfattning:** Published as a separate MSBFS number referencing the base regulation
- **Upphävande:** Revoked regulation moves to `/upphavda-regler/`
- MCF does NOT publish official consolidated versions — base + amendment PDFs must be read together
- Known amendments for our target documents:
  - MSBFS 2010:4 amended by MSBFS 2018:12
  - MSBFS 2013:3 amended by MSBFS 2023:1
  - MSBFS 2016:4 amended by MSBFS 2019:2

### Monitoring Strategy

**Primary:** lagen.nu Atom feed:
```
https://lagen.nu/dataset/myndfs/feed?dcterms_publisher=publisher/myndigheten_for_samhallsskydd_och_beredskap
```
Contains 77+ entries, updated when lagen.nu indexes new MSBFS regulations.

**Secondary:** Periodic scrape of `https://lagen.nu/dataset/myndfs?rpubl_forfattningssamling=msbfs` (lists all 72+ current regulations on one page).

**MCF RSS:** `https://www.mcf.se/sv/om-oss/kommunikationskanaler/rss-floden/` — general news, not regulation-specific.

### Special Cases

- **ADR-S (MSBFS 2024:10):** Swedish implementation of international ADR dangerous goods transport rules. 10+ MB PDF, 500+ pages. Will exceed Claude's context window — requires per-chapter extraction fallback. PDF: `https://www.mcf.se/contentassets/23dbbff228564dcd937fa1ab1e9f62b9/adr-s-2025-klar.pdf`

---

## 3. Naturvårdsverket (naturvardsverket.se) — NFS

**Ingestion method:** PDF → Claude (Story 9.2)

### Regulation Listing

- **Main page:** `https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/`
- React SSR application (Episerver/Optimizely with styled-components)
- **213 total regulations** as of Feb 2026
- Filters: Ämnesområden, Status (Gällande default), Visa endast (Allmänna råd)
- Paginated, 12 at a time with "Hämta fler" button
- Each entry shows: type tag (Grundföreskrift / Ändring / Allmänna råd), title, NFS number

### Individual Regulation Pages

**URL pattern:** `https://www.naturvardsverket.se/lagar-och-regler/foreskrifter-och-allmanna-rad/{YEAR}/nfs-{SLUG}/`

**Slug format is inconsistent:**
- `/2023/nfs-2023-2/` (dashes)
- `/2004/nfs-200410/` (concatenated, no dash)
- `/2016/nfs-20168/` (concatenated)
- `/2022/nfs-20222---transport-av-avfall/` (with descriptive suffix)

Each page includes:
- Regulation type label (Grundföreskrift, Ändring, Allmänna råd)
- Title, tillämpningsområde, övergångsbestämmelser, bemyndigande
- "Konsoliderad version" section when available
- Document table with columns: Titel, Gäller från, Fulltext (PDF)
- Ersätter/upphäver references

### PDF Download Patterns

**Three observed URL patterns:**

| Pattern | Format | Example |
|---------|--------|---------|
| Hash prefix | `/{HASH}/globalassets/nfs/{YEAR}/{FILENAME}.pdf` | `/4ac5b4/globalassets/nfs/2001/nfs2001-02.pdf` |
| No hash | `/globalassets/nfs/{YEAR}/{FILENAME}.pdf` | `/globalassets/nfs/2018/nfs-2018-11.pdf` |
| Legacy | `/Documents/foreskrifter/nfs{YEAR}/nfs{YEAR}-{N}.pdf` | Old pattern, may redirect |

**Filename conventions vary by era:**
- 2001: `nfs2001-02.pdf` (no dashes in prefix, zero-padded)
- 2004: `nfs2004_10.pdf` (underscore separator)
- 2015: `nfs-2015-02.pdf` (dashes, zero-padded)
- 2016+: `nfs-2016-8.pdf` (dashes, no padding)
- 2021: mixed — `nfs_2021_6.pdf` (underscores) vs `nfs-2021-10.pdf` (dashes)

**Konsoliderad version naming:** `nfs-2004-10k.pdf` (k suffix), `nfs-2015-2k-2.pdf` (k-2), `nfs-2016-8-konsoliderad-2025-6.pdf`

**PDF URLs cannot be reliably predicted** — the landing page is the authoritative source.

### Amendment Tracking

- Landing pages show full amendment history in a table
- Konsoliderad versions available as separate PDFs for some regulations
- Documents with konsoliderad versions in our target set:
  - **NFS 2004:10** — 4 amendments (2005:9, 2010:4, 2012:2, 2013:1), konsoliderad available
  - **NFS 2015:2** — konsoliderad (k-2) available
  - **NFS 2016:8** — 3 amendments (2019:7, 2021:9, 2025:6), konsoliderad available
- **We should prefer konsoliderad PDFs** where available

### Annual Förteckning (Register)

Definitive source for in-force regulations:
```
https://www.naturvardsverket.se/490fc1/globalassets/nfs/forteckningar/nfs-{YEAR}-forteckning.pdf
```
Available for 2020, 2022, 2023, 2024, 2025.

### Monitoring Strategy

**No RSS feed available** for NFS regulations.

**Primary:** Scrape the listing page (newest first by NFS number) and compare against known document list.

**Secondary:** lagen.nu index at `https://lagen.nu/dataset/myndfs?rpubl_forfattningssamling=nfs` (190+ NFS entries).

**Tertiary:** Download annual förteckning PDF to check for additions.

---

## 4. Remaining Authorities (Story 9.3 Preliminary Notes)

| Authority | Series | Website | Notes |
|-----------|--------|---------|-------|
| Elsäkerhetsverket | ELSÄK-FS | `https://www.elsakerhetsverket.se/` | Electrical safety regulations |
| Kemikalieinspektionen | KIFS | `https://www.kemi.se/` | Chemical regulations |
| Boverket | BFS | `https://www.boverket.se/` | Building/construction regulations (BBR, EKS) |
| Strålsäkerhetsmyndigheten | SSMFS | `https://www.stralsakerhetsmyndigheten.se/` | Radiation safety regulations |
| Skatteverket | SKVFS | `https://www.skatteverket.se/` | Tax authority regulations |
| SCB | SCB-FS | `https://www.scb.se/` | Statistics regulations |
| Styrelsen för ackreditering och teknisk kontroll | STAFS | `https://www.swedac.se/` | Accreditation regulations |
| Livsmedelsverket | LIVSFS | `https://www.livsmedelsverket.se/` | Food safety regulations |

**Common patterns observed:**
- Most agencies publish regulations as PDFs
- lagen.nu indexes most Swedish agency regulations — good baseline for discovery
- Amendment tracking varies significantly between agencies
- Consolidated versions rarely published by the agency itself

---

## 5. Cross-Reference Summary

| Aspect | AFS (av.se) | MSBFS (mcf.se) | NFS (naturvardsverket.se) |
|--------|-------------|-----------------|---------------------------|
| **Content delivery** | HTML on page | PDF only | PDF only |
| **Ingestion method** | HTML scraping | PDF → Claude | PDF → Claude |
| **Cost per document** | $0 | ~$0.20–0.50 | ~$0.20–0.50 |
| **URL predictability** | Consistent | 3 patterns (GUID-based) | Inconsistent (hash + naming) |
| **Consolidated versions** | Updated in-place | Not published | Separate PDFs (some) |
| **RSS/Atom feed** | None | lagen.nu Atom | None |
| **Amendment tracking** | Inline on page | Separate MSBFS numbers | Table on landing page |
| **Monitoring** | Scrape listing | lagen.nu feed | Scrape listing |
