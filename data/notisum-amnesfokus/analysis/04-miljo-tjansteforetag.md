---
list_id: '04'
list_name_source: 'Miljö för tjänsteföretag'
laglig_name: 'Miljöregler for tjänsteföretag'
parent_list: 'Miljö'
source_url: 'https://www.notisum.se/Rn/lawlist/?listid=72882'
total_documents: 32
categorization_status: 'partially_structured'
section_count_source: 6
section_count_laglig: 6
target_audience: 'Service companies with environmental compliance needs'
overlap_with_parent: 30
unique_to_this_list: 2
scraped_at: '2025-12-08'
analysis_date: '2026-02-05'
---

# Miljöregler for tjänsteföretag — Laglistaanalys

## 1. Overview

This list contains **32 documents** targeting service-sector companies (tjänsteföretag) that need to meet environmental compliance obligations. It is a curated subset of the broader parent "Miljö" list (98 documents), trimmed to remove industry-specific regulations (Seveso, industrial emissions, dangerous goods transport, pesticides, etc.) that rarely apply to office-based or service-oriented businesses.

**Key structural observation:** Although the source data places all 32 documents into a single flat section (section "06 — Brandfarliga varor" in the JSON, with all documents dumped there due to a scraping artifact), the index numbers (`0100`-`0630`) clearly encode six thematic groupings that map to the intended section structure visible in the source website.

**Relationship to parent Miljö list:**

