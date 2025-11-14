# EU Förordningar (EU Regulations)

**Section:** Regelsamling → Europalagstiftning → Förordningar
**URL Pattern:** `https://www.notisum.se/rn/document/?id=YYYRNNNNN`

---

## Overview

EU regulations (Förordningar) adopted by the European Commission or jointly by European Parliament and Council. Swedish translations from EU Official Journal (Europeiska unionens officiella tidning - EUT).

**Key characteristics:**

- Binding in entirety
- Directly applicable in all EU member states
- Published in Swedish in EUT (L-series for legislation)

---

## Access Methods

### 1. Kronologiskt register (Chronological Register)

**Browse by year:** 2025 → 1958

**User Interface:**

- Years displayed as clickable buttons
- Covers full period of Sweden's EU involvement (1958 onwards for EEC regulations)

**Clicking a year (e.g., 2023) shows:**

**Top section:** Grid/table view

- Compact layout of regulation numbers
- Format: (EU) nr 1/2023, (EU) nr 2/2023, (EU) nr 3/2023, etc.
- Quick browsing of hundreds of regulations per year

**Bottom section:** "DETALJERAD INFORMATION OM FÖRFATTNINGARNA"

- Full detailed list view
- Checkbox for each regulation
- Options: "Inkludera upphävda" (include repealed), "Inkludera rättelse" (include corrections)

### 2. Detailed List View Structure

**Format:** Same as SFS - checkbox + full title

**Example entry:**

```
☐ | (EU) nr 1/2023 | Kommissionens genomförandeförordning (EU) 2023/1 av den 21 december 2022 om godkännande av en annan ändring än en mindre ändring av produktspecifikationen för ett namn som lagts upp i registret över skyddade ursprungsbeteckningar och skyddade geografiska beteckningar ("Baker [Butter]")
```

**Data fields visible:**

- EU regulation number: (EU) nr YYYY/NNNN
- Document type in title: "Kommissionens genomförandeförordning", "Kommissionens förordning", "Kommissionens delegerade förordning", etc.
- Date: "av den DD månadsnamn YYYY"
- Full Swedish title describing what the regulation does
- Parenthetical notes: e.g., "(Text av betydelse för EES)" = Text of relevance for EEA

---

## Individual Regulation Detail View

### URL Pattern

`https://www.notisum.se/rn/document/?id=YYYRNNNNN`

**Format breakdown:**

- `YYY` = Last 3 digits of year (e.g., 323 = 2023, 32016 = 2016 for older format)
- `R` = Regulation indicator
- `NNNNN` = Regulation number (zero-padded)

**Examples:**

- (EU) 2023/139 → `id=323R0139`
- (EU) 2016/429 → `id=32016R0429`

### Content Structure - HTML View

**Header:**

- Full regulation title in Swedish
- Publication reference: "SV Europeiska unionens officiella tidning L 19/76"
  - L = Lagstiftning (Legislation series)
  - 19/76 = Issue/page number
- Date: "20.1.2023" (publication date in EU Official Journal)

**Document metadata:**

- **"Original från EUT"** button - links to official PDF
- Commission/Parliament/Council identifying text
- Preamble: References to EU treaties and legal basis
- Recitals: Numbered "whereas" statements explaining reasoning
- Articles: Numbered substantive provisions
- Entry into force: "Denna förordning träder i kraft dagen efter..."
- Signatures: "På kommissionens vägnar" + Commissioner name + title

**Interactive elements:**

- **"Källtext EUR-Lex"** button - links to EUR-Lex official source
- **"Fakta & Historik"** tab (same as SFS)
- Print functionality

### PDF Document Format

**Official PDF contains (Swedish translation from EUT):**

- EU flag logo
- Header: "Europeiska unionens officiella tidning"
- Language indicator: "SV" (Svenska)
- Series: L (Lagstiftning) or C (Information)
- Regulation identifier: e.g., "KOMMISSIONENS GENOMFÖRANDEFÖRORDNING (EU) 2023/139"
- Date: "av den DD månadsnamn YYYY"
- Subject matter in title
- "(Text av betydelse för EES)" if applicable
- Legal basis recitals
- Substantive articles
- Entry into force provisions
- Commission signature block
- Annexes (if applicable)

---

## Data Source Identification

### Primary Source: EUR-Lex (EU's Official Legal Database)

**Website:** https://eur-lex.europa.eu/
**API:** EUR-Lex provides free API access

