# Rättsfall - Justitieombudsmannen (Parliamentary Ombudsman)

**Section:** Regelsamling → Rättsfall → Justitieombudsmannen
**URL Pattern:** `https://www.notisum.se/rn/document/?id=JOB[number]`

---

## CRITICAL DATA ISSUE

**User observation:** Limited content, links mostly don't work

**What exists:**

- ✅ Landing page with category structure
- ✅ Chronological register with case numbers and summaries
- ⚠️ Individual case pages have limited content
- ❌ Links within cases mostly don't work ("Mostly dead")

**Possible issues:**

1. Incomplete data migration
2. Limited JO decision text available
3. Technical issues with Notisum's JO database
4. JO decisions may only have summaries, not full text

---

## Overview

Parliamentary Ombudsman (Justitieombudsmannen, JO) decisions regarding public authorities and officials.

**Key characteristics:**

- Ombudsman institution (NOT a court)
- Supervises public authorities
- Decisions and criticisms, not binding judgments
- Coverage from 1999-present
- Limited content availability in Notisum

**Important:** JO is NOT a court - it's an oversight/ombudsman institution appointed by Parliament.

---

## What is Justitieombudsmannen (JO)?

**Justitieombudsmannen** (Parliamentary Ombudsman) is Sweden's parliamentary watchdog for ensuring that public authorities and officials comply with laws and regulations.

**Role:**

- Supervises public authorities and officials
- Investigates complaints from citizens about government actions
- Issues decisions and criticisms
- Can criticize authorities but cannot overturn decisions
- Appointed by Parliament (Riksdagen)

**Jurisdiction covers:**

- Government agencies
- Courts and judges
- Police and prosecutors
- Tax authorities (Bolagsverket, etc.)
- Social services
- Healthcare providers (public)
- Schools (public)
- County administrations
- Municipal administrations
- Military

---

## Structure in Notisum

**Different landing page structure:**
Unlike courts which show chronological years only, JO landing page shows:

- **Years:** 2022 → 1999
- **Categories:** Subject matter categories for filtering decisions

**Categories visible (from screenshot):**

