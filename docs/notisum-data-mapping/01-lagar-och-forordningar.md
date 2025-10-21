# Lagar och förordningar (Laws and Regulations)

**Section:** Regelsamling → Svensk lagstiftning
**URL Pattern:** `https://www.notisum.se/rn/Default.aspx?pageid=109`

---

## Overview
Complete archive of Swedish laws and regulations from Svensk författningssamling (SFS)

## Access Methods

### 1. Kronologiskt register (Chronological Register)
**Browse by publication year:** 2025 → 1736-1944

**User Interface:**
- Top section: Grid/table view of all SFS numbers from selected year
- Bottom section: Detailed list view with full titles

**Data Structure - List View:**
```
Checkbox | SFS Number | Full Title/Description
---------|------------|----------------------
☐        | SFS 2022:1 | Tillkännagivande (2022:1) av uppgift om Riksbankens referensränta
☐        | SFS 2022:15| Tillkännagivande (2022:15) av de EU-bestämmelser som lagen (2006:805) om foder och animaliska biprodukter kompletterar
☐        | SFS 2022:41| Förordning (2022:41) om ersättning till en läns styrelse för arbete med ett omfattande infrastrukturprojekt
```

**Fields Present:**
- SFS identifier (format: SFS YYYY:NNNN)
- Document type (Lag, Förordning, Tillkännagivande, etc.)
- Full title/description
- Checkbox selection (for bulk operations?)
- Option: "Inkludera upphävda" (include repealed laws)

### 2. Lagförkortningar (Law Abbreviations)
**Browse by abbreviation:** A-Ö alphabetical index

**Data Structure:**
```
Abbreviation | SFS Reference | Full Title
-------------|---------------|------------
ABF          | SFS 2005:559 | Aktiebolagsförordning (2005:559)
ABL          | SFS 2005:551 | Aktiebolagslag (2005:551)
ABLP         | SFS 2005:552 | Lag (2005:552) om införande av aktiebolagslagen (2005:551)
AF           | SFS 2010:1636| Alkoholförordning (2010:1636)
AMF          | SFS 1977:1166| Arbetsmiljöförordning (1977:1166)
```

**Fields Present:**
- Common abbreviation (ABL, AML, etc.)
- SFS identifier
- Full law title

## Data Volume Estimate
- **Years covered:** 289 years (1736-2025)
- **Laws per year:** Varies (2022 had 1826+ SFS entries)
- **Total estimate:** 50,000-100,000+ SFS entries
- **Abbreviations:** Several hundred commonly used abbreviations

## Data Source Identification

### Primary Source: Riksdagen (Swedish Parliament)
- **Website:** https://data.riksdagen.se
- **API:** https://data.riksdagen.se/dokumentlista/?doktyp=sfs
- **Format:** JSON, XML, CSV available
- **Public:** ✅ Yes - completely open API
- **Real-time:** ✅ Updated as new laws are published
- **Historical:** ✅ Complete archive available

### API Details
- **Base:** https://data.riksdagen.se/data/dokument/
- **SFS type:** `doktyp=sfs`
- **Authentication:** ✅ No authentication required
- **Rate limits:** Unknown (need to verify)

### Alternative Sources
- Lagen.nu (open source legal data project)
- Direct scraping from regeringen.se/lagrummet
- Swedish Legal Information Institute (if exists)

### Data Freshness
- **New SFS published:** Daily/weekly in Svensk författningssamling
- **Notisum update frequency:** Unknown (likely daily or real-time via API)
- **Riksdagen API:** Real-time

## Metadata & Enrichment

### What Notisum likely adds:
- Abbreviation mapping (ABL → Aktiebolagslag)
- Categorization/tagging
- Commentary and explanations (from their own legal experts)
- Cross-references to related laws
- Amendment tracking

### What's from source data:
- SFS number
- Publication date
- Full legal text
- Official title
- Department/Ministry
- Effective date

## Individual Law Detail View

When clicking a specific SFS number (e.g., SFS 2022:1), user navigates to individual law page.

### URL Pattern
`https://www.notisum.se/rn/document/?id=YYYYNNNN`
- Example: `?id=20250280` (for SFS 2025:280)
- Example: `?id=SFS2010-0800` (alternative format for Skollagen 2010:800)

### Content Structure - HTML View

**Header Information:**
- SFS number (e.g., "SFS 2025:280")
- Full title (e.g., "Förordning (2025:280) om nationellt professionsprogram för rektorer, lärare och förskollärare")
- Amendment status: "Senaste ändring: -, författningstexten ändras när ändring trätt ikraft"

