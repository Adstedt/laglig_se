# Feature Specification: Law Pages (Alla Lagar)

**Document Version:** 1.0
**Last Updated:** 2024-01-20
**Status:** Draft
**Owner:** Product Team

---

## Executive Summary

The Law Pages (Alla Lagar) feature is Laglig.se's content foundation - a comprehensive, searchable database of 10,000+ Swedish laws sourced from Riksdagen's open data API. This feature serves three strategic purposes:

1. **Content Moat** - Structured, categorized, AI-enhanced law database that competitors cannot easily replicate
2. **SEO Engine** - Public law pages rank for "[law name] sweden" searches, driving organic growth
3. **RAG Backbone** - Properly chunked and embedded law content powers the AI Chat Interface

**Key Differentiators:**

- **B2B Focus** - Auto-classification filters out irrelevant private/consumer laws
- **Popular Abbreviations** - Users search by "LAS" or "ABL", not SFS numbers
- **SNI-Based Discovery** - Enter industry code → Get relevant laws instantly
- **Plain-Language Summaries** - AI-generated explanations for non-lawyers
- **GitHub-Style Diff View** - See exactly what changed in law amendments
- **Team Collaboration** - @mention colleagues in law notes

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Information Architecture](#information-architecture)
3. [Landing Page (/alla-lagar)](#landing-page-alla-lagar)
4. [Category Browsing](#category-browsing)
5. [Individual Law Pages](#individual-law-pages)
6. [Search & Discovery](#search--discovery)
7. [SNI-Based Law Discovery](#sni-based-law-discovery)
8. [Popular Abbreviations](#popular-abbreviations)
9. [Add to List Workflow](#add-to-list-workflow)
10. [Law Change Tracking & Diff View](#law-change-tracking--diff-view)
11. [Notes & Team Collaboration](#notes--team-collaboration)
12. [Content Sourcing & Maintenance](#content-sourcing--maintenance)
13. [SEO & Public Access Strategy](#seo--public-access-strategy)
14. [Technical Implementation](#technical-implementation)
15. [Post-MVP Features](#post-mvp-features)

---

## Core Principles

### 1. B2B-First Content Strategy

**Not all Swedish laws are relevant to businesses.**

**Problem:** Riksdagen API returns ~10,000+ laws, including inheritance law, marriage law, child custody law, etc.

**Solution:** AI-powered classification tags every law as:

- **B2B** (business-relevant)
- **Private** (personal/consumer)
- **Both** (e.g., GDPR applies to businesses and individuals)

**Default filter:** Show only B2B laws (users can toggle to see all)

### 2. Discovery Over Search

**Users don't know what laws apply to them.**

**Problem:** Small business owner doesn't know "I need Arbetsmiljölagen, Anställningsskyddslagen, and Arbetstidslagen"

**Solution:**

- **SNI code input** → "Your restaurant (SNI 56.101) should track these 12 laws"
- **Popular abbreviations** → "Everyone in business knows 'LAS' - start there"
- **AI suggestions** → "Companies tracking Arbetsmiljölagen also add Arbetstidslagen (90%)"

### 3. Plain-Language Accessibility

**Legal text is impenetrable for non-lawyers.**

**Problem:** "Arbetsgivaren skall systematiskt planera, leda och kontrollera verksamheten på ett sätt som leder till att arbetsmiljön uppfyller föreskrivna krav på en god arbetsmiljö..."

**Solution:** AI-generated plain-language summary:

> "This law requires employers to systematically assess and manage workplace safety risks. You must document risk assessments and update them when changes occur."

### 4. Change Transparency

**Laws change frequently - users must stay informed.**

**Problem:** Arbetsmiljölagen amended on 2024-01-15. User's compliance plan is now outdated.

**Solution:**

- Status badges: "📝 Uppdaterad" on law cards
- GitHub-style diff view: See old vs. new text side-by-side
- AI change summary: "New section 3:2a requires digital work environment assessments"
- Automatic notifications if law in user's list

### 5. SEO-Driven Growth

**Law pages are public to drive organic traffic.**

**Strategy:**

- Every law page is public (no login required)
- Optimized for "[law name]", "[law abbreviation]", "[law topic] sweden"
- Beautiful design reduces bounce rate
- "Add to list" CTA requires signup → Conversion funnel

---

## Information Architecture

### Hierarchy Overview

```
Alla Lagar (Landing Page)
├── Popular Abbreviations (ABL, LAS, AML, etc.)
├── SNI Discovery (Enter industry → Get laws)
├── Categories (8-10 top-level)
│   ├── Arbetsrätt (Labor Law)
│   │   ├── Arbetsmiljö (Work Environment)
│   │   │   └── Individual Law Pages
│   │   ├── Anställningsskydd (Employment Protection)
│   │   └── Arbetstid (Working Hours)
│   ├── Dataskydd & Integritet (Data Protection)
│   ├── Skatterätt (Tax Law)
│   ├── Bolagsrätt (Corporate Law)
│   ├── Miljö & Bygg (Environment & Construction)
│   ├── Livsmedel & Hälsa (Food & Health)
│   ├── Finans & Försäkring (Finance & Insurance)
│   ├── Immaterialrätt (IP Law)
│   ├── Konsumentskydd (Consumer Protection)
│   └── Transport & Logistik (Transport & Logistics)
└── Trending Laws (Most viewed this week)
```

---

### Category Structure (Fixed for MVP)

**Top-Level Categories (10):**

1. **Arbetsrätt** (Labor Law) - ~150 laws
   - Arbetsmiljö, Anställningsskydd, Arbetstid, Diskriminering, Föräldraledighet

2. **Dataskydd & Integritet** (Data Protection) - ~20 laws
   - GDPR-relaterade, Integritetslag, Säkerhetsskydd

3. **Skatterätt** (Tax Law) - ~200 laws
   - Inkomstskatt, Moms, Arbetsgivaravgifter, Skattebrottslagen

4. **Bolagsrätt** (Corporate Law) - ~50 laws
   - Aktiebolagslagen, Årsredovisningslagen, Revisionslagen

5. **Miljö & Bygg** (Environment & Construction) - ~100 laws
   - Miljöbalk, Plan- och bygglagen, Arbetsmiljö på byggarbetsplatser

6. **Livsmedel & Hälsa** (Food & Health) - ~80 laws
   - Livsmedelslag, Alkohollag, Tobakslag, Hälsoskydd

7. **Finans & Försäkring** (Finance & Insurance) - ~60 laws
   - Penningtvättslag (AML), Försäkringsavtal, Värdepappersmarknadslagen

8. **Immaterialrätt** (IP Law) - ~30 laws
   - Upphovsrättslag, Patentlag, Varumärkeslag

9. **Konsumentskydd** (Consumer Protection) - ~40 laws
   - Konsumentköplag, Marknadsföringslag, Distansavtalslagen

10. **Transport & Logistik** (Transport & Logistics) - ~50 laws
    - Vägtrafikförordning, Transportstyrelsens föreskrifter

**Total B2B laws:** ~780 (filtered from 10,000+ total)

---

## Landing Page (/alla-lagar)

### Layout

```
┌────────────────────────────────────────────────────┐
│  HERO SECTION                                      │
│  ┌────────────────────────────────────────────┐   │
│  │ Alla svenska lagar på ett ställe          │   │
│  │ Sök bland 10,000+ lagar eller hitta       │   │
│  │ relevanta lagar för din bransch           │   │
│  │                                            │   │
│  │ [Sök efter lag, föreskrift, eller tema]   │   │
│  │                                            │   │
│  │ Eller hitta lagar för din bransch:        │   │
│  │ [SNI-kod eller bransch (t.ex. restaurang)]│   │
│  │ [Sök →]                                    │   │
│  └────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────┤
│  POPULÄRA FÖRKORTNINGAR                            │
│  ┌────┬────┬────┬────┬────┬────┬────┬────┐       │
│  │ABL │LAS │AML │ATL │MBL │GDPR│PuL │PBL │       │
│  └────┴────┴────┴────┴────┴────┴────┴────┘       │
│  [Visa alla 50+ förkortningar →]                   │
├────────────────────────────────────────────────────┤
│  KATEGORIER                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │⚖️ Arbets-│ │🔒 Data-  │ │💰 Skatte-│          │
│  │   rätt   │ │  skydd   │ │   rätt   │          │
│  │ 156 lagar│ │ 24 lagar │ │ 203 lagar│          │
│  └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │🏢 Bolags-│ │🌱 Miljö &│ │🍽️ Livs-  │          │
│  │   rätt   │ │   Bygg   │ │  medel   │          │
│  │ 52 lagar │ │ 98 lagar │ │ 81 lagar │          │
│  └──────────┘ └──────────┘ └──────────┘          │
│  [Visa alla kategorier →]                          │
├────────────────────────────────────────────────────┤
│  MEST ANVÄNDA LAGAR (DENNA VECKAN)                 │
│  1. Arbetsmiljölagen (AML) - 1,234 företag        │
│  2. Anställningsskyddslagen (LAS) - 1,156 företag │
│  3. Dataskyddsförordningen (GDPR) - 1,089 företag │
│  4. Arbetstidslagen (ATL) - 987 företag           │
│  5. Aktiebolagslagen (ABL) - 856 företag          │
│  [Visa alla →]                                     │
├────────────────────────────────────────────────────┤
│  SENAST UPPDATERADE LAGAR (30 DAGAR)               │
│  📝 Arbetsmiljölagen - Ändrad 2024-01-15          │
│      "Ny paragraf om digital arbetsmiljö"         │
│  📝 Penningtvättslagen - Ändrad 2024-01-10        │
│      "Höjda beloppsgränser för ID-kontroll"       │
│  📝 Mervärdesskattelagen - Ändrad 2024-01-08      │
│      "Reviderade regler för e-handel"             │
│  [Visa alla ändringar →]                           │
└────────────────────────────────────────────────────┘
```

---

### Hero Section

**Headline:** "Alla svenska lagar på ett ställe"

**Subheadline:** "Sök bland 10,000+ lagar eller hitta relevanta lagar för din bransch"

**Primary CTA:** Search bar with two modes:

1. **Law search:** "Sök efter lag, föreskrift, eller tema..."
2. **SNI/Industry search:** "SNI-kod eller bransch (t.ex. restaurang, bygg, detaljhandel)"

**Design notes:**

- Clean, minimal design (reduce cognitive load)
- Search bar is prominent (40% of hero section)
- Subtle background: Light gradient or legal-themed illustration (scales, gavel)

---

### Popular Abbreviations Section

**Why this matters:**

- Business users think in abbreviations: "We need LAS compliance" not "Lagen (1982:80) om anställningsskydd"
- Most searched terms on legal sites are abbreviations
- Quick-access to most common laws

**Display:**

- **Horizontal scrollable chips** (mobile) or **Grid** (desktop)
- Each chip shows: **Abbreviation** + **Law name on hover**
- Clicking chip → Opens that law's page

**Top 20 abbreviations (from Notisum scrape):**

**Labor:**

- **LAS** - Lagen om anställningsskydd
- **AML** - Arbetsmiljölagen
- **ATL** - Arbetstidslagen
- **SemL** - Semesterlagen
- **MBL** - Medbestämmandelagen
- **DiskL** - Diskrimineringslagen
- **FML** - Föräldraledighetslagen

**Corporate:**

- **ABL** - Aktiebolagslagen
- **ÅRL** - Årsredovisningslagen
- **BFL** - Bokföringslagen
- **RevL** - Revisionslagen

**Tax:**

- **IL** - Inkomstskattelagen
- **ML** - Mervärdesskattelagen
- **SFL** - Skatteförfarandelagen

**Finance:**

- **PuL** - Penningtvättslagen
- **BankL** - Banklagen

**Data:**

- **GDPR** - Dataskyddsförordningen (EU)

**Construction:**

- **PBL** - Plan- och bygglagen
- **MB** - Miljöbalken

**Consumer:**

- **KKL** - Konsumentköplagen

**Link:** "Visa alla 50+ förkortningar →" opens modal with full list

---

### Categories Grid

**Visual design:**

- **Card-based layout** (e-commerce style)
- Each card shows:
  - Icon (emoji or custom SVG)
  - Category name
  - Law count ("156 lagar")
  - Hover effect: Card lifts, shows "Utforska →"

**8 categories visible** on landing page, "Visa alla kategorier →" link expands

**Click behavior:** Opens category page (see Category Browsing section)

---

### Trending Laws Section

**Purpose:** Social proof + discovery

**Data source:** Track law page views in last 7 days, rank by view count

**Display:**

- Numbered list (top 5)
- Law name + abbreviation
- "X företag använder" (how many companies have it in their lists)
- Click → Opens law page

**Why this works:**

- "1,234 companies track this law" → FOMO, credibility
- Introduces users to laws they might not have considered

---

### Recent Updates Section

**Purpose:** Show freshness, encourage return visits

**Data source:** Laws amended in last 30 days

**Display:**

- Chronological list (most recent first)
- Status icon: 📝 (updated), 🆕 (new), ⚠️ (repealed)
- Law name + date
- AI-generated one-line change summary
- Click → Opens law page, scrolls to change banner

**Why this works:**

- Shows the database is actively maintained
- Encourages users to check back weekly (retention)
- SEO: Fresh content signals to Google

---

## Category Browsing

### Category Page Layout

**URL:** `/alla-lagar/kategori/arbetsratt`

```
┌────────────────────────────────────────────────────┐
│ Breadcrumb: Alla Lagar > Arbetsrätt               │
├────────────────────────────────────────────────────┤
│ HEADER                                             │
│ ⚖️ Arbetsrätt                                      │
│ 156 lagar som reglerar arbetsgivar-anställd       │
│ relationer, arbetsmiljö, och arbetstid             │
├────────────────────────────────────────────────────┤
│ SIDEBAR (Filters)          │ MAIN CONTENT          │
│                            │                       │
│ Underkategorier:           │ [Sort by: Relevans ▼]│
│ ☐ Arbetsmiljö (45)         │ [Filter: Alla ▼]     │
│ ☐ Anställningsskydd (32)   │                       │
│ ☐ Arbetstid (28)           │ ┌──────────────────┐ │
│ ☐ Diskriminering (18)      │ │ 📝 Arbetsmiljö-  │ │
│ ☐ Föräldraledighet (12)    │ │    lagen (AML)   │ │
│                            │ │ SFS 1977:1160    │ │
│ Status:                    │ │ Uppdaterad:      │ │
│ ☑ Gällande (150)           │ │ 2024-01-15       │ │
│ ☐ Upphävda (6)             │ │                  │ │
│                            │ │ Reglerar arbets- │ │
│ Uppdaterad:                │ │ miljö och säker- │ │
│ ☐ Senaste 30 dagarna (3)   │ │ het på arbets-   │ │
│ ☐ Senaste 90 dagarna (8)   │ │ platsen...       │ │
│                            │ │ [Läs mer →]      │ │
│ [Rensa filter]             │ └──────────────────┘ │
│                            │                       │
│                            │ ┌──────────────────┐ │
│                            │ │ Anställnings-    │ │
│                            │ │ skyddslagen (LAS)│ │
│                            │ │ ...              │ │
│                            │ └──────────────────┘ │
│                            │                       │
│                            │ [Load more]          │
└────────────────────────────┴───────────────────────┘
```

---

### Sidebar Filters

**Subcategories:**

- Checkboxes for each subcategory
- Show law count per subcategory
- Multi-select (can check multiple)

**Status:**

- ☑ Gällande (Active) - Default checked
- ☐ Upphävda (Repealed)
- ☐ Upphävda och ersatta (Superseded)

**Recently Updated:**

- ☐ Senaste 30 dagarna
- ☐ Senaste 90 dagarna
- ☐ Senaste året

**[Rensa filter]** button resets all

---

### Sort Options

**Sort by:**

- **Relevans** (Default) - Most tracked + recently updated
- **Namn (A-Ö)** - Alphabetical
- **Senast uppdaterad** - Most recent changes first
- **Mest använda** - Highest usage count

---

### Law Cards in Grid

**Card structure:**

```
┌──────────────────────────────┐
│ 📝 Arbetsmiljölagen (AML)    │ ← Badge + Name + Abbr
│ SFS 1977:1160                │ ← SFS number
│ Uppdaterad: 2024-01-15       │ ← Status + Date
│                              │
│ Reglerar arbetsmiljö och     │ ← AI summary (2 lines)
│ säkerhet på arbetsplatsen... │
│                              │
│ [Läs mer →]                  │ ← CTA
└──────────────────────────────┘
```

**Badge colors:**

- 🆕 **Ny lag** (green) - Enacted <60 days ago
- 📝 **Uppdaterad** (blue) - Amended <30 days ago
- ⚠️ **Utgången** (red) - Repealed/superseded

**Hover effect:** Card lifts, "Läs mer →" becomes "Öppna lag →"

**Click:** Opens individual law page

---

## Individual Law Pages

### Page Structure

**URL:** `/alla-lagar/arbetsmiljolagen-1977-1160`

```
┌────────────────────────────────────────────────────┐
│ Breadcrumb: Alla Lagar > Arbetsrätt > Arbetsmiljö │
├────────────────────────────────────────────────────┤
│ HEADER                                             │
│ Arbetsmiljölagen (1977:1160)                       │
│ Senast uppdaterad: 2024-01-15                      │
│ Status: Gällande                                   │
│                                                    │
│ [+ Lägg till i laglista] [📤 Dela] [📄 Exportera] │
├────────────────────────────────────────────────────┤
│ CHANGE BANNER (if updated <30 days)               │
│ 📝 Denna lag ändrades 2024-01-15                   │
│ "Ny paragraf 3:2a om digital arbetsmiljö tillagd" │
│ [Visa ändringar →]                                 │
├────────────────────────────────────────────────────┤
│ AI-SAMMANFATTNING (Collapsible)                    │
│ ▼ Lättläst sammanfattning (AI-genererad)          │
│                                                    │
│ Denna lag kräver att arbetsgivare:                │
│ • Systematiskt bedömer risker på arbetsplatsen    │
│ • Dokumenterar riskbedömningar                     │
│ • Utser skyddsombud vid fler än 5 anställda       │
│ • Uppdaterar arbetsmiljöplaner årligen            │
│                                                    │
│ Vem omfattas: Alla arbetsgivare i Sverige         │
│ Straff vid brott: Böter eller fängelse upp till   │
│ 1 år (vid grov oaktsamhet)                         │
│                                                    │
│ ⚠️ Detta är en AI-genererad sammanfattning och     │
│ utgör inte juridisk rådgivning.                    │
├────────────────────────────────────────────────────┤
│ LAGTEXT (Full Text)                                │
│                                                    │
│ ▼ 1 kap. Lagens syfte och tillämpningsområde      │
│                                                    │
│ 1 § Lagen syftar till att förebygga ohälsa och    │
│ olycksfall i arbetet samt att även i övrigt        │
│ uppnå en god arbetsmiljö.                          │
│                                                    │
│ 2 § Lagen gäller arbete som utförs av arbets-     │
│ tagare för arbetsgivarens räkning.                 │
│                                                    │
│ ▼ 2 kap. Arbetsgivarens ansvar                     │
│ ▼ 3 kap. Allmänna skyldigheter för arbetsgivare   │
│ ▶ 4 kap. Särskilda skyldigheter                   │ ← Collapsed
│ ▶ 5 kap. Skyddsombud                              │
│ ▶ 6 kap. Företagshälsovård                        │
│ ...                                                │
│                                                    │
├────────────────────────────────────────────────────┤
│ RELATED LAWS                                       │
│ Lagar som ofta används tillsammans:                │
│ • Arbetstidslagen (ATL) - 87% av användare        │
│ • Anställningsskyddslagen (LAS) - 82%             │
│ • Diskrimineringslagen (DiskL) - 65%              │
│ [Lägg till alla →]                                 │
├────────────────────────────────────────────────────┤
│ MINA ANTECKNINGAR (If logged in)                   │
│ ┌────────────────────────────────────────────┐   │
│ │ Lägg till anteckning om denna lag...       │   │
│ │ (Använd @namn för att nämna teammedlemmar) │   │
│ │ [Spara]                                    │   │
│ └────────────────────────────────────────────┘   │
│                                                    │
│ 📝 Tidigare anteckningar (2):                      │
│ ┌────────────────────────────────────────────┐   │
│ │ Erik J. - 2024-01-10                       │   │
│ │ @anna Vi behöver uppdatera vår risk-       │   │
│ │ bedömning enligt ny 3:2a. Kan du hantera?  │   │
│ └────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

---

### Page Header

**Law Name:** Large, bold headline

- Format: "Arbetsmiljölagen (1977:1160)"
- If abbreviation exists: Show prominently "AML"

**Metadata:**

- **Senast uppdaterad:** 2024-01-15
- **Status:** Gällande | Upphävd | Ersatt
- **SFS-nummer:** 1977:1160 (clickable link to Riksdagen source)

**Actions (Sticky on scroll):**

- **[+ Lägg till i laglista]** - Primary action (see Add to List workflow)
- **[📤 Dela]** - Copy link to clipboard
- **[📄 Exportera]** - Download as PDF (formatted)

---

### Change Banner (Conditional)

**Appears if:** Law amended in last 30 days

**Content:**

- Icon: 📝 (updated) or 🆕 (new law)
- Text: "Denna lag ändrades 2024-01-15"
- AI-generated one-sentence summary of changes
- **[Visa ändringar →]** button opens diff modal

**Design:** Yellow/amber background (subtle alert)

---

### AI-Generated Summary (Collapsible Accordion)

**Header:** "Lättläst sammanfattning (AI-genererad)" with ▼/▶ toggle

**Content structure:**

1. **Key requirements** (bullet list)
   - "Arbetsgivare måste..."
   - "Dokumentation krävs för..."

2. **Who it applies to**
   - "Alla arbetsgivare med anställda"
   - "Gäller även egenföretagare med anställda"

3. **Penalties for non-compliance**
   - "Böter vid mindre allvarliga brott"
   - "Fängelse upp till 2 år vid grov oaktsamhet"

**Disclaimer (always present):**

> ⚠️ Detta är en AI-genererad sammanfattning och utgör inte juridisk rådgivning. Läs alltid den fullständiga lagtexten eller kontakta en jurist.

**Generation:**

- **Batch generation:** Run GPT-4 on all laws during initial ingestion
- **On-demand:** Generate for new laws and amendments
- **Prompt template:**

```
You are summarizing Swedish law for business owners.

Law: {law_name}
Full text: {law_text}

Generate a plain-language summary with:
1. Key requirements (bullet list, max 5 points)
2. Who this applies to (1-2 sentences)
3. Penalties for non-compliance (if applicable, 1-2 sentences)

Write in Swedish. Use simple language. Be accurate but accessible.
Max 200 words total.
```

---

### Law Text (Full Content)

**Format:** Collapsible chapters

**Structure:**

```
▼ 1 kap. Lagens syfte och tillämpningsområde
  1 § [Full text of section 1]
  2 § [Full text of section 2]

▼ 2 kap. Arbetsgivarens ansvar
  1 § [Full text]
  2 § [Full text]

▶ 3 kap. Allmänna skyldigheter (Collapsed by default)
▶ 4 kap. Särskilda skyldigheter
```

**Features:**

- **Collapsible chapters** - Reduce cognitive load, allow quick navigation
- **Section anchors** - Each § has anchor ID for deep linking (e.g., `#3-2a`)
- **Keyword highlighting** - If user arrived from search, highlight search terms
- **Tooltip citations** - If section references another law, show tooltip on hover

**Technical implementation:**

- Parse HTML from Riksdagen API
- Convert to structured JSON:

```typescript
interface LawChapter {
  chapter_number: string // "3"
  chapter_title: string // "Allmänna skyldigheter för arbetsgivare"
  sections: LawSection[]
}

interface LawSection {
  section_number: string // "2a"
  section_text: string // Full paragraph text
  anchor_id: string // "3-2a" for deep linking
  references: string[] // Other law sections referenced
}
```

**Deep linking:**

- AI Chat citations link here: `/alla-lagar/arbetsmiljolagen-1977-1160?section=3-2a`
- On page load, scroll to section and highlight it (yellow background, 3s fade)

---

### Related Laws Section

**Purpose:** Discovery + upsell

**Data source:**

1. **Explicit references** - Laws that cite each other (from Riksdagen API)
2. **Co-occurrence** - Laws frequently tracked together by users
3. **AI-detected similarity** - Vector similarity between law embeddings

**Display:**

- **Title:** "Lagar som ofta används tillsammans"
- **List format:**
  - Law name + abbreviation
  - Percentage: "87% av användare som spårar AML spårar även ATL"
  - Clickable link to that law page
- **Quick action:** "Lägg till alla →" (adds all related laws to user's list)

**Example:**

```
Lagar som ofta används tillsammans med Arbetsmiljölagen:

• Arbetstidslagen (ATL) - 87% av användare
• Anställningsskyddslagen (LAS) - 82% av användare
• Diskrimineringslagen (DiskL) - 65% av användare
• Arbetsskadeförsäkringslagen - 58% av användare

[Lägg till alla →]
```

---

### Notes & Team Collaboration Section

**(See dedicated section below for full details)**

**Quick summary:**

- Private notes per law (rich text editor)
- @mention team members (triggers notification)
- Thread-style display (newest first)
- Only visible if user is logged in

---

## Search & Discovery

### Global Search Bar

**Location:**

- Header (persistent across all pages)
- Hero section on `/alla-lagar` landing page

**Behavior:**

**Search types:**

1. **Law name search**
   - Input: "arbetsmiljö"
   - Results: Arbetsmiljölagen, Arbetsmiljöverket's regulations, etc.

2. **Abbreviation search**
   - Input: "LAS"
   - Results: Lagen om anställningsskydd (exact match, top result)

3. **SFS number search**
   - Input: "1977:1160"
   - Results: Arbetsmiljölagen (exact match)

4. **Topic/keyword search**
   - Input: "riskbedömning"
   - Results: All laws mentioning "riskbedömning" (full-text search)

5. **Question-based search (AI-powered, post-MVP)**
   - Input: "Vad krävs för att anställa personal?"
   - Results: AI identifies relevant laws (LAS, AML, ATL) with explanations

---

### Search Implementation

**Tech stack:**

- **Backend:** PostgreSQL full-text search (Swedish stemming) + pgvector for semantic search
- **Frontend:** Instant search with debouncing (300ms)

**Query flow:**

```typescript
async function searchLaws(query: string): Promise<SearchResult[]> {
  // 1. Check for exact abbreviation match
  const abbrevMatch = await supabase
    .from('laws')
    .select('*')
    .eq('abbreviation', query.toUpperCase())
    .single()

  if (abbrevMatch.data) {
    return [{ ...abbrevMatch.data, relevance: 1.0 }]
  }

  // 2. Full-text search (law names + summaries)
  const textResults = await supabase
    .from('laws')
    .select('*')
    .textSearch('name_and_summary', query, {
      type: 'websearch',
      config: 'swedish',
    })
    .limit(10)

  // 3. If <5 results, do semantic search (vector similarity)
  if (textResults.data.length < 5) {
    const embedding = await generateEmbedding(query)
    const semanticResults = await supabase.rpc('match_laws', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 10,
    })

    // Merge and deduplicate
    return mergeResults(textResults.data, semanticResults)
  }

  return textResults.data
}
```

---

### Search Results Display

**Dropdown (Instant Results):**

```
┌─────────────────────────────────────────┐
│ Sök efter lag...                        │
│ [arbetsmiljö________________] [🔍]      │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│ Sökresultat för "arbetsmiljö":          │
├─────────────────────────────────────────┤
│ 📋 Arbetsmiljölagen (AML)               │
│    SFS 1977:1160 - Arbetsrätt           │
│    Reglerar arbetsmiljö och säkerhet... │
├─────────────────────────────────────────┤
│ 📋 Arbetsmiljöverket (föreskrifter)     │
│    AFS 2001:1 - Arbetsrätt              │
│    Systematiskt arbetsmiljöarbete...    │
├─────────────────────────────────────────┤
│ 📋 Arbetsmiljöansvar för arbetsgivare   │
│    ...                                  │
├─────────────────────────────────────────┤
│ Visa alla resultat (23) →               │
└─────────────────────────────────────────┘
```

**Full Results Page:** `/alla-lagar/sok?q=arbetsmiljo`

- Same card layout as category browsing
- Filters: Category, Status, Recently Updated
- Sort: Relevans (default), Namn, Senast uppdaterad

---

### Filters (Search Results Page)

**Faceted filters:**

**Kategori:**

- ☐ Arbetsrätt (12)
- ☐ Miljö & Bygg (5)
- ☐ Livsmedel & Hälsa (3)

**Status:**

- ☑ Gällande (18)
- ☐ Upphävda (2)

**Senast uppdaterad:**

- ☐ Senaste 30 dagarna (1)
- ☐ Senaste 90 dagarna (4)

---

## SNI-Based Law Discovery

### Purpose

**Problem:** Small business owner doesn't know which laws apply to their industry.

**Solution:** Enter SNI code (or industry name) → Get curated list of relevant laws.

**Example:**

- User enters "56.101" (Restaurant) or "restaurang"
- System returns: Livsmedelslag, Alkohollag, Arbetsmiljölagen, Skatteregler, etc.

---

### UI/UX Flow

**Entry point:** Hero section on `/alla-lagar` landing page

```
┌────────────────────────────────────────────┐
│ Hitta lagar för din bransch                │
│                                            │
│ [SNI-kod eller bransch (t.ex. restaurang)]│
│ [Sök →]                                    │
└────────────────────────────────────────────┘
```

**User types:** "restaurang" or "56.101"

**Autocomplete suggestions:**

```
┌────────────────────────────────────────────┐
│ rest                                       │
└────────────────────────────────────────────┘
       ↓
┌────────────────────────────────────────────┐
│ 🍽️ Restaurang (SNI 56.101)                 │
│ 🍔 Gatukök och food trucks (SNI 56.102)    │
│ 🏨 Hotell med restaurang (SNI 55.101)      │
└────────────────────────────────────────────┘
```

**User selects:** "Restaurang (SNI 56.101)"

**Results page:** `/alla-lagar/bransch/restaurang-56101`

```
┌────────────────────────────────────────────────────┐
│ Relevanta lagar för Restaurang (SNI 56.101)       │
│                                                    │
│ Vi har identifierat 18 lagar som är särskilt      │
│ relevanta för restaurangverksamhet:                │
├────────────────────────────────────────────────────┤
│ HÖGT PRIORITERADE (8)                              │
│                                                    │
│ ✅ Livsmedelslag (2006:804)                        │
│    Obligatorisk för alla som hanterar livsmedel   │
│    [Lägg till i lista]                             │
│                                                    │
│ ✅ Alkohollag (2010:1622)                          │
│    Krävs om ni serverar alkohol (tillstånd)       │
│    [Lägg till i lista]                             │
│                                                    │
│ ✅ Arbetsmiljölagen (AML)                          │
│    Gäller alla arbetsgivare med anställda         │
│    [Lägg till i lista]                             │
│                                                    │
│ ... (5 more)                                       │
│                                                    │
├────────────────────────────────────────────────────┤
│ REKOMMENDERADE (10)                                │
│                                                    │
│ 📋 Mervärdesskattelagen (ML)                       │
│    Viktigt för bokföring och momsredovisning      │
│    [Lägg till i lista]                             │
│                                                    │
│ ... (9 more)                                       │
│                                                    │
├────────────────────────────────────────────────────┤
│ [Lägg till alla högt prioriterade i min lista →]  │
└────────────────────────────────────────────────────┘
```

---

### SNI-to-Law Mapping Strategy (Hybrid Approach)

**Phase 1: AI Batch Mapping (Week 1)**

Generate initial mappings for all ~700 SNI codes:

```typescript
async function generateSNILawMappings() {
  const sniCodes = await fetchAllSNICodes() // From SCB API

  for (const sni of sniCodes) {
    const prompt = `
You are a Swedish legal compliance expert.

Industry: ${sni.code} - ${sni.description}

From these law categories, identify which are HIGHLY RELEVANT (critical compliance) vs. RECOMMENDED (good to know):

Categories:
- Arbetsrätt (Labor Law)
- Dataskydd & Integritet (Data Protection)
- Skatterätt (Tax Law)
- Bolagsrätt (Corporate Law)
- Miljö & Bygg (Environment & Construction)
- Livsmedel & Hälsa (Food & Health)
- Finans & Försäkring (Finance & Insurance)
- Immaterialrätt (IP Law)
- Konsumentskydd (Consumer Protection)
- Transport & Logistik (Transport & Logistics)

Return JSON:
{
  "highly_relevant": ["Livsmedel & Hälsa", "Arbetsrätt"],
  "recommended": ["Skatterätt", "Dataskydd & Integritet"],
  "reasoning": "Restaurants handle food (critical) and have employees (labor law required)..."
}
    `

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })

    const mapping = JSON.parse(response.choices[0].message.content)

    // Store in database
    await supabase.from('sni_law_mappings').insert({
      sni_code: sni.code,
      highly_relevant_categories: mapping.highly_relevant,
      recommended_categories: mapping.recommended,
      reasoning: mapping.reasoning,
    })
  }
}
```

**Cost estimate:** ~700 SNI codes × $0.02 per call = $14

---

**Phase 2: Manual Refinement (Week 2)**

Focus on **top 50 most common industries:**

- Restaurang (56.101)
- Byggnadsverksamhet (41.200)
- Detaljhandel (47.x)
- Konsultverksamhet (70.x)
- IT-tjänster (62.x)
- etc.

Human expert reviews AI suggestions, adds specific laws (not just categories).

**Example refined mapping:**

```json
{
  "sni_code": "56.101",
  "sni_name": "Restaurang",
  "highly_relevant_laws": [
    "law_livsmedel",
    "law_alkohol",
    "law_arbetsmiljo",
    "law_anstallningsskydd"
  ],
  "recommended_laws": ["law_mervardeskatt", "law_bokforing", "law_dataskydd"],
  "reasoning": "Restauranger måste följa livsmedelssäkerhet, alkoholtillstånd (om de serverar alkohol), arbetsmiljö för anställda..."
}
```

---

**Phase 3: User Feedback Loop (Ongoing)**

On SNI results page, add feedback:

```
Är denna lag relevant för din verksamhet?
[👍 Ja, mycket viktig] [👌 Bra att veta] [👎 Inte relevant]
```

Store feedback → Improve mappings over time.

---

## Popular Abbreviations

### Full Abbreviations List

**Page:** `/alla-lagar/forkortningar` (modal or dedicated page)

**Top 50 business law abbreviations** (from Notisum scrape):

**Labor (14):**

- ABL - Aktiebolagslagen
- AML - Arbetsmiljölagen
- ATL - Arbetstidslagen
- DiskL - Diskrimineringslagen
- FML - Föräldraledighetslagen
- LAS - Lagen om anställningsskydd
- LOA - Lagen om arbetslöshetsförsäkring
- MBL - Medbestämmandelagen
- SemL - Semesterlagen
- TGL - Trygghetslagen
- FPL - Föräldraledighetslag (alternative abbreviation)

**Corporate (8):**

- ABL - Aktiebolagslagen
- ÅRKL - Årsredovisningslag
- BFL - Bokföringslag
- BrB - Brottsbalk
- HBL - Handelsbolagslag
- RevL - Revisionslag
- SkL - Skadeståndslag

**Tax (10):**

- IL - Inkomstskattelag
- ML - Mervärdeskattelag
- SFL - Skatteförfarandelag
- SKL - Skattebetalningslag
- LSK - Lag om självdeklarationer och kontrolluppgifter
- SkBL - Skattebrottslagen

**Finance (6):**

- BankL - Banklag
- PuL - Penningtvättslag
- FRL - Försäkringsrörelselag
- KredL - Kreditupplysningslag
- VMSL - Värdepappersmarknadslag

**Data & Privacy (4):**

- GDPR - Dataskyddsförordningen (EU-förordning, not SFS)
- DSL - Dataskyddslag
- OSL - Offentlighets- och sekretesslag
- PuL (old) - Personuppgiftslag (replaced by GDPR/DSL)

**Construction & Environment (4):**

- MB - Miljöbalk
- PBL - Plan- och bygglag
- VVL - Vägtrafiklag

**Consumer (4):**

- KKL - Konsumentköplag
- KTjL - Konsumenttjänstlag
- MFL - Marknadsföringslag
- AvtL - Avtalslag

---

### Abbreviations Page Layout

**Grid display:**

```
┌────────────────────────────────────────────────────┐
│ Populära lagförkortningar                          │
│ Snabba genvägar till de mest använda lagarna      │
├────────────────────────────────────────────────────┤
│ ARBETSRÄTT                                         │
│ ┌──────┬──────┬──────┬──────┐                     │
│ │ ABL  │ AML  │ ATL  │ DiskL│                     │
│ └──────┴──────┴──────┴──────┘                     │
│ ┌──────┬──────┬──────┬──────┐                     │
│ │ FML  │ LAS  │ MBL  │ SemL │                     │
│ └──────┴──────┴──────┴──────┘                     │
├────────────────────────────────────────────────────┤
│ BOLAGSRÄTT                                         │
│ ┌──────┬──────┬──────┬──────┐                     │
│ │ ABL  │ ÅRL  │ BFL  │ RevL │                     │
│ └──────┴──────┴──────┴──────┘                     │
├────────────────────────────────────────────────────┤
│ SKATTERÄTT                                         │
│ ... (similar layout)                               │
└────────────────────────────────────────────────────┘
```

**Click behavior:** Abbreviation chip → Opens that law's page

---

## Add to List Workflow

### User Flow

**Scenario:** User is on Arbetsmiljölagen law page and wants to track it.

**Step 1: User clicks "Lägg till i laglista" button**

**Step 2: Modal opens**

**If user has 1 list:**

```
┌────────────────────────────────────────┐
│ Lägg till Arbetsmiljölagen i laglista │
├────────────────────────────────────────┤
│ Lagen kommer att läggas till i:       │
│                                        │
│ 📑 Min huvudlista                      │
│                                        │
│ [Avbryt] [Lägg till →]                 │
└────────────────────────────────────────┘
```

**If user has multiple lists:**

```
┌────────────────────────────────────────┐
│ Lägg till Arbetsmiljölagen i laglista │
├────────────────────────────────────────┤
│ Välj en eller flera laglistor:        │
│                                        │
│ ☐ 📑 Min huvudlista                    │
│ ☐ 📑 Bygglagstiftning                  │
│ ☐ 📑 HR-lagar                          │
│                                        │
│ [+ Skapa ny lista]                     │
│                                        │
│ [Avbryt] [Lägg till →]                 │
└────────────────────────────────────────┘
```

**If user clicks "+ Skapa ny lista":**

```
┌────────────────────────────────────────┐
│ Skapa ny laglista                      │
├────────────────────────────────────────┤
│ Namn på lista:                         │
│ [_______________________________]      │
│                                        │
│ Beskrivning (valfri):                  │
│ [_______________________________]      │
│                                        │
│ ☑ Lägg till Arbetsmiljölagen i denna  │
│   lista direkt                         │
│                                        │
│ [Avbryt] [Skapa lista →]               │
└────────────────────────────────────────┘
```

**Step 3: Confirmation**

Toast notification appears (top-right corner):

```
┌────────────────────────────────────────┐
│ ✅ Arbetsmiljölagen tillagd i          │
│    "Min huvudlista"                    │
│                                        │
│ [Gå till listan →] [×]                 │
└────────────────────────────────────────┘
```

**Step 4: Button state changes**

"Lägg till i laglista" becomes "✓ I dina listor"

**Click "✓ I dina listor":** Shows which lists law is in, option to remove

```
┌────────────────────────────────────────┐
│ Arbetsmiljölagen finns i:              │
│                                        │
│ • 📑 Min huvudlista [Ta bort]          │
│ • 📑 HR-lagar [Ta bort]                │
│                                        │
│ [Lägg till i fler listor →]            │
└────────────────────────────────────────┘
```

---

### Technical Implementation

```typescript
// app/api/law-lists/add-law/route.ts
export async function POST(req: Request) {
  const { lawId, listIds } = await req.json()
  const userId = getCurrentUserId()

  // Verify user owns these lists
  const { data: lists } = await supabase
    .from('law_lists')
    .select('id')
    .in('id', listIds)
    .eq('user_id', userId)

  if (lists.length !== listIds.length) {
    return NextResponse.json({ error: 'Invalid list IDs' }, { status: 403 })
  }

  // Add law to lists (many-to-many relationship)
  const insertions = listIds.map((listId: string) => ({
    list_id: listId,
    law_id: lawId,
  }))

  await supabase.from('law_list_items').insert(insertions)

  // Track analytics
  await trackEvent('law_added_to_list', {
    law_id: lawId,
    list_count: listIds.length,
  })

  return NextResponse.json({ success: true })
}
```

---

## Law Change Tracking & Diff View

### Change Detection (Nightly Job)

**Process:**

1. **Nightly cron job** (runs at 2 AM CET)
2. **Fetch updates** from Riksdagen API
3. **Compare** with stored versions
4. **Detect changes:**
   - New laws enacted
   - Existing laws amended
   - Laws repealed/superseded
5. **Generate diffs** (old text vs. new text)
6. **AI summarize changes**
7. **Trigger notifications** for users tracking affected laws

---

### Technical Implementation

```typescript
// app/api/cron/sync-law-updates/route.ts
export async function GET(req: Request) {
  console.log('Starting nightly law sync...')

  // 1. Fetch all laws from Riksdagen API
  const riksdagenLaws = await fetchRiksdagenLaws()

  for (const apiLaw of riksdagenLaws) {
    // 2. Check if law exists in our DB
    const { data: existingLaw } = await supabase
      .from('laws')
      .select('*')
      .eq('sfs_number', apiLaw.sfs_number)
      .single()

    if (!existingLaw) {
      // 3. New law → Insert
      await insertNewLaw(apiLaw)
      console.log(`New law: ${apiLaw.name}`)
    } else {
      // 4. Existing law → Check for amendments
      const hasChanged = apiLaw.updated_date > existingLaw.updated_at

      if (hasChanged) {
        // 5. Generate diff
        const diff = generateDiff(
          existingLaw.full_text_html,
          apiLaw.full_text_html
        )

        // 6. AI summarize changes
        const changeSummary = await summarizeChanges(diff)

        // 7. Store historical version
        await supabase.from('law_versions').insert({
          law_id: existingLaw.id,
          version_date: existingLaw.updated_at,
          full_text: existingLaw.full_text_html,
        })

        // 8. Update law with new content
        await supabase
          .from('laws')
          .update({
            full_text_html: apiLaw.full_text_html,
            latest_amendment: apiLaw.updated_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingLaw.id)

        // 9. Store change record
        await supabase.from('law_changes').insert({
          law_id: existingLaw.id,
          change_date: apiLaw.updated_date,
          diff_html: diff,
          summary: changeSummary,
        })

        // 10. Trigger notifications
        await notifyUsersOfLawChange(existingLaw.id, changeSummary)

        console.log(`Updated law: ${apiLaw.name}`)
      }
    }
  }

  console.log('Law sync complete')
  return NextResponse.json({ success: true })
}
```

---

### Diff Generation

**Library:** `diff` (npm package)

```typescript
import { diffLines } from 'diff'

function generateDiff(oldText: string, newText: string): string {
  const diff = diffLines(oldText, newText)

  let diffHtml = '<div class="diff-viewer">'

  diff.forEach((part) => {
    const className = part.added
      ? 'diff-added'
      : part.removed
        ? 'diff-removed'
        : 'diff-unchanged'

    const prefix = part.added ? '+ ' : part.removed ? '- ' : '  '

    diffHtml += `<div class="${className}">${prefix}${escapeHtml(part.value)}</div>`
  })

  diffHtml += '</div>'

  return diffHtml
}
```

---

### AI Change Summary

**Generate plain-language summary of what changed:**

```typescript
async function summarizeChanges(diffHtml: string): Promise<string> {
  const prompt = `
You are summarizing changes to a Swedish law.

Here is the diff (added lines start with +, removed lines with -):

${stripHtml(diffHtml)}

Write a concise Swedish summary (max 2 sentences) of what changed.

Examples:
- "Ny paragraf 3:2a införd som kräver riskbedömning av digital arbetsmiljö."
- "Paragraph 5 § ändrad för att inkludera distansarbete i definitionen av arbetsplats."
  `

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100,
  })

  return response.choices[0].message.content.trim()
}
```

---

### Diff View Modal (User-Facing)

**Trigger:** User clicks "Visa ändringar →" on law page

**Modal opens:**

```
┌────────────────────────────────────────────────────┐
│ Ändringar i Arbetsmiljölagen                       │
│ Ändrad: 2024-01-15 (SFS 2023:1234)                │
│                                                    │
│ [Stäng ×]                                          │
├────────────────────────────────────────────────────┤
│ AI-SAMMANFATTNING                                  │
│ 📝 "Ny paragraf 3:2a införd som kräver digital    │
│     riskbedömning för distansarbete. Träder i     │
│     kraft 2024-07-01."                             │
├────────────────────────────────────────────────────┤
│ DIFF-VY                                            │
│                                                    │
│   3 kap. Allmänna skyldigheter                    │
│                                                    │
│   2 § Arbetsgivaren ska undersöka arbetsför-      │
│       hållandena och bedöma risker för ohälsa...  │
│                                                    │
│ + 2a § Arbetsgivaren ska också göra riskbedöm-    │
│ +      ningar för distansarbete och digitala      │
│ +      arbetsmiljöer. Detta gäller även när       │
│ +      arbetstagaren arbetar hemifrån.            │
│                                                    │
│   3 § Arbetsgivaren ska se till att arbetstagare  │
│ -     får den utbildning som behövs för att       │
│ +     får erforderlig utbildning och information  │
│       arbetet ska kunna utföras på ett säkert...  │
│                                                    │
├────────────────────────────────────────────────────┤
│ [Exportera ändringslogg (PDF)] [Stäng]            │
└────────────────────────────────────────────────────┘
```

**Color coding:**

- **Green background** (+ lines) - Added text
- **Red background** (- lines) - Removed text
- **Gray background** (unchanged lines) - Context

---

### Status Badges

**Display on law cards and law pages:**

**🆕 Ny lag** (Green badge)

- Condition: `effective_date` within last 60 days
- Text: "Ny lag"

**📝 Uppdaterad** (Blue badge)

- Condition: `latest_amendment` within last 30 days
- Text: "Uppdaterad"

**⚠️ Utgången** (Red badge)

- Condition: `status = 'repealed'` or `status = 'superseded'`
- Text: "Utgången"

**Implementation:**

```tsx
function LawStatusBadge({ law }: { law: Law }) {
  const daysSinceEnactment = daysBetween(law.effective_date, new Date())
  const daysSinceAmendment = law.latest_amendment
    ? daysBetween(law.latest_amendment, new Date())
    : null

  if (law.status === 'repealed' || law.status === 'superseded') {
    return <Badge variant="destructive">⚠️ Utgången</Badge>
  }

  if (daysSinceEnactment <= 60) {
    return <Badge variant="success">🆕 Ny lag</Badge>
  }

  if (daysSinceAmendment && daysSinceAmendment <= 30) {
    return <Badge variant="info">📝 Uppdaterad</Badge>
  }

  return null
}
```

---

## Notes & Team Collaboration

### Private Notes System

**Purpose:** Users can annotate laws with team-specific context.

**Use cases:**

- "We reviewed this for Q2 audit - compliant as of 2024-01-15"
- "@erik Can you check if our policy aligns with new § 3:2a?"
- "Risk assessment template updated to match this requirement"

---

### UI Design

**Location:** Bottom section of individual law pages

```
┌────────────────────────────────────────────────────┐
│ MINA ANTECKNINGAR                                  │
├────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────┐   │
│ │ Lägg till anteckning om denna lag...       │   │
│ │                                            │   │
│ │ (Använd @namn för att tagga teammedlemmar) │   │
│ │                                            │   │
│ │ [B] [I] [U] [Link] [🔗]                   │   │
│ │                                            │   │
│ │ [Spara anteckning]                         │   │
│ └────────────────────────────────────────────┘   │
│                                                    │
│ 📝 Tidigare anteckningar (3):                      │
│                                                    │
│ ┌────────────────────────────────────────────┐   │
│ │ 👤 Erik Johansson - 2024-01-18 14:32       │   │
│ │                                            │   │
│ │ @anna Vi behöver uppdatera vår risk-       │   │
│ │ bedömning enligt ny § 3:2a. Kan du ta hand │   │
│ │ om detta till nästa vecka?                 │   │
│ │                                            │   │
│ │ [Svara] [Redigera] [Radera]                │   │
│ └────────────────────────────────────────────┘   │
│                                                    │
│ ┌────────────────────────────────────────────┐   │
│ │ 👤 Anna Svensson - 2024-01-19 09:15        │   │
│ │                                            │   │
│ │ @erik Jag fixar det! Har skapat en uppgift│   │
│ │ i Kanban-tavlan. ✅                         │   │
│ │                                            │   │
│ │ [Svara] [Redigera] [Radera]                │   │
│ └────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

---

### Rich Text Editor with @Mentions

**Library:** TipTap (React rich text editor)

**Extensions:**

- Bold, Italic, Underline
- Links
- **@Mention** (autocomplete team members)

**Implementation:**

```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import { Mention } from '@tiptap/extension-mention';
import StarterKit from '@tiptap/starter-kit';

function LawNotesEditor({ lawId }: { lawId: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          items: async ({ query }) => {
            // Fetch team members matching query
            const { data } = await supabase
              .from('team_members')
              .select('id, name, email')
              .ilike('name', `%${query}%`)
              .limit(5);

            return data || [];
          },
          render: () => {
            // Render mention dropdown
            return {
              onStart: (props) => {
                // Show dropdown
              },
              onUpdate: (props) => {
                // Update dropdown items
              },
              onExit: () => {
                // Hide dropdown
              },
            };
          },
        },
      }),
    ],
    content: '',
  });

  const handleSave = async () => {
    const html = editor.getHTML();
    const mentions = extractMentions(html); // ['erik', 'anna']

    await saveNote(lawId, html, mentions);

    // Send notifications
    for (const userId of mentions) {
      await sendNotification({
        userId,
        type: 'mentioned_in_note',
        message: `${currentUser.name} mentioned you in a note on ${lawName}`,
        link: `/alla-lagar/${lawSlug}#notes`,
      });
    }

    editor.commands.clearContent();
  };

  return (
    <div>
      <EditorContent editor={editor} />
      <button onClick={handleSave}>Spara anteckning</button>
    </div>
  );
}
```

---

### @Mention Autocomplete

**When user types "@":**

```
┌────────────────────────────────────────┐
│ @e                                     │
└────────────────────────────────────────┘
       ↓
┌────────────────────────────────────────┐
│ 👤 Erik Johansson                      │
│    erik@example.com                    │
├────────────────────────────────────────┤
│ 👤 Emma Larsson                        │
│    emma@example.com                    │
└────────────────────────────────────────┘
```

**Arrow keys to navigate, Enter to select**

**Rendered mention:**

```html
<span class="mention" data-user-id="user_123">@erik</span>
```

**CSS:**

```css
.mention {
  background-color: #e3f2fd;
  color: #1976d2;
  border-radius: 4px;
  padding: 2px 6px;
  font-weight: 500;
}
```

---

### Notification Triggers

**When user is @mentioned:**

1. **In-app notification** (bell icon in header)
   - "Erik Johansson mentioned you in a note on Arbetsmiljölagen"
   - Click → Opens law page, scrolls to notes section

2. **Email notification** (if user has email notifications enabled)
   - Subject: "Du nämndes i en anteckning på Laglig.se"
   - Body: Context + link to law page

---

### Database Schema

```sql
-- Notes table
CREATE TABLE law_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id UUID REFERENCES laws(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- HTML from TipTap
  mentions UUID[], -- Array of mentioned user IDs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX law_notes_law_id_idx ON law_notes(law_id);
CREATE INDEX law_notes_user_id_idx ON law_notes(user_id);

-- Notifications table (for @mentions)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'mentioned_in_note', 'law_updated', etc.
  message TEXT NOT NULL,
  link TEXT, -- Deep link to relevant page
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX notifications_user_id_idx ON notifications(user_id);
CREATE INDEX notifications_read_idx ON notifications(read);
```

---

## Content Sourcing & Maintenance

### Riksdagen API Integration

**API Base URL:** `https://data.riksdagen.se/dokumentlista/`

**Endpoint for SFS laws:**

```
GET https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json
```

**Response format:**

```json
{
  "dokumentlista": {
    "@antal": "10235",
    "dokument": [
      {
        "dok_id": "SFS1977:1160",
        "titel": "Arbetsmiljölag (1977:1160)",
        "undertitel": null,
        "typ": "sfs",
        "datum": "1977-12-23",
        "publicerad": "1977-12-23",
        "status": "gällande",
        "html": "<div>...</div>",
        "relaterat_id": ["SFS2023:456"],
        "andar_id": ["SFS1970:123"]
      }
    ]
  }
}
```

---

### Data Pipeline

**Step 1: Initial Ingestion (One-time)**

```typescript
async function ingestAllLaws() {
  console.log('Starting initial law ingestion...')

  const riksdagenLaws = await fetchAllRiksdagenLaws()
  console.log(`Fetched ${riksdagenLaws.length} laws from Riksdagen API`)

  for (const apiLaw of riksdagenLaws) {
    // 1. Parse HTML to extract chapters and sections
    const parsed = parseLawHTML(apiLaw.html)

    // 2. AI classify as B2B/Private
    const classification = await classifyLaw(apiLaw)

    // 3. AI generate plain-language summary
    const summary = await generateLawSummary(apiLaw)

    // 4. Insert into database
    await supabase.from('laws').insert({
      sfs_number: apiLaw.dok_id,
      name: extractLawName(apiLaw.titel),
      full_name: apiLaw.titel,
      effective_date: apiLaw.datum,
      status: mapStatus(apiLaw.status),
      full_text_html: apiLaw.html,
      chapters: parsed.chapters,
      related_laws: apiLaw.relaterat_id || [],
      is_b2b: classification.is_b2b,
      is_private: classification.is_private,
      summary,
      keywords: extractKeywords(apiLaw.html),
    })

    // 5. Generate embeddings for RAG (law chunks)
    await generateLawEmbeddings(apiLaw.dok_id, parsed.chapters)

    console.log(`Ingested: ${apiLaw.titel}`)
  }

  console.log('Initial ingestion complete')
}
```

**Cost estimate:**

- **AI classification:** 10,000 laws × $0.01 = $100
- **AI summaries:** 10,000 laws × $0.02 = $200
- **Embeddings:** 10,000 laws × 100 chunks × $0.0001 = $100
- **Total:** ~$400 one-time cost

---

### Nightly Sync Job

**Frequency:** Daily at 2 AM CET (low-traffic time)

**Vercel Cron:**

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-law-updates",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Job logic:**

1. Fetch laws updated in last 7 days from Riksdagen API
2. Compare with stored versions
3. Generate diffs for changed laws
4. AI summarize changes
5. Update database
6. Trigger notifications for affected users

---

### Historical Versions Storage

**Why:** ISO audit trails require proving "we were compliant with version effective on X date"

**Schema:**

```sql
CREATE TABLE law_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id UUID REFERENCES laws(id) ON DELETE CASCADE,
  version_date TIMESTAMPTZ NOT NULL,
  full_text_html TEXT NOT NULL,
  chapters JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX law_versions_law_id_idx ON law_versions(law_id);
CREATE INDEX law_versions_date_idx ON law_versions(version_date);
```

**Retention:** Indefinite (critical for audit compliance)

---

### GPT-4 Batch Classification

**Classify all laws as B2B, Private, or Both:**

```typescript
async function classifyLaw(law: RiksdagenLaw): Promise<Classification> {
  const prompt = `
Classify this Swedish law as relevant to:
- "b2b" (businesses/companies)
- "private" (individuals/consumers)
- "both" (applies to both businesses and individuals)

Law: ${law.titel}
Summary: ${law.html.substring(0, 500)}

Consider:
- Does it regulate employment, workplace safety, corporate governance, tax, accounting? → b2b
- Does it regulate family law, inheritance, consumer purchases, housing? → private
- Does it regulate data protection, contracts, criminal law? → both

Respond with JSON: {"classification": "b2b"|"private"|"both", "reasoning": "..."}
  `

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  })

  const result = JSON.parse(response.choices[0].message.content)

  return {
    is_b2b: result.classification === 'b2b' || result.classification === 'both',
    is_private:
      result.classification === 'private' || result.classification === 'both',
    reasoning: result.reasoning,
  }
}
```

---

## SEO & Public Access Strategy

### Why Public Law Pages?

**Strategic rationale:**

1. **SEO Growth Engine**
   - Rank for "[law name]", "[law abbreviation]", "[topic] sweden"
   - 10,000+ law pages = 10,000+ indexed pages
   - Long-tail traffic: "arbetsmiljölagen riskbedömning krav"

2. **Trust Building**
   - Free value before signup (content marketing)
   - Users can evaluate quality before committing
   - Word-of-mouth: "Check out Laglig.se's explanation of LAS"

3. **Conversion Funnel**
   - Public page → "Add to list" CTA → Signup required → Lead captured
   - Retargeting: Pixel tracks visitors, show ads later

**Risks:**

- Competitors can scrape content
- Users might not convert (get value without paying)

**Mitigation:**

- Beautiful design = harder to replicate
- AI summaries have disclaimer (not legal advice) = users still need expert help
- "Add to list" + "Track changes" requires signup = gate core features

---

### SEO Optimization

**On-page SEO:**

**Title tag:**

```html
<title>
  Arbetsmiljölagen (AML) - Fullständig lagtext och sammanfattning | Laglig.se
</title>
```

**Meta description:**

```html
<meta
  name="description"
  content="Läs Arbetsmiljölagen (1977:1160) i fulltext. AI-genererad sammanfattning, ändringshistorik, och relaterade lagar. Gratis tillgång till alla svenska lagar på Laglig.se."
/>
```

**Structured data (Schema.org):**

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "LegislationObject",
    "name": "Arbetsmiljölagen",
    "legislationIdentifier": "SFS 1977:1160",
    "legislationDate": "1977-12-23",
    "legislationJurisdiction": {
      "@type": "Country",
      "name": "Sweden"
    },
    "url": "https://laglig.se/alla-lagar/arbetsmiljolagen-1977-1160"
  }
</script>
```

**Keyword optimization:**

- H1: Law name + abbreviation
- H2: Chapter titles (rich in keywords)
- Body: Full law text (naturally keyword-rich)
- Alt text on images/icons

**Internal linking:**

- Related laws section links to other law pages
- Breadcrumbs link to category pages
- Footer links to law categories

---

### Content Freshness Signals

**Google rewards fresh content:**

1. **Last updated date** prominently displayed
2. **Sitemap.xml** with `<lastmod>` dates
3. **"Recently Updated" section** on homepage (crawled frequently)
4. **Blog/news feed** (post-MVP) announcing law changes

**Sitemap generation:**

```typescript
// app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: laws } = await supabase
    .from('laws')
    .select('slug, updated_at')
    .eq('is_b2b', true)

  return laws.map((law) => ({
    url: `https://laglig.se/alla-lagar/${law.slug}`,
    lastModified: law.updated_at,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))
}
```

---

### Conversion Optimization

**CTA placement:**

1. **Top of page** (sticky on scroll)
   - "Lägg till i laglista" button
   - Requires signup → Capture lead

2. **After AI summary**
   - "Want to track changes to this law? Sign up free →"

3. **Bottom of page**
   - "Get notified when this law changes"
   - Email capture form (converts to user account)

**A/B testing (post-launch):**

- Test CTA wording: "Lägg till i laglista" vs. "Spåra denna lag"
- Test placement: Top vs. floating action button
- Test social proof: "1,234 företag spårar denna lag"

---

## Technical Implementation

### Database Schema

**Laws table:**

```sql
CREATE TABLE laws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sfs_number TEXT UNIQUE NOT NULL, -- "1977:1160"
  name TEXT NOT NULL, -- "Arbetsmiljölagen"
  full_name TEXT NOT NULL, -- "Lag (1977:1160) om arbetsmiljö"
  slug TEXT UNIQUE NOT NULL, -- "arbetsmiljolagen-1977-1160"
  abbreviation TEXT, -- "AML"
  category TEXT NOT NULL, -- "Arbetsrätt"
  sub_category TEXT,
  effective_date DATE NOT NULL,
  latest_amendment DATE,
  status TEXT NOT NULL, -- 'active' | 'repealed' | 'superseded'
  summary TEXT, -- AI-generated plain-language summary
  full_text_html TEXT NOT NULL,
  chapters JSONB NOT NULL, -- Structured chapter/section data
  related_laws UUID[], -- Array of related law IDs
  sni_codes TEXT[], -- Relevant SNI codes
  keywords TEXT[], -- Extracted keywords
  popularity_score INTEGER DEFAULT 0, -- For ranking
  is_b2b BOOLEAN DEFAULT TRUE,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX laws_category_idx ON laws(category);
CREATE INDEX laws_status_idx ON laws(status);
CREATE INDEX laws_abbreviation_idx ON laws(abbreviation);
CREATE INDEX laws_sni_codes_idx ON laws USING GIN(sni_codes);
CREATE INDEX laws_keywords_idx ON laws USING GIN(keywords);
CREATE INDEX laws_updated_at_idx ON laws(updated_at DESC);
```

---

**Law versions table:**

```sql
CREATE TABLE law_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id UUID REFERENCES laws(id) ON DELETE CASCADE,
  version_date TIMESTAMPTZ NOT NULL,
  full_text_html TEXT NOT NULL,
  chapters JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

**Law changes table:**

```sql
CREATE TABLE law_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id UUID REFERENCES laws(id) ON DELETE CASCADE,
  change_date DATE NOT NULL,
  diff_html TEXT NOT NULL, -- HTML diff view
  summary TEXT NOT NULL, -- AI-generated change summary
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

**Law notes table:**

```sql
CREATE TABLE law_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id UUID REFERENCES laws(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

**SNI law mappings table:**

```sql
CREATE TABLE sni_law_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sni_code TEXT NOT NULL,
  sni_name TEXT NOT NULL,
  highly_relevant_laws UUID[], -- Law IDs
  recommended_laws UUID[],
  reasoning TEXT, -- AI explanation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX sni_mappings_code_idx ON sni_law_mappings(sni_code);
```

---

### API Routes

**Law pages:**

- `GET /api/laws` - List all laws (with filters)
- `GET /api/laws/[slug]` - Get single law by slug
- `GET /api/laws/[id]/versions` - Get historical versions
- `GET /api/laws/[id]/changes` - Get change history
- `POST /api/laws/[id]/notes` - Create note
- `GET /api/laws/[id]/notes` - Get notes for law

**Search:**

- `GET /api/laws/search?q={query}` - Search laws
- `GET /api/laws/sni?code={sni_code}` - Get laws by SNI code

**Categories:**

- `GET /api/laws/categories` - List categories with counts
- `GET /api/laws/categories/[slug]` - Get laws in category

---

### Frontend Routes

**Public routes:**

- `/alla-lagar` - Landing page
- `/alla-lagar/kategori/[slug]` - Category browsing
- `/alla-lagar/[lawSlug]` - Individual law page
- `/alla-lagar/sok?q={query}` - Search results
- `/alla-lagar/bransch/[sniSlug]` - SNI discovery results
- `/alla-lagar/forkortningar` - Abbreviations page

---

## Post-MVP Features

### 1. Case Law & Court Rulings

**Integrate Arbetsdomstolen, Högsta Domstolen rulings:**

- Link rulings to relevant laws
- AI summaries of key cases
- "In practice" section on law pages showing real-world applications

**Data source:** Swedish courts publish rulings online (some APIs available)

---

### 2. Regulatory Guidance (Föreskrifter)

**Beyond laws, include Arbetsmiljöverket, Skatteverket guidance:**

- AFS regulations (Arbetsmiljöverket's föreskrifter)
- SKV guidance documents
- Linked to parent laws

**Example:** Arbetsmiljölagen page shows related AFS 2001:1 (Systematiskt arbetsmiljöarbete)

---

### 3. Personalized Law Feeds

**AI curates weekly updates for each user:**

- "Your laws had 3 changes this week"
- "New ruling on LAS that affects your industry"
- Email digest every Monday

---

### 4. Law Comparison Tool

**Compare two laws side-by-side:**

- "Compare LAS vs. MBL"
- Highlight differences, overlaps
- Useful for understanding interactions

---

### 5. Question-Based Search (Natural Language)

**User asks:** "What are the requirements for hiring employees in Sweden?"

**AI responds:**

- LAS (employment contracts)
- AML (workplace safety obligations)
- ATL (working hours regulations)
- With explanations for each

---

### 6. Mobile App

**Native iOS/Android apps for law browsing:**

- Push notifications for law changes
- Offline access to tracked laws
- Voice search

---

## Success Metrics

**How do we measure if Law Pages are successful?**

### Product Metrics

- **Law page views:** Total views, views per law
- **Search usage:** % of visits starting with search
- **Category browsing:** Click-through rate from categories
- **Add to list conversions:** % of law page visitors who add law to list
- **SNI discovery usage:** Searches via SNI input field

### SEO Metrics

- **Organic traffic:** Visitors from Google
- **Keyword rankings:** Position for "[law name]" searches
- **Indexed pages:** 10,000+ law pages indexed
- **Bounce rate:** <50% on law pages (indicates valuable content)

### Engagement Metrics

- **Time on page:** Avg time spent reading law pages
- **Notes created:** # of users adding notes to laws
- **@Mentions:** # of team collaboration interactions
- **Return visits:** % of users returning to same law page

### Business Metrics

- **Signup conversions:** Law page → Signup flow completion
- **Trial-to-paid:** Users who signed up via law pages → Paid conversion
- **Retention:** Users who engage with law pages have lower churn

---

## Conclusion

The Law Pages (Alla Lagar) feature is Laglig.se's **content foundation and growth engine**. By combining:

- **Comprehensive coverage** (10,000+ laws from Riksdagen API)
- **B2B focus** (AI classification filters noise)
- **Discovery tools** (SNI-based, abbreviations, AI suggestions)
- **Plain-language accessibility** (AI summaries for non-lawyers)
- **Change tracking** (GitHub-style diffs, notifications)
- **Team collaboration** (notes with @mentions)
- **SEO-optimized public access** (rank for law searches)

...we create a legal database that competitors (Notisum, Karnov) cannot easily replicate.

**Next steps:**

1. Ingest all laws from Riksdagen API (one-time setup)
2. Implement GPT-4 batch classification (B2B/Private)
3. Build category browsing and search
4. Deploy nightly sync job for law updates
5. Launch public law pages with conversion CTAs
6. Measure SEO impact and iterate

---

**Document End**
