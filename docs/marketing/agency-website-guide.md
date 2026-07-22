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

## 4. Elsäkerhetsverket (elsakerhetsverket.se) — ELSÄK-FS

**Ingestion method:** PDF → Claude (Story 9.3)

### Regulation Listing

- **By topic:** `https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/`
- **In numerical order:** `https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter-i-nummerordning/`
- **Repealed:** `https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/upphavda-foreskrifter/`
- Well-organized modern website with consistent URL patterns

### PDF Download Patterns

Consistent and predictable pattern:
```
https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-{YEAR}-{NUMBER}.pdf
```

Consolidated versions:
```
https://www.elsakerhetsverket.se/globalassets/foreskrifter/elsak-fs-{YEAR}-{NUMBER}-konsoliderad.pdf
```

Landing pages:
```
https://www.elsakerhetsverket.se/om-oss/lag-och-ratt/foreskrifter/elsak-fs-{YEAR}-{NUMBER}/
```

### Target Documents (5)

| Document | PDF URL | Consolidated? |
|----------|---------|---------------|
| ELSÄK-FS 2017:2 | `.../elsak-fs-2017-2.pdf` | No |
| ELSÄK-FS 2017:3 | `.../elsak-fs-2017-3-konsoliderad.pdf` | Yes (amended by ELSÄK-FS 2021:5) |
| ELSÄK-FS 2022:1 | `.../elsak-fs-2022-1.pdf` | No (replaced ELSÄK-FS 2008:1) |
| ELSÄK-FS 2022:2 | `.../elsak-fs-2022-2.pdf` | No (replaced ELSÄK-FS 2008:2) |
| ELSÄK-FS 2022:3 | `.../elsak-fs-2022-3.pdf` | No (replaced ELSÄK-FS 2008:3) |

### Monitoring Strategy

**Primary:** lagen.nu Atom feed:
```
https://lagen.nu/dataset/myndfs/feed?dcterms_publisher=publisher/elsaekerhetsverket
```

**Secondary:** Scrape the numerical order listing page. No RSS on elsakerhetsverket.se itself. Email subscription available for news.

---

## 5. Kemikalieinspektionen (kemi.se) — KIFS

**Ingestion method:** PDF → Claude (Story 9.3)

### Regulation Listing

- **Swedish:** `https://www.kemi.se/lagar-och-regler/lagstiftningar-inom-kemikalieomradet/kemikalieinspektionens-foreskrifter-kifs`
- **English:** `https://www.kemi.se/en/rules-and-regulations/agency-regulations-kifs`
- Only 3 active base regulations (KIFS 2017:7, 2017:8, 2022:3) — very small corpus

### PDF Download Patterns

Hash-based URLs — **not constructible** from document number:
```
https://www.kemi.se/download/18.{HASH}/{TIMESTAMP}/{FILENAME}.pdf
```

Filename conventions inconsistent: `kifs-2017-7.pdf` (lowercase-dashes) vs `KIFS%202022_3.pdf` (uppercase, underscore).

### Target Documents (2)

| Document | PDF URL | Consolidated? |
|----------|---------|---------------|
| KIFS 2017:7 | `https://www.kemi.se/download/18.409a5d0a193955be16be5e6/1733838775330/KIFS-2017-7-konsoliderad.pdf` | Yes (through KIFS 2024:2) |
| KIFS 2022:3 | `https://www.kemi.se/download/18.691651b517fd1cf3f271825/1649074954677/KIFS%202022_3.pdf` | No (not amended) |

### Monitoring Strategy

**Primary:** Scrape the listing page periodically. Very small corpus (3 base regulations), manual checks feasible.

**No RSS/Atom feed.** lagen.nu has poor KIFS coverage.

---

## 6. Boverket (boverket.se) — BFS

**Ingestion method:** PDF → Claude (Story 9.3)

### Regulation Listing

- **New system:** `https://forfattningssamling.boverket.se/detaljer/{BASE-BFS}` (redirects from old paths)
- **rinfo listing:** `https://rinfo.boverket.se/Lista` — complete list of all regulations
- **Atom feed:** `https://rinfo.boverket.se/index.atom` — machine-readable feed with RDF and PDF links

### PDF Download Patterns

**Original PDFs** on rinfo subdomain:
```
https://rinfo.boverket.se/{BASE-BFS}/pdf/{BFS-NUMBER}.pdf
```
Example: `https://rinfo.boverket.se/BFS2011-16/pdf/BFS2011-16.pdf`

**Consolidated PDFs** on main domain:
```
https://www.boverket.se/resources/constitutiontextstore/{SHORT-NAME}/PDF/konsoliderad_{short-name}_bfs_{year}-{num}.pdf
```
Short names: `ovk` = OVK, `bbr` = BBR, `eks` = EKS, etc.

Amendments grouped under base regulation directory: `rinfo.boverket.se/BFS2011-16/pdf/BFS2023-4.pdf`

### Target Documents (1)