- 30 of 32 documents appear in the parent Miljö list (98 documents)
- 2 documents are unique additions for the service-company audience:
  - **(EU) nr 852/2020** — EU Taxonomy Regulation (added because service companies increasingly face taxonomy-reporting obligations even though they are not heavy industry)
  - **SFS 1995:1554** — Årsredovisningslag (added because the annual accounts act's sustainability-reporting chapter is especially relevant for service companies that must report on environmental impact without operating permit-requiring installations)

These two documents DO also appear in the parent Miljö list's section "09 — Övriga dokument", but they are considered supplementary for that audience. In the tjansteforetag variant, they have been promoted into section 01 (indexes 0120 and 0130), signaling that for service companies these are core obligations rather than peripheral.

**Why 32 and not 98?** The parent Miljö list includes regulations for heavy industry (Seveso/major accident prevention, industrial emissions, environmental permits, dangerous goods transport, deponering, ecodesign, etc.). Service companies typically do not operate permit-requiring facilities. This curated list strips those away and keeps the universally applicable rules.

---

## 2. Section Breakdown

Sections reconstructed from index-number patterns. All section names below are laglig.se originals.

### Section A: Grundregler och rapportering (Index 01xx)

Core environmental framework rules and reporting obligations applicable to all businesses.

| Index | SFS/Ref          | Official Statute Title                           | Source Type   | In Parent? |
| ----- | ---------------- | ------------------------------------------------ | ------------- | ---------- |
| 0100  | SFS 1998:808     | Miljöbalk Kap 2 — Allmänna hänsynsregler         | Lag           | Yes        |
| 0110  | SFS 2012:259     | Förordning om miljösanktionsavgifter             | Förordning    | Yes        |
| 0120  | (EU) nr 852/2020 | EU Taxonomiförordningen                          | EU-förordning | Promoted   |
| 0130  | SFS 1995:1554    | Årsredovisningslag                               | Lag           | Promoted   |
| 0140  | SFS 2010:900     | Plan- och bygglag                                | Lag           | Yes        |
| 0150  | SFS 2011:338     | Plan- och byggförordning                         | Förordning    | Yes        |
| 0160  | SFS 2006:985     | Lag om energideklaration för byggnader           | Lag           | Yes        |
| 0170  | SFS 2006:1592    | Förordning om energideklaration för byggnader    | Förordning    | Yes        |
| 0180  | SFS 2014:266     | Lag om energikartläggning i stora företag        | Lag           | Yes        |
| 0190  | SFS 2014:347     | Förordning om energikartläggning i stora företag | Förordning    | Yes        |

**Document count:** 10
**Pattern:** Framework principles (Miljöbalk Kap 2), penalty regulations, sustainability reporting (Taxonomy + Årsredovisningslag), building/planning rules, and energy requirements.

---

### Section B: Avfallshantering och restprodukter (Index 02xx)

Waste management obligations: classification, sorting, reporting, and hazardous waste registration.

| Index | SFS/Ref      | Official Statute Title                                                   | Source Type          | In Parent? |
| ----- | ------------ | ------------------------------------------------------------------------ | -------------------- | ---------- |
| 0200  | SFS 1998:808 | Miljöbalk Kap 15 — Avfall                                                | Lag                  | Yes        |
| 0210  | SFS 2020:614 | Avfallsförordning                                                        | Förordning           | Yes        |
| 0220  | NFS 2020:5   | NV:s föreskrifter om antecknings-/rapporteringsskyldighet farligt avfall | Myndighetsföreskrift | Yes        |
| 0230  | NFS 2023:2   | NV:s föreskrifter om uppgifter till avfallsstatistik                     | Myndighetsföreskrift | Yes        |

**Document count:** 4
**Pattern:** Classic waste-management chain — framework chapter, detailed regulation, hazardous waste register, and statistical reporting.

---

### Section C: Kemiska produkter och ämneshantering (Index 03xx)

Chemical management: REACH/CLP compliance, product registers, hazardous substances, and PCB.

| Index | SFS/Ref           | Official Statute Title                                              | Source Type          | In Parent? |
| ----- | ----------------- | ------------------------------------------------------------------- | -------------------- | ---------- |
| 0300  | (EG) nr 1907/2006 | REACH-förordningen                                                  | EU-förordning        | Yes        |
| 0310  | (EG) nr 1272/2008 | CLP-förordningen                                                    | EU-förordning        | Yes        |
| 0320  | SFS 1998:808      | Miljöbalk Kap 14 — Kemiska produkter                                | Lag                  | Yes        |
| 0330  | KIFS 2017:7       | KemI:s föreskrifter om kemiska produkter och biotekniska organismer | Myndighetsföreskrift | Yes        |
| 0340  | SFS 2008:245      | Förordning om kemiska produkter och biotekniska organismer          | Förordning           | Yes        |
| 0350  | SFS 2007:19       | Förordning om PCB m.m.                                              | Förordning           | Yes        |

**Document count:** 6
**Pattern:** EU-level chemical regulations (REACH, CLP) layered with Swedish implementation (Miljöbalk Kap 14, product register, PCB controls).

---

### Section D: Luft, klimat och ventilation (Index 04xx)

Atmospheric emissions: fluorinated greenhouse gases, ozone-depleting substances, ventilation inspections, and vehicle exhaust.

| Index | SFS/Ref          | Official Statute Title                                                  | Source Type          | In Parent? |
| ----- | ---------------- | ----------------------------------------------------------------------- | -------------------- | ---------- |
| 0400  | (EU) nr 573/2024 | EU-förordning om fluorerade växthusgaser                                | EU-förordning        | Yes        |
| 0410  | (EU) nr 590/2024 | EU-förordning om ozonnedbrytande ämnen                                  | EU-förordning        | Yes        |
| 0420  | SFS 2016:1128    | Förordning om fluorerade växthusgaser                                   | Förordning           | Yes        |
| 0430  | SFS 2016:1129    | Förordning om ozonnedbrytande ämnen                                     | Förordning           | Yes        |
| 0440  | BFS 2011:16      | Boverkets föreskrifter om funktionskontroll av ventilationssystem (OVK) | Myndighetsföreskrift | Yes        |
| 0450  | SFS 2011:318     | Avgasreningslag                                                         | Lag                  | Yes        |

**Document count:** 6
**Pattern:** EU F-gas and ozone regulations with Swedish implementing rules, building ventilation control, and vehicle emissions. Highly relevant for service companies that operate HVAC systems or vehicle fleets.

---

### Section E: Olycksförebyggande och brandskydd (Index 05xx)

Accident prevention and fire safety in buildings and facilities.

| Index | SFS/Ref      | Official Statute Title                                          | Source Type          | In Parent? |
| ----- | ------------ | --------------------------------------------------------------- | -------------------- | ---------- |
| 0500  | SFS 2003:778 | Lag om skydd mot olyckor                                        | Lag                  | Yes        |
| 0510  | SRVFS 2004:3 | Räddningsverkets allmänna råd om systematiskt brandskyddsarbete | Myndighetsföreskrift | Yes        |

**Document count:** 2
**Pattern:** Framework law for accident prevention (fire equipment, risk analysis, notification duties) plus operational guidance on systematic fire protection work.

---

### Section F: Brandfarliga och explosiva varor (Index 06xx)

Handling, storage, and permits for flammable and explosive substances.

| Index | SFS/Ref       | Official Statute Title                                  | Source Type          | In Parent? |
| ----- | ------------- | ------------------------------------------------------- | -------------------- | ---------- |
| 0600  | SFS 2010:1011 | Lag om brandfarliga och explosiva varor                 | Lag                  | Yes        |
| 0610  | SFS 2010:1075 | Förordning om brandfarliga och explosiva varor          | Förordning           | Yes        |
| 0620  | MSBFS 2023:2  | MSB:s föreskrifter om hantering av brandfarliga vätskor | Myndighetsföreskrift | Yes        |
| 0630  | MSBFS 2020:1  | MSB:s föreskrifter om hantering av brandfarlig gas      | Myndighetsföreskrift | Yes        |

**Document count:** 4
**Pattern:** Permitting framework (law + regulation) plus detailed handling rules for flammable liquids and gases. Relevant for service companies that store cleaning agents, fuels, or aerosols.

---

## 3. Source Type Analysis

| Source Type                         | Count  | Percentage |
| ----------------------------------- | ------ | ---------- |
| Lag (Swedish statute)               | 9      | 28%        |
| Förordning (government regulation)  | 11     | 34%        |
| EU-förordning                       | 5      | 16%        |
| Myndighetsföreskrift (agency rules) | 7      | 22%        |
| **Total**                           | **32** | **100%**   |

**Observations:**

- Strong EU presence (5 documents, 16%) — service companies face direct EU obligations via REACH, CLP, F-gas, ozone, and Taxonomy regulations
- Balanced lag/förordning structure — most sections follow a law + implementing regulation pattern
- Myndighetsföreskrifter are concentrated in waste (NFS), fire safety (SRVFS/MSBFS), chemicals (KIFS), and building ventilation (BFS)

---

## 4. Content Pattern Assessment

### Structural patterns

- **Paired legislation:** Most regulations come in law + implementing regulation pairs (energideklaration lag + förordning, brandfarliga varor lag + förordning, fluorerade växthusgaser EU + svensk förordning)
- **EU-Swedish layering:** EU regulations (REACH, CLP, F-gas, ozone) are complemented by Swedish implementing rules
- **Miljöbalk chapters as separate entries:** The list references three specific Miljöbalk chapters (Kap 2, 14, 15) rather than the full code, making it easier for service companies to understand which parts apply to them

### Audience tailoring vs. parent list

- **Removed from parent:** Industrial emissions, environmental permits (tillståndsplikt), Seveso, dangerous goods transport, deponering, pesticides, ecodesign, radiation protection, and other heavy-industry rules
- **Retained:** Universal obligations that apply even to offices and service operations (waste sorting, chemical handling, fire safety, energy declarations, sustainability reporting)
- **Promoted:** Taxonomy and Årsredovisningslag moved to section 01, reflecting that service companies' primary environmental compliance touchpoint is often reporting rather than operational permits

### Gap analysis

- No coverage of **noise regulations** (relevant for some service operations)
- No coverage of **water/wastewater** (relevant if service companies operate laundry, car wash, or similar)
- Limited coverage of **contractor management** — service companies often outsource physical work but remain legally responsible

---

## 5. Laglig.se Recommendations

### Section naming strategy

Use the laglig.se section names proposed in Section 2 above:

1. **Grundregler och rapportering** (replaces source "Allmänna regler")
2. **Avfallshantering och restprodukter** (replaces source "Avfallshantering")
3. **Kemiska produkter och ämneshantering** (replaces source "Kemikaliehantering")
4. **Luft, klimat och ventilation** (replaces source "Utsläpp till mark, luft och vatten")
5. **Olycksförebyggande och brandskydd** (replaces source "Säkerhet")
6. **Brandfarliga och explosiva varor** (same concept, our own wording)

### Compliance summary approach

For service companies, frame compliance obligations around three themes:

1. **Fastighetsansvar** — building energy, ventilation, fire safety
2. **Vardagshantering** — waste sorting, chemical storage, aerosol management
3. **Rapportering** — taxonomy disclosures, annual sustainability reports, waste registers

### Priority ordering for agents

When an agent identifies a user as a service company, present sections in this order of practical importance:

1. Waste management (affects every office)
2. Fire safety and accident prevention (building-owner/tenant obligations)
3. Chemical handling (cleaning products, aerosols, toner cartridges)
4. Energy and building compliance (energy declarations, ventilation)
5. Sustainability reporting (Taxonomy, Årsredovisningslag)
6. F-gas/flammable goods (only if HVAC or specific storage)

---

## 6. Relationship to Other Lists

| Related List   | Shared Docs | Relationship                                                                            |
| -------------- | ----------- | --------------------------------------------------------------------------------------- |
| Miljö (parent) | 30 of 32    | This list is a curated service-company subset of the full Miljö list                    |
| Fastighet-Bygg | ~8          | Overlap on Plan- och bygglag, energideklaration, OVK, brandskydd                        |
| Arbetsmiljö    | 0           | No direct overlap — but service companies need both lists in practice                   |
| Miljö Sverige  | 0           | Despite similar naming, Miljö Sverige is actually a workplace/HR list (see analysis 05) |

**Key insight for laglig.se:** Service companies should be presented with this list PLUS the Arbetsmiljö list as their two primary compliance tracks. The name "Miljö Sverige" is misleading — it does NOT complement this list.

---

## 7. Agent Training Annotations

### Section A: Grundregler och rapportering

```
compliance_context: "service_company_environmental_framework"
trigger_phrases: ["miljöbalk", "hänsynsregler", "energideklaration", "taxonomi", "hållbarhetsrapport", "årsredovisning", "plan- och bygg"]
```

**Example compliance summaries (laglig.se originals):**

- **SFS 1998:808 Kap 2:** "Vi ska tillämpa miljöbalkens grundprinciper i all vår verksamhet. Det innebär att vi behöver ha tillräcklig kunskap om hur vår verksamhet påverkar miljön, använda bästa tillgängliga teknik där det är relevant, och välja minst skadliga kemiska produkter vid inköp."

- **(EU) nr 852/2020:** "Vi behöver förstå hur EU:s klassificeringssystem för hållbara investeringar berör vår verksamhet. Om vi omfattas av krav på hållbarhetsrapportering ska vi kunna redovisa hur våra aktiviteter förhåller sig till taxonomins sex miljömål."

- **SFS 2006:985:** "Vi ska se till att byggnader vi äger eller hyr ut har en giltig energideklaration. Deklarationen får inte vara äldre än tio år och ska finnas tillgänglig vid försäljning och uthyrning."

### Section B: Avfallshantering och restprodukter

```
compliance_context: "service_company_waste_management"
trigger_phrases: ["avfall", "farligt avfall", "avfallsregister", "sortering", "avfallsförordning", "elektronik", "lysrör"]
```

**Example compliance summaries (laglig.se originals):**

- **SFS 2020:614:** "Vi ska sortera vårt avfall i rätt fraktioner och se till att farligt avfall — exempelvis elektronik, lysrör, batterier och kemikalierester — hanteras separat och lämnas till godkänd mottagare."

- **NFS 2020:5:** "Vi ska föra anteckningar om allt farligt avfall vi producerar och rapportera uppgifterna till Naturvårdsverkets avfallsregister. Detta gäller oavsett verksamhetens storlek — även kontor som lämnar ifrån sig lysrör eller elektronik berörs."

### Section C: Kemiska produkter och ämneshantering

```
compliance_context: "service_company_chemical_handling"
trigger_phrases: ["kemikalier", "REACH", "CLP", "säkerhetsdatablad", "kemikalieförteckning", "PCB", "märkning"]
```

**Example compliance summaries (laglig.se originals):**

- **(EG) nr 1907/2006 REACH:** "Vi behöver känna till att kemiska produkter vi använder i verksamheten — rengöringsmedel, lim, färg, lösningsmedel — omfattas av REACH-förordningens informationskrav. Vi ska ha tillgång till aktuella säkerhetsdatablad för alla kemiska produkter."

- **(EG) nr 1272/2008 CLP:** "Vi ska se till att kemiska produkter vi förvarar och använder har korrekt märkning med faropiktogram och skyddsangivelser. Om vi häller över en produkt till en annan behållare ska den nya behållaren märkas med samma information."

### Section D: Luft, klimat och ventilation

```
compliance_context: "service_company_emissions_ventilation"
trigger_phrases: ["köldmedier", "f-gas", "ventilation", "OVK", "avgasrening", "luftkonditionering", "värmepump"]
```

**Example compliance summaries (laglig.se originals):**

- **(EU) nr 573/2024:** "Vi ska kontrollera om vår kyl-, luftkonditionerings- eller värmepumpsutrustning innehåller fluorerade växthusgaser. I så fall behöver vi genomföra regelbundna läckagekontroller och föra register över utrustningen."

- **BFS 2011:16 OVK:** "Vi ska som byggnadsägare se till att obligatorisk ventilationskontroll (OVK) genomförs regelbundet — vart tredje eller sjätte år beroende på ventilationstyp. Intyget ska sitta synligt i byggnaden."

### Section E: Olycksförebyggande och brandskydd

```
compliance_context: "service_company_fire_safety"
trigger_phrases: ["brand", "brandskydd", "släckutrustning", "SBA", "utrymning", "olycka", "räddningstjänst"]
```

**Example compliance summaries (laglig.se originals):**

- **SFS 2003:778:** "Vi ska se till att våra lokaler har fungerande brandskyddsutrustning och att vi har rutiner för att förebygga brand. Vid utsläpp av giftiga ämnen ska vi underrätta räddningstjänst och länsstyrelse."

- **SRVFS 2004:3:** "Vi behöver bedriva systematiskt brandskyddsarbete. Det innebär att vi ska utse en brandskyddsansvarig, ha skriftlig brandskyddsdokumentation, och regelbundet utbilda personal, genomföra övningar och kontrollera brandskyddsåtgärder."

### Section F: Brandfarliga och explosiva varor

```
compliance_context: "service_company_flammable_goods"
trigger_phrases: ["brandfarlig", "gasol", "sprejburk", "aerosol", "brandfarlig vätska", "tillstånd", "förvaring"]
```

**Example compliance summaries (laglig.se originals):**

- **SFS 2010:1011:** "Vi ska vidta nödvändiga försiktighetsmått vid hantering och förvaring av brandfarliga varor. Om vi förvarar brandfarliga vätskor eller gaser över vissa mängdgränser behöver vi tillstånd från kommunen."

- **MSBFS 2020:1:** "Vi ska följa reglerna för förvaring av brandfarlig gas och aerosolbehållare (sprejburkar). Krav finns på ventilation, skyltning, och placering. Enligt föreskriftens tabell 1 kan lösa behållare med en total volym under 60 liter vid en icke-publik verksamhet placeras utan avståndskrav."
