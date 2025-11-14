# EU - Alla rättsakter (All EU Legal Acts)

**Section:** Regelsamling → Europalagstiftning → Alla rättsakter
**Purpose:** Comprehensive index of ALL EU legal document types

---

## Overview

"Alla rättsakter" provides access to the complete hierarchy of EU legal acts, beyond just Regulations and Directives.

**Categories offered:**

1. **Primärrätt, Fördrag** (Primary Law, Treaties)
2. **Internationella avtal** (International Agreements)
3. **Sekundärrätt, Direktiv** (Secondary Law, Directives)
4. **Sekundärrätt, Förordningar** (Secondary Law, Regulations)
5. **Sekundärrätt, Beslut** (Secondary Law, Decisions)
6. **Sekundärrätt, Andra rättsakter** (Secondary Law, Other Acts)
7. **Förberedande rättsakter** (Preparatory Acts)
8. **EG-/EU-domstolens rättspraxis** (ECJ/CJEU Case Law)
9. **Övriga EU-dokument** (Other EU Documents)

---

## Document Type 1: Primärrätt, Fördrag (Primary Law, Treaties)

**What these are:**

- Foundational treaties of the European Union
- EU's "constitution" - the supreme legal framework
- Examples: Treaty on European Union (TEU), Treaty on Functioning of EU (TFEU)

### CELEX Number Format

**Pattern:** `1YYYYXTNNNN`

- `1` = Primary law (vs. `3` for secondary law)
- `YYYY` = Year (e.g., 2010 for Lisbon Treaty version)
- `X` = Treaty indicator (E, M, A, etc.)
- `T` = Text type indicator
- `NNNN` = Article/section number

**Examples:**

- `12010E004` = TFEU (Treaty on Functioning of EU), Article 4
- `12010A/TXT` = Consolidated version text

### Access Structure

**Chronological register:**

- Years: 2020, 2019, 2016, 2012, 2010, 2008, 2007, etc. back to 1951
- Each year shows treaty versions published that year

**Selection with amendments:**

- Checkbox: "Inkludera upphävda" (include repealed)
- Checkbox: "Inkludera rättelser" (include corrections)
- Shows: "PRIMÄRRÄTT, FÖRDRAG, CELEX NR 12010A/TXT - CELEX NR 12010P052"

**Grid + Detail view:**

- Top: Grid of CELEX numbers (e.g., Celex nr 12010A/TXT, 12010A031, 12010A032...)
- Bottom: "DETALJERAD INFORMATION OM FÖRFATTNINGARNA" with checkboxes

### Individual Treaty Page

**Minimal structure compared to Regulations/Directives:**

- CELEX number (e.g., "CELEX nr 12010E004")
- Full Swedish title
- **"Visa dokument" button** - links to EUR-Lex
- **"Källtext EUR-Lex" button** - same link to EUR-Lex

**EUR-Lex link:**
`https://eur-lex.europa.eu/legal-content/SV/ALL/?uri=CELEX:12010E004`

### Fakta & Historik Tab

**Shows:**

- Beteckning: CELEX number
- Utfärdad: Original adoption date (e.g., "1957-03-25" for Treaty of Rome)
- Uppdaterad: Latest consolidated version (usually "-" as treaties rarely "updated")
- Ikraftträdande: Entry into force (e.g., "1958-01-01")

**Key difference from Regulations/Directives:**

- Treaties are **consolidated versions** - incorporate all amendments over decades
- Show founding date + current consolidated status
- No "Nationellt införlivande" button (treaties aren't "implemented" - they ARE the law)

---

## Data Source

**Same as all EU documents:** EUR-Lex

**CELEX Primary Law numbering:**

- `1` prefix = primary law
- Covers treaties from 1951 (European Coal and Steel Community) to present
- Includes consolidated versions incorporating all amendments

**Key treaties in database:**

- Treaty of Rome (1957) - founding EEC
- Maastricht Treaty (1992) - created EU
- Amsterdam Treaty (1997)
- Nice Treaty (2001)
- Lisbon Treaty (2007) - current framework
  - TEU (Treaty on European Union) = "12010M"
  - TFEU (Treaty on Functioning of EU) = "12010E"

---

## Other Document Types (Brief Summary)

### 2. Internationella avtal

- EU agreements with non-EU countries
- Trade agreements, association agreements
- CELEX format varies

### 3-6. Sekundärrätt (Secondary Law)

- **Direktiv** - already documented
- **Förordningar** - already documented
- **Beslut** (Decisions) - binding on specific addressees
- **Andra rättsakter** - recommendations, opinions (non-binding)

### 7. Förberedande rättsakter (Preparatory Acts)

- Commission proposals
- Legislative procedures in progress
- Not yet adopted into law

### 8. EG-/EU-domstolens rättspraxis (Case Law)

- European Court of Justice rulings
- Court of First Instance rulings
- CELEX format: `6YYYYXNNNNN` (6 = case law)

### 9. Övriga EU-dokument

- White papers, green papers
- Communications
- Staff working documents

---

## Relevance for Laglig.se

**Critical for compliance:**

1. ✅ **Regulations** (Förordningar) - directly binding
2. ✅ **Directives** (Direktiv) - require Swedish implementation

**Less critical for SMB segment:** 3. ⚠️ **Treaties** (Fördrag) - foundational but not day-to-day compliance 4. ⚠️ **Decisions** (Beslut) - often specific to particular entities 5. ⚠️ **Case Law** (Rättspraxis) - important for legal interpretation but complex 6. ❌ **Preparatory acts** - not yet law 7. ❌ **Soft law** (recommendations, opinions) - non-binding

**Recommendation for Laglig.se MVP:**

- **Include:** Regulations, Directives (documented)
- **Consider for Enterprise tier:** Case law, Decisions
- **Likely skip:** Treaties (reference only), Preparatory acts, Soft law

---

## Data Volume Estimate

**Primary law (Treaties):**

- Small number of foundational documents (10-20 major treaties)
- But thousands of articles within each treaty
- TFEU alone has 358 articles

**All EU legal acts combined:**

- Regulations: ~100,000+
- Directives: ~10,000-15,000
- Decisions: ~50,000+
- Case law: ~30,000+ rulings
- Other documents: Tens of thousands

**Total EUR-Lex database:** 1+ million documents

---

## Key Insight

Notisum provides **comprehensive** EU legal coverage by exposing EUR-Lex's full taxonomy.

**For Laglig.se:**

- Start with what matters to SMBs: **Regulations + Directives** (already documented)
- EUR-Lex API provides access to ALL document types
- Can expand coverage later based on user needs
