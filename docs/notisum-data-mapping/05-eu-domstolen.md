# EU-domstolen (EU Court of Justice Case Law)

**Section:** Regelsamling → Europalagstiftning → EU-domstolen
**URL Pattern:** `https://www.notisum.se/rn/document/?id=YYYYXNNNNN`

---

## Overview

Rulings and judgments from the European Court of Justice (ECJ/CJEU - Court of Justice of the European Union) and the General Court (formerly Court of First Instance). Swedish translations of EU court decisions.

**Key characteristics:**

- Court rulings interpreting EU law
- Binding precedent across all EU member states
- Published in Swedish
- Covers preliminary rulings, direct actions, appeals

---

## Structure

**Identical to EU Förordningar and Direktiv:**

- Kronologiskt register (chronological by year: 2023 → 1954)
- Grid view + detailed list view
- Same checkbox interface
- Option: "Inkludera upphävda" (include repealed)

**Year range:** 1954-2023 (69 years of EU case law)

---

## CELEX Number Format

**Pattern:** `6YYYYXNNNNN`

**Breakdown:**

- `6` = Case law (vs. `3` for secondary legislation, `1` for primary law)
- `YYYY` = Year of judgment
- `X` = Court type indicator:
  - `C` = Court of Justice (ECJ/CJEU)
  - `T` = General Court (formerly CFI)
  - `A` = Civil Service Tribunal (historical)
- `N` = Case type/procedure indicator
- `NNNN` = Case number

**Examples from screenshot:**

- `62021CN0495` = Court of Justice, 2021, case 495
- `62021CA0262` = Court of Justice, 2021, case 262
- `62021TN0212` = General Court, 2021, case 212

---

## URL Pattern

**Format:** `https://www.notisum.se/rn/document/?id=YYYYXNNNNN`

**Simplified from full CELEX:**

- Full CELEX: `62021CN0495`
- Notisum URL: `id=62190495`
- The `C` separator is removed, condensing year + court type + number

**Example:**

- CELEX: `62021CN0495`
- URL: `id=62190495`

---

## Individual Case Detail View

### Case Page Structure

**Header:**

- Full case title in Swedish
- Example: "Mål C-495/21: Begäran om förhandsavgörande framställd av Bundesverwaltungsgericht (Tyskland) den 12 augusti 2021 - L. GmbH mot Förbundsrepubliken Tyskland"

**Document metadata:**

- **"Original från EUT"** button (if published in Official Journal)
- **"Källtext EUR-Lex"** button - links to EUR-Lex official source
- Date of judgment
- Publication reference in Official Journal (if applicable)
- Court type (Rättegångsspråk)
- Referring court (Hänskjutande domstol)
- Parties (Klagande, Motpart)
- Legal questions (Tolkningsfrågor)

**Content:**

- Full Swedish text of the judgment
- Summary of facts
- Legal reasoning
- Operative part (ruling)

---

## Fakta & Historik Tab

**Shows:**

- **Beteckning:** CELEX number (e.g., "Celex nr 62021CN0495")
- **Utfärdad:** Date of judgment (e.g., "2021-08-12")
- **Uppdaterad:** Usually "-" (judgments don't get amended)
- **Ikraftträdande:** Usually "-" (judgments take effect when published)

**Key difference from Regulations/Directives:**

- No "Nationellt införlivande" button (court cases aren't "implemented")
- No amendment history (judgments are final)
- May show related cases or appeals

---

## Data Source

**Primary Source:** EUR-Lex (same as all EU documents)

**EUR-Lex URL pattern:**
`https://eur-lex.europa.eu/legal-content/SV/ALL/?uri=CELEX:62021CN0495`

**CELEX Case Law numbering:**

- `6` prefix = case law
- Covers cases from 1954 (European Coal and Steel Community Court) to present
- Includes:
  - Court of Justice (formerly ECJ, now CJEU)
  - General Court (formerly Court of First Instance)
  - Civil Service Tribunal (abolished 2016)

**Available data per case:**

- Full judgment text in Swedish (and all 24 EU languages)
- Summary of facts
- Legal questions referred
- Court's reasoning
- Operative part (the actual ruling)
- Publication reference
- Parties involved
- Subject matter codes (EUROVOC)
- References to legal basis (treaties, directives, regulations)
- Related cases

---

## Case Types

**Common case types visible in CELEX codes:**

**Preliminary rulings (C-xxx/YY):**

- National courts ask CJEU to interpret EU law
- Most common type for businesses
- Establishes binding interpretation across EU

**Direct actions:**

- Infringement proceedings (Commission vs. Member State)
- Annulment actions (challenging EU acts)
- Failure to act cases

**Appeals (T-xxx/YY):**

- General Court cases
- Often competition law, state aid, trademark cases

---

## Data Volume Estimate

**Years covered:** 1954-2023 (69 years)

**Cases per year:** Varies significantly

- Recent years (2020s): 500-800 cases/year
- Historical: Lower volume

**Example from screenshot (2021):**

- Grid shows cases numbered from C-262/21 through TN0422/21
- Estimated 400-600 cases for 2021

**Total estimate:** 30,000-40,000+ EU court cases in database

---

## Key Differences from Regulations/Directives

**Similarities:**

- Chronological register navigation
- Detailed list views
- Individual document pages
- Fakta & Historik tab
- EUR-Lex source button

**Differences:**

- **CELEX prefix:** `6` (case law) vs. `3` (secondary legislation)
- **Nature:** Judicial decisions interpreting law vs. legislative acts creating law
- **No amendments:** Judgments are final (no "senast ändrad")
- **No national implementation:** Court rulings apply directly
- **Content type:** Legal reasoning and operative ruling vs. articles and provisions
- **Parties:** Specific parties involved in dispute
- **Binding effect:** Interpretative authority vs. direct legal obligation

---

## Relevance for Laglig.se

**Critical for legal compliance:**

1. **Interpretation of EU law** - Court rulings clarify how regulations and directives should be applied
2. **Binding precedent** - All Swedish courts must follow CJEU interpretations
3. **Practical guidance** - Cases show real-world application of abstract legal principles

**Use cases for businesses:**

- Understanding how GDPR is interpreted by courts
- Competition law case precedents
- VAT and customs interpretations
- Employment law clarifications
- Product liability standards

**Complexity consideration:**

- More complex than regulations/directives
- Requires legal expertise to interpret
- Often referenced by lawyers, less directly by SMBs

**Recommendation for Laglig.se MVP:**

- **Consider for Phase 2 or Enterprise tier**
- **MVP focus:** Regulations and Directives (direct compliance requirements)
- **Later expansion:** Add case law with AI-powered summaries showing "what this means for your business"
- **Linkage value:** Show which court cases interpret specific regulations/directives

---

## EUR-Lex API Access

**Same infrastructure as Regulations/Directives:**

- Free, public API
- Full text in Swedish
- Structured metadata
- Cross-references to related legal acts
- Updated daily

**Additional case law features:**

- Case status (pending, decided, appealed)
- Opinion of Advocate General (preliminary rulings)
- Links between related cases
- Subject matter classification

---

## Key Insight

EU case law provides the **interpretative layer** on top of EU legislation. While regulations and directives tell you **what the law says**, court cases tell you **how the law is actually applied**.

**For Laglig.se:**

- **Immediate value:** Focus on regulations + directives (direct compliance needs)
- **Future value:** Add case law to show "how this has been interpreted"
- **AI opportunity:** Summarize complex judgments into plain-language guidance
- **Cross-linking:** "This regulation has been interpreted in 12 court cases - here's what they mean"

**Data accessibility:** EUR-Lex provides full access to all case law via free API.