**Main Content:**
- Full legal text in HTML format
- Structured by paragraphs (§)
- Sections and subsections with headers
- **Cross-references as hyperlinks:** References to other laws (e.g., "skollagen (2010:800)") are clickable links
- Ikraftträdande- och övergångsbestämmelser (Entry into force and transitional provisions)

**Interactive Elements:**
- Tabs: "Fulltext" (default view) and "Fakta & Historik" (Facts & History)
- Print button
- Add to list/favorite functionality (based on UI elements seen)

### Cross-Reference Navigation Flow

**Step 1: Click cross-reference link** (e.g., click "skollagen (2010:800)" in text)
- Navigates to: `https://www.notisum.se/rn/document/?id=SFS2010-0800`

**Step 2: Intermediate summary page shows:**
- SFS number and title
- Summary/description box with key information about the law
- "Visa dokument" (Show document) button
- Tabs for additional information

**Step 3: Click "Visa dokument"**
- Opens official PDF: `https://www.notisum.se/dok/sls/sfs/20100800.pdf`
- PDF URL pattern: `/dok/sls/sfs/[YYYYNNNN].pdf`

### PDF Document Format

**Official SFS PDF contains:**
- Swedish government crown logo
- Header: "Svensk författningssamling"
- SFS number (top right)
- Publication date: "Utkom från trycket den X [month] YYYY"
- Royal decree: "Enligt riksdagens beslut föreskrivs följande"
- Full legal text with official formatting
- Chapters (kap.)
- Paragraphs (§)
- Subsections and numbered lists
- Footnotes with references (e.g., "Prop. 2009/10:165, bet. 2009/10:UbU21, rskr. 2009/10:370")

### Data Fields Present in Detail View

- SFS identifier
- Document type (Lag, Förordning, Tillkännagivande)
- Full title
- Amendment status/history
- Full legal text (HTML + PDF)
- Publication date
- Effective date (ikraftträdande)
- Transitional provisions (övergångsbestämmelser)
- Cross-references to related laws (hyperlinked)
- Royal decree information
- Riksdag proposal references (Prop., bet., rskr.)

### Notisum Value-Add on Detail Pages

**What Notisum provides beyond source data:**
- HTML rendering with interactive cross-links (not just static PDF)
- Summary/description boxes on intermediate pages
- Tabs for "Fakta & Historik"
- Integrated navigation between related laws
- Likely: Consolidated versions (with all amendments incorporated)
- Likely: Commentary and expert analysis (not visible in screenshots but common in legal databases)

**What comes from official source:**
- The PDF files themselves (likely direct from government publication)
- Legal text content
- SFS numbering
- Official publication dates

## Fakta & Historik Tab (Facts & History)

Clicking the "Fakta & Historik" tab reveals comprehensive metadata and amendment history.

### Metadata Section

**Core Facts Displayed:**
- **Myndighet** (Authority/Ministry): e.g., "Utbildningsdepartementet"
- **Beteckning** (Designation): SFS number
- **Utfärdad** (Issued): Original publication date (e.g., "2010-06-23")
- **Uppdaterad** (Updated): Latest amendment incorporated (e.g., "t.o.m. SFS 2025:730")
- **Ikraftträdande** (Entry into force): When law became effective (e.g., "2010-08-01")
- **Uppslagsord** (Keywords/Tags): e.g., "skollag"
- **Förarbeten** (Preparatory works): Riksdag references
  - Prop. (Proposition number)
  - bet. (Committee report - betänkande)
  - rskr. (Parliament decision - riksdagsskrivelse)
  - Example: "Prop. 2009/10:165, bet. 2009/10:UbU21, rskr. 2009/10:370"
- **Kommentar** (Commentary): Summary description of the law's purpose and content

### Amendment History List

Below metadata, chronological list of ALL amendments to the base law.

**Each Amendment Entry Contains:**

```
Ändring : [SFS Number]
Officiell PDF-utgåva av författningen [PDF icon link]

Text :
[Description of what changed]
e.g., "ändr. 29 kap. 1 §; ny 29 kap. 19 b §"
      (amended chapter 29, section 1; new chapter 29, section 19b)

e.g., "upph. 2 kap. 36 §, ändr. 22 kap. 3 §, 23 kap. 2, 4 §§, rubr. närmast
      före 2 kap. 35 §, 7 kap. 4, 11 §§, 24 kap. 16 §, rubr. närmast efter
      3 kap. 3 §, 7 kap. 4, 11 §§, 24 kap. 16 §"
      (upph. = upphävd/repealed, ändr. = ändrad/amended, rubr. = rubrik/heading)

Ikraftträdande :
[When this amendment takes effect]
e.g., "2025-04-01" or "2026-07-01, överg.best." (övergångsbestämmelser = transitional provisions)

Rubrik :
[Full title of the amending law]
e.g., "Lag (2025:182) om ändring i skollagen (2010:800)"

Förarbeten :
[Riksdag preparatory works for this specific amendment]
e.g., "Prop. 2024/25:65, bet. 2024/25:JuU9, rskr. 2024/25:148"

Kommentar :
[Optional: Description of what this amendment does and why]
```

