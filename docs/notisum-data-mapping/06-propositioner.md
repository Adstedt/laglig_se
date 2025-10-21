# Propositioner (Government Bills)

**Section:** Regelsamling → Svensk lagstiftning → Propositioner
**URL Pattern:** `https://www.notisum.se/rn/document/?id=PYYYYNN`

---

## Overview

Government bills (propositioner) submitted by the Swedish government (Regeringen) to the Riksdag for consideration and voting. These are formal legislative proposals that, if approved, become Swedish law (SFS).

**Key characteristics:**
- Official legislative proposals from the government to parliament
- Contains draft legal text of proposed laws
- Includes explanatory memoranda and justifications
- Critical part of **förarbeten** (preparatory works/legislative history)
- Used for interpreting enacted laws

---

## What are Förarbeten (Preparatory Works)?

**Förarbeten** refers to the documents produced during the legislative process:
1. **Propositioner** (Government bills) - formal proposals to Riksdag
2. **Statens offentliga utredningar (SOU)** - Government inquiry reports
3. **Departementsserier (Ds)** - Ministry publications
4. **Committee reports (Utskottsbetänkanden)** - Parliamentary committee analysis
5. **Riksdag debates** - Parliamentary discussions

**Legal significance:** Swedish courts use förarbeten to interpret the intent of laws. When a law's meaning is unclear, courts look to propositioner to understand what the legislator intended.

---

## Structure

**Same layout as SFS laws:**
- **Kronologiskt register** (chronological by parliamentary session)
- **Grid view** + **detailed list view**
- Checkbox interface for selecting multiple documents
- Direct PDF links in detailed view

**Session-based organization:**
- Format: YYYY/YY (e.g., 2023/24 = session spanning 2023-2024)
- Each parliamentary session runs roughly September to June
- Covers historical sessions back to 1971

**Example from screenshot:**
- Latest: 2025/26, 2024/25, 2023/24...
- Historical: Going back to 1971 and earlier

---

## Numbering Format

**Pattern:** `Prop. YYYY/YY:NN`

**Breakdown:**
- `Prop.` = Proposition
- `YYYY/YY` = Parliamentary session (e.g., 2023/24)
- `:` = Separator
- `NN` = Sequential number within that session

**Examples:**
- `Prop. 2023/24:28` = Government bill #28 from 2023/24 session
- `Prop. 2023/24:1` = Budget bill (always first proposition of session)
- `Prop. 2022/23:145` = Bill #145 from 2022/23 session

**Special propositions:**
- `Prop. 2023/24:1` = **Budget bill** (Budgetpropositionen) - always the first and most comprehensive

---

## URL Pattern

**Format:** `https://www.notisum.se/rn/document/?id=PYYYYNN`

**Condensed from full numbering:**
- Full format: `Prop. 2023/24:28`
- URL format: `id=P2324028`
- `P` = Proposition identifier
- `23` = First year of session (2023)
- `24` = Second year of session (2024)
- `028` = Zero-padded proposition number

**Examples:**
- `Prop. 2023/24:28` → `id=P2324028`
- `Prop. 2023/24:1` → `id=P2324001`
- `Prop. 2022/23:145` → `id=P2223145`

---

## Individual Proposition Detail View

### Proposition Page Structure

**Header:**
- Full proposition number: "Prop. 2023/24:28"
- Title: e.g., "Sänkning av reduktionsplikten för bensin och diesel"
- Subtitle/summary (one-line description)

**Government submission metadata:**
- **Regeringens proposition:** Proposition number
- **Submission date:** "Regeringen överlämnar denna proposition till riksdagen. Stockholm den 12 oktober 2023"
- **Authors:** Names and titles of ministers who signed
  - Example: "Ulf Kristersson" (Prime Minister)
  - Example: "Ebba Busch" (Deputy Prime Minister)
- **Responsible ministry:** "(Klimat- och näringsdepartementet)"

### Content Structure

**1. Propositionens huvudsakliga innehåll (Main Content Summary):**
- Plain-language summary of what the bill proposes
- Key measures and their expected effects
- Timeline for implementation

**2. Innehållsförteckning (Table of Contents):**
- Structured outline of all sections
- Numbered sections with page numbers
- Links to each section (clickable in web view)

**3. Main body sections:**
- **Förslag till riksdagsbeslut** - Proposed parliamentary decision
- **Förslag till lag/förordning** - Draft legal text of proposed law(s)
- **Ärendet och dess beredning** - Background and preparation
- **Överväganden** - Considerations and analysis
- **Konsekvensanalys** - Impact assessment
- **Författningskommentar** - Commentary on each legal provision

### Internal Linking

**Critical feature:** Links to referenced laws within the text

**Example from screenshot:**
"Förslag till lag om ändring i inkomstskattelagen (1999:1229)"

When clicked, these links navigate to:
- The specific law being amended (SFS 1999:1229)
- Or the specific section (11 kap. 22 §)

This creates a **web of cross-references** between:
- Propositioner → SFS laws being amended
- Propositioner → Other propositioner
- Propositioner → SOU reports referenced
- Internal sections within the same proposition

---

## PDF Access

**Direct PDF links in detailed list view:**
- Each proposition has a PDF icon
- Links to official formatted PDF version
- Example: "Avgift vid prövning av en tvist hos Allmänna reklamationsnämnden, prop. 2023/24:5 (pdf 485 kB)"

**PDF contains:**
- Official government formatting
- Signatures of ministers
- Page numbers matching table of contents
- Annexes and appendices

---

## Data Source

**Primary Source:** Riksdagen (Swedish Parliament)

**API endpoint:** https://data.riksdagen.se/dokumentlista/?doktyp=prop