| Document | PDF URL | Consolidated? |
|----------|---------|---------------|
| BFS 2011:16 (OVK) | `https://www.boverket.se/resources/constitutiontextstore/ovk/PDF/konsoliderad_ovk_bfs_2011-16.pdf` | Yes (through BFS 2023:4 / OVK 4) |

Amendment history: BFS 2011:16 (OVK 1) → BFS 2017:10 (OVK 3) → BFS 2023:4 (OVK 4)

### Monitoring Strategy

**Primary:** Parse the Atom feed at `https://rinfo.boverket.se/index.atom`. **Best-structured authority** for automated monitoring — predictable URL patterns, machine-readable feed, connects to lagrummet.se.

---

## 7. MSB/MCF Legacy SRVFS (mcf.se) — SRVFS

**Ingestion method:** PDF → Claude (Story 9.3)

### Important: Legacy Räddningsverket Regulations

SRVFS regulations were issued by **Räddningsverket** (Swedish Rescue Services Agency), which was merged into **MSB** (now **MCF**) in 2009. The SRVFS series is no longer active — no new SRVFS regulations are published. These legacy regulations remain in force and are hosted on mcf.se alongside MSBFS regulations.

### Regulation Listing

- **Same listing as MSBFS:** `https://www.mcf.se/sv/regler/gallande-regler/`
- **SRVFS filter:** `https://www.mcf.se/sv/regler/gallande-regler/?legislation=53`
- **Landing page pattern:** `https://www.mcf.se/sv/regler/gallande-regler/srvfs-{YYYYN}/`

### PDF Download Patterns

Same GUID-based pattern as MSBFS:
```
https://www.msb.se/siteassets/dokument/regler/rs/{GUID}.pdf
```
(msb.se URLs still resolve — they redirect to mcf.se)

### Target Documents (2)

| Document | PDF URL | Consolidated? |
|----------|---------|---------------|
| SRVFS 2004:3 | `https://www.msb.se/siteassets/dokument/regler/rs/51dc9127-8bb3-4bee-8606-98f694a4a5b6.pdf` | No (allmänna råd) |
| SRVFS 2004:7 | `https://www.msb.se/siteassets/dokument/regler/rs/ecc1e5ce-c311-433d-b3e5-f4f63b008386.pdf` | No |

**sourceDomain:** `mcf.se` (hosting authority for legacy SRVFS)

### Monitoring Strategy

No new SRVFS regulations are published. Monitor mcf.se for any revocations or amendments via the same lagen.nu feed used for MSBFS:
```
https://lagen.nu/dataset/myndfs/feed?dcterms_publisher=publisher/statens-raddningsverk
```

---

## 8. Skatteverket (skatteverket.se) — SKVFS

**Ingestion method:** PDF → Claude (Story 9.3)

### Regulation Listing

- **Rättslig vägledning:** `https://www4.skatteverket.se/rattsligvagledning/` (blocks automated/bot access)
- **Index:** `https://www.skatteverket.se/omoss/varverksamhet/rapporterremissvarochskrivelser/forteckningoverforeskrifterochallmannarad`
- **lagen.nu listing:** `https://lagen.nu/dataset/myndfs?rpubl_forfattningssamling=skvfs`

### PDF Download Patterns

Hash-based URLs on www4 subdomain — **not constructible**:
```
https://www4.skatteverket.se/download/18.{HASH}/{TIMESTAMP}/SKVFS%20{YEAR}_{ZERO-PADDED-NUM}.pdf
```

**Bot blocking:** `www4.skatteverket.se/rattsligvagledning/` returns "The requested URL was rejected" for automated access. PDF URLs themselves may still work.

### Target Documents (1)

| Document | PDF URL | Consolidated? |
|----------|---------|---------------|
| SKVFS 2015:6 | `https://www4.skatteverket.se/download/18.190ee20e163797380b13eea/1529405906876/SKVFS%202015_06.pdf` | No (amended by SKVFS 2018:6, amendment PDF not discoverable) |

### Monitoring Strategy

**Primary:** lagen.nu feed:
```
https://lagen.nu/dataset/myndfs/feed?dcterms_publisher=publisher/skatteverket
```
High volume — SKVFS produces many regulations per year. Filter by topic relevance.

---

## 9. SCB (scb.se) — SCB-FS

**Ingestion method:** PDF → Claude (Story 9.3)

### Regulation Listing

- **Main:** `https://www.scb.se/om-scb/scbs-verksamhet/regelverk-och-policyer/foreskrifter/`
- Categories: uppgiftslämnande (data reporting), konsumentprisindex, officiell statistik
- **Landing page pattern:** `https://www.scb.se/om-scb/scbs-verksamhet/regelverk-och-policyer/foreskrifter/uppgiftslamnande/scb-fs-{YYYYNN}/`

### PDF Download Patterns

GUID-based Episerver contentassets — **not constructible**:
```
https://www.scb.se/contentassets/{GUID}/{INTERNAL_ID}-foreskrift-scb-fs-{YYYY}_{NN}.pdf
```