**Amendment Chronology:**
- Listed in reverse chronological order (newest first)
- Shows complete amendment trail from original publication to present
- Example for Skollagen (2010:800): Amendments from 2025:729, 2025:182, 2024:1072, 2024:1074, etc., back to original

### Amendment PDF Structure

Each amendment has an official PDF link. These PDFs contain:

**Header:**
- "Svensk författningssamling" with crown logo
- SFS number (e.g., "SFS 2024:1072")
- Document type: "Lag" (if amendment is itself a law)
- Title: "Lag om ändring i [base law]"
- Publication date: "Publicerad den [date]"
- Issued date: "Utfärdad den [date]"

**Royal Decree:**
"Enligt riksdagens beslut föreskrivs i fråga om [base law]..."

**Amendment Instructions:**
Explicit instructions for how to modify the base law:
- "dels att [section] ska upphöra att gälla" (shall cease to apply)
- "dels att [section] ska ha följande lydelse" (shall have the following wording)
- "dels att rubriken närmast före [section] ska lyda" (heading before section shall read)
- "dels att det ska införas [new sections]" (shall introduce new sections)

**Changed Text:**
Full text of new or modified sections

**Footnotes:**
- Riksdag proposal references (Prop., bet., rskr.)
- "Senaste lydelse av [section]: [previous SFS]" (Most recent wording of section)
  - Shows which previous amendment last touched this section
  - Creates audit trail of changes

**Entry Into Force:**
"Denna lag träder i kraft den [date]"

**Signatures:**
- "På regeringens vägnar"
- Minister name
- Department official name
- Department in parentheses

### Data Fields in Amendment History

**Per Amendment:**
- Amendment SFS number
- Link to official PDF of amendment law
- Text description of changes (which sections affected)
- Entry into force date
- Transitional provisions indicator
- Full title of amendment law
- Preparatory works references (Prop., bet., rskr.)
- Commentary/explanation (optional)
- Previous version footnotes (which SFS last modified each section)

### Data Volume

**For a major law like Skollagen (2010:800):**
- Original publication: 2010
- Years active: 15 years (2010-2025)
- Number of amendments: Dozens to hundreds
- Each amendment: Metadata + full PDF + change description

**For all ~100,000 SFS entries:**
- Many have zero amendments (one-time regulations)
- Major framework laws: 50-200+ amendments over decades
- Total amendment documents: Estimated tens of thousands

## Alternative Views of Same Data

### Law List Modal (Amendment Quick View)

SFS amendment data is also accessible through **custom law lists** feature:

**Context:**
- Users create custom law lists (e.g., "01 ALLMÄNNA REGLER")
- Each list contains selected laws with custom columns/notes
- Lists have user-defined metadata: "Så här påverkas vi" (How this affects us), "Så här uppfyller vi kraven" (How we comply)

**Amendment Modal:**
Clicking zoom icon (🔍) on a law opens amendment history in **table modal format**:

**Columns:**
- Beteckning (SFS number of amendment)
- Utkom den (Publication date)
- Författningsrubrik (Title of amending law)
- Ikraftträdande (Entry into force date)

**Features:**
- Expandable rows showing change details (e.g., "ändr. 6 kap. 7 §")
- PDF links to official amendment documents
- "Kommentera ändring" button (users can add notes on specific amendments)
- Compact, scannable format for quick monitoring

**Data source:** Same amendment history as "Fakta & Historik" tab, just different presentation

**Note:** This reveals Notisum has custom list-building and monitoring features - documented separately in features analysis.

## Research Questions

- [ ] Does Riksdagen API include full legal text or just metadata?
- [ ] Can we access the official SFS PDFs directly without Notisum?
- [ ] Does Riksdagen API provide cross-reference data, or does Notisum parse and create these links?
- [ ] What's in the "Fakta & Historik" tab? Amendment timeline? Related documents?
- [ ] Are the HTML versions consolidated (with amendments) or original versions?
- [ ] Does abbreviation mapping exist in source data or is it Notisum's curation?
- [ ] What is the actual update frequency?
- [ ] Are there rate limits on the API?