- Beslut inom olika kategorier (Decisions in various categories)
- Allmänna domstolar m.m. (General courts, etc.)
- Central statsförvaltning, arbetsmarknadsmyndigheter m.m. (Central government, labor market authorities, etc.)
- Exekutiva ärenden (Executive matters)
- Försvaret (Defense)
- Förvaltningsdomstolar (Administrative courts)
- Hälso- och sjukvård (Healthcare)
- JO:s tillsynskompetens (JO's supervisory competence)
- JO:s yttranden över lagstiftningsremisser (JO's statements on legislative proposals)
- Kommunikationsväsendet (Communications)
- Kriminalvård (Corrections)
- Länsförvaltningen (County administration)
- Miljö- och hälsoskydd samt djurskydd (Environmental and health protection and animal welfare)
- Offentlighet och sekretess samt yttrande- och tryckfrihet (Public access and secrecy and freedom of expression and press)
- Plan- och byggnadsväsendet (Planning and building)
- Socialförsäkring (Social insurance)
- Socialtjänst (Social services)
- Stöd och service till vissa funktionshindrade (Support and service for certain disabilities)
- Taxering och uppbörd samt folkbokföring (Taxation and collection and population registration)
- Utbildnings- och kultursektor (Education and culture sector)
- Utlänningsärenden (Immigration matters)
- Övriga myndighetsutövanden (Other public authority exercises)
- Överförmyndarnämnder och överförmyndare (Guardianship boards and guardians)
- Övriga kommunförvaltningsärenden (Other municipal administration matters)

**Coverage:** 1999-present (23+ years)

---

## Numbering Format

**Pattern:** `JOB [number]-[year]`

**Breakdown:**

- `JOB` = Justitieombudsmannen Beslut (JO Decision)
- `[number]` = Sequential case number (appears to be 4 digits)
- `-[year]` = Year

**Examples from screenshot:**

- `JOB 9340-2020` - Case 9340 from 2020
- `JOB 4391-2021` - Case 4391 from 2021

**Note:** Numbering system is different from courts. JO uses internal case numbers that don't reset each year.

---

## URL Pattern

**Format:** `https://www.notisum.se/rn/document/?id=JOB[number]`

**Example from screenshot:**

- `JOB 9340-2020` → `id=JOB70052`

**Note:** URL ID format doesn't directly match the case number format shown (JOB70052 vs JOB 9340-2020). Appears to be internal database ID.

---

## Individual Case Page Structure

### Header Information

**Case identification:**

- Case number: "JOB 9340-2020"
- Case title/summary

**Example from screenshot:**
"Kritik mot Bolagsverket för vägran att ta emot kontant betalning vid utlämnande av kopior av allmänna handlingar"

Translation: "Criticism of the Companies Registration Office for refusing to accept cash payment when issuing copies of public documents"

### Limited Content

**From screenshot:**

- Shows "Visa dokument" (Show document) button
- Shows "- - -" which suggests limited or no content
- User reports: "Mostly dead, links don't work either"

**Appears to be:**

- Summary/title available
- Full decision text may not be available
- Similar issue to Arbetsdomstolen (metadata but limited content)

---

## What JO Does vs. Courts

**Important distinctions:**

| Feature                    | JO Decisions               | Court Decisions     |
| -------------------------- | -------------------------- | ------------------- |
| **Institution type**       | Ombudsman (oversight)      | Judicial court      |
| **Legal force**            | No binding force           | Binding precedent   |
| **Outcome**                | Criticism, recommendations | Legal judgment      |
| **Enforcement**            | Voluntary compliance       | Legally enforceable |
| **Can overturn decisions** | No                         | Yes                 |
| **Can award damages**      | No                         | Yes                 |
| **Appeal process**         | No appeals                 | Appeal hierarchy    |

**JO can:**

- ✅ Investigate complaints
- ✅ Criticize authorities
- ✅ Recommend changes
- ✅ Refer to prosecutor (serious cases)
- ✅ Influence future behavior

**JO cannot:**

- ❌ Overturn administrative decisions
- ❌ Award compensation
- ❌ Enforce its recommendations
- ❌ Create binding legal precedent

---

## Data Volume Estimate

**Coverage:** 1999-2022 (23 years)

**Volume unclear:**

- Example shows JOB 9340-2020 and JOB 4391-2021
- If numbering is sequential, suggests thousands of cases
- But actual available content appears limited

**Data quality issue:**
User reports "mostly dead, links don't work" - suggests incomplete database or content availability issues.

---

## Why JO Decisions Matter (or Don't)

**Limited relevance for businesses:**

1. **Not binding precedent** - Recommendations only
2. **Public sector focus** - Supervises government, not private businesses
3. **No direct legal force** - Cannot overturn decisions or award damages
4. **Better sources exist** - Court cases provide binding precedent

**Some potential value:**

- Understanding how public authorities should behave
- Government contractor compliance
- Public procurement guidance
- Administrative law principles

**Very low priority compared to:**

- **Courts (HD, HFD, AD, etc.)** - Binding legal precedent
- **Laws (SFS)** - Actual legal requirements
- **Regulations** - Enforceable rules

---

## Relevance for Laglig.se

**Very low value for most SMBs:**

1. **Not binding precedent** - Only recommendations
2. **Public sector focus** - Oversees government, not businesses
3. **Limited content** - Data appears incomplete in Notisum
4. **Better alternatives** - Court cases more valuable

**Recommendation for Laglig.se:**

**MVP (Phase 1):**

- ❌ **Skip entirely** - Very low business relevance
- ⚠️ **Data quality issues** - Limited content, broken links
- **Focus instead:** AD, HFD, HD, HovR (binding precedent)

**Phase 2 (Professional tier):**

- ❌ **Still skip** - Court cases far more important
- **Complete courts first** - All court databases before JO

**Phase 3 (Enterprise/Specialized tier):**

- ⚠️ **Consider only for public sector module** - Government contractors only
- ⚠️ **Data quality issue** - Need to verify content availability
- **Very low priority** - After all courts, laws, regulations

---

## Data Availability Issues

**Current status in Notisum:**

- ✅ Landing page with categories exists
- ✅ Chronological register with case summaries
- ❌ Limited content on individual case pages
- ❌ Links mostly don't work (user observation)

**Similar to Arbetsdomstolen issue:**
Metadata and summaries available, but full content appears broken or unavailable.

**Alternative source:**

- **jo.se** - Official JO website
  - Full decision database
  - Searchable by category
  - Free public access
  - Likely better source than Notisum

---

## Comparison: JO vs. JK

**Sweden has TWO ombudsmen:**

| Feature           | JO (Justitieombudsmannen)  | JK (Justitiekanslern)             |
| ----------------- | -------------------------- | --------------------------------- |
| **Appointed by**  | Parliament (Riksdagen)     | Government                        |
| **Supervises**    | Public authorities broadly | Government specifically           |
| **Legal role**    | Ombudsman oversight        | Government's legal representative |
| **Can prosecute** | Yes (rarely)               | Yes (state claims)                |
| **In Notisum**    | ⚠️ Yes (limited content)   | Unknown                           |

---

## Summary

**Justitieombudsmannen decisions (JO) in Notisum:**

- ⚠️ **Limited content available** - Summaries exist but full text appears incomplete
- ❌ **Links mostly broken** - User observation
- ⚠️ **Not a court** - Ombudsman institution, not binding precedent
- ❌ **Not binding** - Recommendations and criticisms only
- 📊 **Low business relevance** - Supervises government, not private sector

**For Laglig.se:**

- **Very low priority** - Not binding precedent
- **Data quality issues** - Limited content in Notisum
- **Skip for MVP and Phase 2** - Focus on courts and laws
- **Alternative source available** - jo.se has full decisions

**Key insight:** JO decisions are **VERY LOW PRIORITY** because:

1. **Not binding legal precedent** - Only recommendations
2. **Public sector focus** - Oversees government, not businesses
3. **Data quality issues** - Content appears incomplete in Notisum
4. **Better alternatives exist** - Court decisions provide binding guidance

**Recommendation:** Skip JO entirely for Laglig.se. If needed later for public sector clients, obtain data from **jo.se** instead of Notisum.

**Priority ranking for Laglig.se:**

1. **Essential:** SFS laws, AD, HFD, HD (binding law and precedent)
2. **High:** HovR, MÖD, EU law (important precedent and compliance)
3. **Moderate:** Propositioner, MIG (specialized needs)
4. **Low:** SOU, Ds (preparatory works, limited direct application)
5. **Very low:** JO, JK (not binding, public sector focus, data issues)
