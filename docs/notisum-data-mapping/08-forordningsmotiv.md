# Förordningsmotiv (Ordinance Explanatory Memoranda)

**Section:** Regelsamling → Svensk lagstiftning → Förordningsmotiv
**URL Pattern:** `https://www.notisum.se/rn/document/?id=FMYYYYN`

---

## Overview

Explanatory memoranda for government ordinances (förordningar). These documents explain the reasoning and intent behind ordinances issued by the government.

**Key characteristics:**
- Explanatory documents for **ordinances** (not laws)
- Published **only in some cases** ("enstaka fall") - not for every ordinance
- Much rarer than propositioner (which explain laws)
- Part of **förarbeten** for ordinances
- Published in series "Regeringens förordningsmotiv"

---

## What are Förordningar vs. Lagar?

**Two types of binding rules in Swedish legal system:**

**1. Lagar (Laws):**
- Enacted by **Riksdag** (Parliament)
- Published in **SFS** (e.g., SFS 2020:115)
- Explained in **Propositioner**
- Higher in legal hierarchy

**2. Förordningar (Ordinances):**
- Issued by **Regering** (Government) under delegated authority
- Also published in **SFS** (e.g., SFS 2020:115 might be an ordinance)
- Explained in **Förordningsmotiv** (when explanations exist)
- Lower in legal hierarchy
- Must be authorized by a law

**Example:**
- **Lag:** Arbetsmiljölag (1977:1160) - broad framework set by Riksdag
- **Förordning:** Arbetsmiljöförordning (1977:1166) - detailed rules set by Government
- **Further delegation:** Arbetsmiljöverkets föreskrifter (AFS) - specific regulations by agency

---

## CRITICAL NOTE: Sparse and Incomplete Data

**From Notisum's own description:**
> "I enstaka fall finns det förarbeten till regeringens förordningar i form av förordningsmotiv."
>
> Translation: "In some cases, there are preparatory works for the government's ordinances in the form of ordinance motives."

**What this means:**
- ❌ **NOT published for most ordinances**
- ✅ **Only published occasionally** when government decides explanation is needed
- Many years have zero förordningsmotiv published
- **User observation:** Most links in Notisum are dead/empty

**Contrast with propositioner:**
- Every law gets a proposition
- Förordningsmotiv are exceptional, not standard

---

## Structure in Notisum

**Same interface as other document types:**
- **Kronologiskt register** (chronological by year)
- **Grid view** + **detailed list view**
- Years available: 2000-2023 (with many gaps)

**BUT:** Very low volume and many dead links

---

## Numbering Format

**Pattern:** `FM YYYY:N`

**Breakdown:**
- `FM` = Förordningsmotiv
- `YYYY` = Year of publication
- `:` = Separator
- `N` = Sequential number within that year (usually single digit)

**Examples from screenshot:**
- `FM 2021:1` - First ordinance explanation from 2021
- `FM 2021:5` - Fifth ordinance explanation from 2021

**Note:** Only 5 förordningsmotiv in entire year 2021 - compare to 150-300 propositioner/year

---

## URL Pattern

**Notisum URL format:** `https://www.notisum.se/rn/document/?id=FMYYYYN`

**Condensed numbering:**
- Full format: `FM 2021:1`
- URL format: `id=FM20211` (likely)
- `FM` = Förordningsmotiv identifier
- `2021` = Year
- `1` = Number

---

## Content and Format

**According to Notisum:**
- **From 2000-2006:** Scanned images (PDF format)
- **From 2007 onwards:** Original PDF documents
- Referenced in ordinances themselves (note in the ordinance text)

**Structure (when available):**
- Explanation of ordinance purpose
- Background and justification
- Commentary on specific provisions
- Similar to propositioner but for ordinances

---

## Data Source

**Source:** Per Notisum:
> "Källa: Skannade pappersdokument och regeringskansliets rättsdatabaser"
>
> Translation: "Source: Scanned paper documents and government office's legal databases"

**No clear API:** Unlike Riksdagen (propositioner), government databases for förordningsmotiv are not structured/accessible

---

## Data Volume Estimate

**Years with some coverage:** 2000-2023

**Volume per year:** Very low
- Example: 2021 had only 5 förordningsmotiv
- Many years likely have 0-10
- Some years may have none

**Total estimate:** 100-300 förordningsmotiv across entire database (vs. 10,000+ propositioner)

**User observation:** "Most links here are dead and empty"
- Suggests Notisum's index may list documents they don't actually have
- Or documents were never published/no longer available

---

## Why Förordningsmotiv are Rare

