# EU Direktiv (EU Directives)

**Section:** Regelsamling → Europalagstiftning → Direktiv
**URL Pattern:** Same as Förordningar: `https://www.notisum.se/rn/document/?id=YYYLDNNNN`

---

## Overview

EU directives adopted by European Parliament and Council, or by Council alone. Unlike regulations, **directives must be transposed into national law** by each member state.

**Key characteristics:**

- Binding as to result to be achieved
- Member states choose form and methods of implementation
- Published in Swedish in EUT (L-series)

---

## Structure

**Identical to EU Förordningar:**

- Kronologiskt register (chronological by year: 2024 → 1958)
- Grid view + detailed list view
- Same checkbox interface
- Options: "Inkludera upphävda", "Inkludera rättelse"

**URL Pattern:**

- Format: `id=YYYLDNNNN`
- `YYY` = year (e.g., 324 = 2024)
- `L` = Lagstiftning indicator
- `D` = Directive indicator
- `NNNN` = directive number

**Example:**

- Directive (EU) 2024/790 → `id=32024L0790`

---

## Individual Directive Detail View

**Same structure as Förordningar:**

- Full Swedish text from EUT
- "Original från EUT" PDF link
- "Källtext EUR-Lex" button
- "Fakta & Historik" tab

**CRITICAL ADDITION: "Nationellt införlivande" Button**

### What "Nationellt införlivande" Shows

**Links to:** EUR-Lex National Implementation Measures (NIM)
**URL pattern:** `https://eur-lex.europa.eu/legal-content/sv/NIM/?uri=CELEX:32024L0790`

**Purpose:** Shows how each EU member state has transposed the directive into their national law

**Data provided:**

- List of national laws implementing the directive
- Breakdown by member state (Sweden, Denmark, Germany, etc.)
- Swedish national implementation measures specifically
- Dates when implementation laws entered into force
- Links to national legal acts that implement the directive

**Example for Sweden:**

- Lists Swedish SFS laws that implement EU directive requirements
- Shows which Swedish government agency is responsible
- Indicates implementation status (complete, partial, pending)

---

## Key Difference from Regulations

| Feature                              | Regulations               | Directives                                    |
| ------------------------------------ | ------------------------- | --------------------------------------------- |
| **Direct applicability**             | Yes - binding in entirety | No - must be transposed                       |
| **National implementation**          | Not required              | Required - member states create national laws |
| **"Nationellt införlivande" button** | ❌ No                     | ✅ Yes                                        |
| **URL indicator**                    | `R` (e.g., 323R0139)      | `LD` (e.g., 32024L0790)                       |
| **Flexibility**                      | None - applies as-is      | Member states choose implementation method    |

---

## Data Source

**Primary Source:** Same as Förordningar - EUR-Lex

**CELEX number pattern:**

- Format: `3YYYYLNNNN` for directives
- Example: `32024L0790`
  - `3` = secondary legislation
  - `2024` = year
  - `L` = directive (from Latin "Lex")
  - `0790` = sequential number

**Additional EUR-Lex data for directives:**

- National Implementation Measures (NIM) database
- Per-country transposition status
- Deadlines for implementation
- Infringement procedures (if countries fail to implement)

**EUR-Lex NIM API:**

- Endpoint: `/legal-content/sv/NIM/?uri=CELEX:XXXXXXXX`
- Provides list of national measures per member state
- Shows implementation deadlines and dates
- Free, public access

---

## Data Volume

**Years covered:** 1958-2025 (same as regulations)
**Directives per year:** Lower volume than regulations

- Recent years: 100-300 directives/year (vs. 2,000+ regulations)
- Directives are broader framework laws, less frequent

**Total estimate:** 10,000-15,000 EU directives in database

---

## Swedish Implementation Tracking

**Why this matters for Laglig.se:**

When a business needs to comply with an EU directive, they actually need to comply with:

1. **The directive itself** (understanding the requirements)
2. **Swedish implementation law** (the actual binding national law)

**Notisum's "Nationellt införlivande" button** bridges this gap by showing:

- Which Swedish SFS laws implement each EU directive
- Cross-reference between EU and Swedish legal framework

**Example workflow:**

1. User finds EU Directive 2024/790 on financial instruments
2. Clicks "Nationellt införlivande"
3. Sees that Sweden implemented it via SFS 2025:XXXX
4. Can navigate to the Swedish implementing law in Notisum
5. Understands both EU requirement AND Swedish compliance method

---

## Laglig.se Opportunity

**Critical feature to replicate:**

- Show connection between EU directives and Swedish implementation laws
- "This EU directive is implemented in Sweden by [SFS laws]"
- Automated tracking: "Sweden must implement this by [deadline]"
- Alert: "New EU directive affects your industry - implementation due in 18 months"

**Data integration needed:**

- EUR-Lex directive database
- EUR-Lex NIM (National Implementation Measures)
- Riksdagen SFS database
- Mapping table: EU directive → Swedish implementing SFS

---

## Research Questions

- [ ] Does EUR-Lex NIM API provide structured data or just web pages?
- [ ] How quickly is NIM database updated after Swedish implementation?
- [ ] Can we automatically detect when new EU directives are relevant to specific industries?
- [ ] Does Notisum manually curate the EU→Swedish law mappings or pull from EUR-Lex?
- [ ] Are there directives that Sweden has NOT implemented (infringement cases)?