**Key details:**

- **Public:** ✅ Yes - completely free and open
- **Format:** XML, HTML, PDF available
- **Languages:** All 24 official EU languages including Swedish
- **Coverage:** All EU legal acts from 1952 onwards
- **Real-time:** ✅ Updated daily as new regulations published
- **Historical:** ✅ Complete archive

### EUR-Lex Document Structure

**CELEX number system:**

- Format: `3YYYYRNNNN` for regulations
- Example: `32023R0139` for Regulation (EU) 2023/139
  - `3` = secondary legislation
  - `2023` = year
  - `R` = regulation
  - `0139` = sequential number

**Notisum URL mapping:**

- Notisum `id=323R0139` ≈ EUR-Lex `CELEX:32023R0139`
- Direct correspondence between systems

### EUR-Lex API Access

**Base URL:** https://eur-lex.europa.eu/
**Document URL pattern:** `/legal-content/SV/ALL/?uri=CELEX:32023R0139`
**Download formats:**

- PDF (official formatted version)
- HTML (web version)
- XML (machine-readable)
- Metadata in RDF/XML

**Available data per regulation:**

- Full legal text in Swedish (and all 24 EU languages)
- Publication reference (Official Journal L/C series, issue, page)
- Dates: adoption, publication, entry into force
- Legal basis (which EU treaty articles authorize it)
- Author: Commission, Parliament+Council, Council alone
- Subject matter classification codes (EUROVOC)
- Relationship to other acts: amendments, repeals, implementations
- Consolidated versions (incorporates amendments)
- National implementation measures (how member states apply it)

---

## Fakta & Historik Tab

**Same structure as SFS**, showing:

**Metadata:**

- Author body (Europeiska kommissionen, etc.)
- Responsible directorate
- Form: Genomförandeförordning, Delegerad förordning, etc.
- Additional information: "av betydelse för EES"
- CELEX number
- Publication reference

**Relationship to other documents:**

- Treaty basis
- Legal basis from other regulations/directives
- Select all documents mentioning this regulation
- Modifications table showing:
  - Relation (Modifies, ersätter, tillägg, etc.)
  - Act number
  - Comment
  - Subdivision concerned
  - Dates (from/to)

**Amendment history:**

- Lists all amending regulations (if any)
- Shows which provisions were changed
- Links to amending regulation PDFs

---

## Data Volume Estimate

**Years covered:** 1958-2025 (67 years)
**Regulations per year:** Varies widely

- Recent years (2020s): 2,000-3,000+ regulations/year
- Historical: Lower volume

**Example from 2023:**
Based on screenshot showing regulations up to (EU) nr 2920/2023 (December), approximately **2,920+ regulations in 2023**

**Total estimate:** 100,000+ EU regulations in database

---

## Metadata & Enrichment

### What Notisum likely adds:

- Swedish language interface and navigation
- Same "Fakta & Historik" tab structure as for SFS
- Integration with Swedish legal framework
- Cross-references to related Swedish implementation laws
- User annotation/commenting features

### What comes from EUR-Lex source:

- Full regulatory text in Swedish
- Official PDF formatted versions
- CELEX numbers
- Publication references
- Legal basis information
- Amendment relationships
- Entry into force dates
- Consolidated versions

---

## Key Differences from SFS

**Similarities:**

- Chronological register navigation
- Detailed list views
- Individual document pages
- Fakta & Historik tab
- PDF access

**Differences:**

- **Source:** EUR-Lex (EU) vs. Riksdagen (Swedish national)
- **Numbering:** (EU) YYYY/NNNN vs. SFS YYYY:NNNN
- **Language:** Swedish translation of EU documents vs. original Swedish laws
- **Authority:** EU Commission/Parliament/Council vs. Swedish Riksdag
- **External link:** EUR-Lex button (not present for SFS)
- **Amendments:** Often modified by other EU regulations, less frequent than SFS
- **Applicability:** Directly binding across all EU member states

---

## Research Questions

- [ ] Does EUR-Lex API include consolidated versions (with amendments incorporated)?
- [ ] How frequently are Swedish translations published after original EU regulation?
- [ ] Does EUR-Lex provide cross-references to national implementing laws?
- [ ] Are there rate limits on EUR-Lex API?
- [ ] How does Notisum handle regulations that amend Swedish laws directly?
- [ ] Does Notisum provide Swedish commentary on EU regulations or just translations?