**1. Delegated legislation:**
- Ordinances implement laws already approved by Riksdag
- Details don't need extensive justification

**2. Less democratic scrutiny:**
- Government can issue ordinances without parliamentary vote
- Less need for public explanation

**3. Technical nature:**
- Many ordinances are technical/administrative
- Self-explanatory in context of authorizing law

**4. Publishing practice:**
- Government decides case-by-case whether to publish explanation
- Only "enstaka fall" (exceptional cases)

---

## Relationship to Other Documents

**Legal hierarchy:**
1. **Grundlag** (Constitution) - not in Notisum
2. **Lag** (Law - Riksdag) → Explained in **Propositioner**
3. **Förordning** (Ordinance - Government) → Explained in **Förordningsmotiv** (rarely)
4. **Föreskrifter** (Regulations - Agencies) → Various agency documentation

**Cross-referencing:**
- Förordningar reference the **lag** that authorizes them
- Förordningsmotiv may reference the **proposition** for the authorizing law
- Courts may cite förordningsmotiv for interpretation (but rarely needed)

---

## Relevance for Laglig.se

**Very low value for most users:**
1. **Rare documents** - only published occasionally
2. **Most ordinances lack explanation** - users must rely on law's proposition
3. **Incomplete in Notisum** - many dead links
4. **Low demand** - businesses typically need ordinances themselves, not explanations

**Recommendation for Laglig.se:**

**MVP (Phase 1):**
- ❌ **Skip entirely** - Not worth the effort
- Ordinances themselves (in SFS) are important
- Explanations are too rare to prioritize

**Phase 2-3:**
- ❌ **Still skip** - Low ROI even for professional tier
- If needed, link to regeringen.se or other sources

**Only consider if:**
- Large enterprise clients specifically request
- Easy to integrate as side effect of other work
- API becomes available making it trivial

---

## Example Use Case (Theoretical)

**Scenario:** New ordinance changes environmental reporting requirements

**Without förordningsmotiv:**
- Read ordinance text: "företag ska rapportera utsläpp enligt bilaga A"
- Question: What counts as "utsläpp"? Which industries?
- Solution: Look to **authorizing law** and its **proposition** for guidance

**With förordningsmotiv (if published):**
- Read FM 2023:X explaining the ordinance
- Find: "Med utsläpp avses endast direkta utsläpp från produktionsanläggningar"
- Get clearer guidance

**Reality:**
- Förordningsmotiv probably won't exist for this ordinance
- Must use other förarbeten (law's proposition, etc.)

---

## Key Differences from Propositioner

| Feature | Propositioner | Förordningsmotiv |
|---------|---------------|------------------|
| **Explains** | Lagar (Laws) | Förordningar (Ordinances) |
| **Issued by** | Government to Riksdag | Government (internal) |
| **Frequency** | Every law gets one | Only "enstaka fall" |
| **Volume/year** | 150-300 | 0-10 |
| **Total in DB** | 10,000-15,000 | 100-300 (estimate) |
| **Data quality** | Complete in Notisum | Sparse, many dead links |
| **Data source** | Riksdagen API | Scanned documents |
| **User demand** | High (professional) | Very low |
| **Legal hierarchy** | Authoritative | Authoritative (when exists) |
| **Laglig.se priority** | Phase 2 | Skip |

---

## Technical Integration Notes

**Challenges:**
1. **No structured API** - Scanned documents from various sources
2. **Incomplete data** - Many missing/dead links
3. **Low volume** - Not enough content to justify effort
4. **Unclear availability** - Which ordinances have förordningsmotiv?
5. **Alternative sources** - Users can find via regeringen.se if truly needed

**If absolutely required:**
- Index only (like SOU approach)
- Link to regeringen.se or other external sources
- Don't attempt to host/scrape

---

## Summary

**Förordningsmotiv are explanatory documents for government ordinances, but they are:**
- ⚠️ **Rarely published** ("enstaka fall")
- ⚠️ **Incomplete in Notisum** (dead links)
- ⚠️ **Low volume** (single digits per year)
- ⚠️ **Low demand** (ordinances themselves are in SFS)

**For Laglig.se:**
- ❌ **Not a priority** for any phase
- Focus on **ordinances themselves** (part of SFS collection)
- Focus on **propositioner** (explain the laws that authorize ordinances)
- **Skip förordningsmotiv** unless very specific user request

**Key insight:** The **ordinances** (förordningar) are critical - they're binding law published in SFS. But their **explanatory memoranda** (förordningsmotiv) are too rare and incomplete to be a valuable data source.