**Available data:**
- Full proposition text (HTML and PDF)
- Structured metadata (authors, dates, keywords)
- Related documents (committee reports, debates)
- Voting records (after parliamentary decision)
- Amendment history

**Format options:**
- JSON
- XML
- HTML
- PDF

**Access:** ✅ Completely free and public

---

## Data Volume Estimate

**Sessions per year:** 1 session spanning two calendar years (e.g., 2023/24)

**Propositions per session:** Varies widely
- Budget session (fall): 100-200 propositions
- Full year: 150-300+ propositions
- Budget bill alone can be 1,000+ pages

**Historical coverage:**
- Modern format: 1971-present (50+ years)
- Older format: Earlier historical propositions available

**Total estimate:** 10,000-15,000+ propositions in Riksdagen database

---

## Types of Propositioner

**1. Budgetpropositionen (Prop. X:1):**
- Always first proposition of each session
- Comprehensive budget for all government areas
- Largest single document (often 1,000+ pages)

**2. Regular legislative proposals:**
- New laws
- Amendments to existing laws
- Ratification of international agreements

**3. Supplementary budget propositions:**
- Additional spending proposals during the year
- Numbered sequentially after main budget

---

## Relationship to SFS Laws

**Legislative workflow:**
1. **Government drafts proposition** (often based on SOU inquiry)
2. **Proposition submitted to Riksdag**
3. **Parliamentary committee review** (creates Utskottsbetänkande)
4. **Riksdag debates and votes**
5. **If approved: becomes law** → published in SFS
6. **SFS law references the proposition** in its preamble

**Example:**
- Proposition 2023/24:28 proposes changes to tax law
- Riksdag approves
- New law published as SFS 2024:XXX
- SFS law preamble states: "enligt riksdagens beslut i enlighet med proposition 2023/24:28"

---

## Why Propositioner Matter for Legal Research

**1. Legislative Intent:**
- When law text is ambiguous, courts look to proposition
- "Författningskommentar" section explains each legal provision
- Shows what problem the law was meant to solve

**2. Context and Background:**
- Why was the law needed?
- What alternatives were considered?
- What effects were anticipated?

**3. Practical Examples:**
- Propositions often include real-world scenarios
- Illustrate how law should be applied

**4. Referenced in Court Rulings:**
- Swedish courts cite propositioner frequently
- "Enligt förarbetena..." (According to preparatory works...)

---

## Relevance for Laglig.se

**High value for professional users:**
1. **Lawyers and legal professionals** - Essential for legal interpretation
2. **Compliance officers** - Understand intent behind regulations
3. **Policy analysts** - Track legislative changes and reasoning

**Moderate value for SMBs:**
- Most businesses need "what is the law" (SFS) not "why was it made"
- Exception: complex compliance situations requiring interpretation

**Recommendation for Laglig.se:**

**MVP (Phase 1):**
- ❌ **Skip** - Focus on SFS laws themselves
- Link to Riksdagen for users who need förarbeten

**Phase 2 (Professional tier):**
- ✅ **Include** - Full proposition database
- **Key feature:** Automatic linking from SFS laws to their propositioner
  - "This law was proposed in Prop. 2023/24:28 - read the background"
- **AI opportunity:** Summarize lengthy propositions
  - "This 400-page bill introduced 3 key changes to tax law: [summary]"

**Phase 3 (Enterprise/Legal tier):**
- Include other förarbeten (SOU, Ds, Utskottsbetänkanden)
- Full-text search across all preparatory works
- Citation mapping (which court cases reference this proposition)

---

## Technical Integration Notes

**Riksdagen API provides:**
- Full proposition text in structured format
- Metadata (authors, dates, keywords)
- Related documents (SOU that led to prop, committee reports)
- Cross-references between propositions
- Links to parliamentary debates
- Voting records

**Linking opportunities:**
1. **SFS → Proposition:** Show which proposition created/amended each law
2. **Proposition → SFS:** Show which laws resulted from each proposition
3. **Proposition → SOU:** Show background inquiry reports
4. **Cross-document search:** Find all propositions mentioning specific topic

---

## Key Differences from SFS

| Feature | SFS Laws | Propositioner |
|---------|----------|---------------|
| **What it is** | Enacted law (binding) | Proposal for law (not yet binding) |
| **Author** | Riksdag (after vote) | Government (Regeringen) |
| **Legal status** | Legally binding | Explanatory/historical |
| **Usage** | "What is the law?" | "Why was it made this way?" |
| **Numbering** | SFS YYYY:NNNN | Prop. YYYY/YY:NN |
| **Session-based** | No - calendar year | Yes - parliamentary session |
| **Length** | Usually concise | Often lengthy with explanations |
| **Court citation** | Primary source | Secondary source (interpretation) |

---

## Example Use Case

**Scenario:** A business needs to understand new environmental regulations in SFS 2024:XXX

**Without propositioner:**
- Reads law text: "företag ska minska utsläpp med 20%"
- Question: What counts as "utsläpp"? Which industries are affected?

**With propositioner:**
- Finds Prop. 2023/24:28 that proposed the law
- Reads "Författningskommentar" section
- Discovers: "Med utsläpp avses endast direkta utsläpp från produktionsprocessen, ej indirekta från transporter"
- Gets clarity on scope and application

---

## Research Questions

- [ ] Does Riksdagen API include full-text search within propositioner?
- [ ] Can we automatically extract the "Författningskommentar" sections for each law?
- [ ] How are cross-references between proposition text and SFS structured in the data?
- [ ] Are there standardized section numbers across all propositioner?
- [ ] Can we map which SFS laws resulted from which propositioner automatically?