Internal IDs and filenames vary. Must follow landing page links.

### Target Documents (1)

| Document | PDF URL | Consolidated? |
|----------|---------|---------------|
| SCB-FS 2025:19 | `https://www.scb.se/contentassets/fc434ac2550548bcbab57886c357c81c/92030-scb-fs-2025-19-mkost_pdfkorr.pdf` | No (replaces SCB-FS 2024:25 which was removed from SCB website) |

### Monitoring Strategy

**Primary:** Scrape the foreskrifter listing page. **No lagen.nu coverage** — SCB-FS is not indexed in lagen.nu's myndfs dataset.

---

## 10. SSM (stralsakerhetsmyndigheten.se) — SSMFS

**Ingestion method:** PDF → Claude (Story 9.3)

### Regulation Listing

- **Main:** `https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/`
- **Year-level:** `https://www.stralsakerhetsmyndigheten.se/publikationer/foreskrifter/ssmfs-{YYYY}/`
- Supports filtering by year and pagination

### PDF Download Patterns

Episerver contentassets with descriptive filenames:
```
https://www.stralsakerhetsmyndigheten.se/contentassets/{GUID}/ssmfs-{YYYYN}-{descriptive-slug}.pdf
```

Consolidated versions use `-konsoliderad-version` suffix. Regulation and guidance (vägledning) PDFs share the same GUID directory.

### Target Documents (1)

| Document | PDF URL | Consolidated? |
|----------|---------|---------------|
| SSMFS 2018:2 | `https://www.stralsakerhetsmyndigheten.se/contentassets/e731676ddfcd43cbb9bdbc0c01cd5ab6/ssmfs-20182-stralsakerhetsmyndighetens-foreskrifter-om-anmalningspliktiga-verksamheter-konsoliderad-version.pdf` | Yes (consolidated version including amendments SSMFS 2019:1, 2019:4, 2025:2) |

### Monitoring Strategy

**Primary:** Scrape year-level listing pages. New regulations appear under new year directories.

**No lagen.nu coverage** — SSMFS is not indexed.

---

## 11. Swedac (swedac.se) — STAFS

**Ingestion method:** PDF → Claude (Story 9.3)

### Regulation Listing

- **Main:** `https://www.swedac.se/lag-ratt/swedacs-foreskrifter/foreskrifter/`
- **Ongoing rulemaking:** `https://www.swedac.se/lag-ratt/swedacs-foreskrifter/pagaende-foreskriftsarbete/`
- WordPress-based site

### PDF Download Patterns

Standard WordPress uploads — **most predictable pattern**:
```
https://www.swedac.se/wp-content/uploads/{YYYY}/{MM}/stafs-{YYYY}_{N}.pdf
```

Consolidated versions use `-konsol` or `-konsoliderad` suffix.

### Target Documents (1)

| Document | PDF URL | Consolidated? |
|----------|---------|---------------|
| STAFS 2020:1 | `https://www.swedac.se/wp-content/uploads/2020/04/stafs-2020_1.pdf` | No (no amendments adopted yet) |

### Monitoring Strategy

**Primary:** Scrape the Swedac foreskrifter listing page. WordPress-based with predictable URL patterns — simplest authority to monitor.

**No lagen.nu coverage** — STAFS is not indexed.

---

## 12. Remaining Authorities (Not Yet Targeted)

| Authority | Series | Website | Notes |
|-----------|--------|---------|-------|
| Livsmedelsverket | LIVSFS | `https://www.livsmedelsverket.se/` | Food safety regulations — not needed for current templates |

---

## 13. Cross-Reference Summary

| Aspect | AFS | MSBFS | NFS | ELSÄK-FS | KIFS | BFS | SRVFS | SKVFS | SCB-FS | SSMFS | STAFS |
|--------|-----|-------|-----|----------|------|-----|-------|-------|--------|-------|-------|
| **Delivery** | HTML | PDF | PDF | PDF | PDF | PDF | PDF | PDF | PDF | PDF | PDF |
| **Ingestion** | Scrape | Claude | Claude | Claude | Claude | Claude | Claude | Claude | Claude | Claude | Claude |
| **Cost/doc** | $0 | ~$0.30 | ~$0.30 | ~$0.30 | ~$0.30 | ~$0.30 | ~$0.30 | ~$0.30 | ~$0.30 | ~$0.30 | ~$0.30 |
| **URL predictable** | Yes | No | No | **Yes** | No | Partial | No | No | No | No | **Yes** |
| **Consolidated** | In-place | No | Some | Some | Some | Yes | No | No | No | Some | No |
| **Feed** | None | lagen.nu | None | lagen.nu | None | **Atom** | lagen.nu | lagen.nu | None | None | None |
| **lagen.nu** | Yes | Yes | Yes | Yes | Poor | Yes | Yes | Yes | No | No | No |
| **Monitoring** | Scrape | Feed | Scrape | Feed | Scrape | Feed | Feed | Feed | Scrape | Scrape | Scrape |
