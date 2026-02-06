---
analysis_type: 'cross-list'
lists_analyzed: 9
total_unique_documents: 477
total_document_rows: 657
regulatory_prefixes: 30
---

# Laglistor -- Korslisteanalys

Cross-list synthesis covering all 9 regulatory law lists extracted from
the Notisum source data. Every section name, summary sentence, and
categorisation scheme in this file is original to laglig.se.
Statutes are referenced solely by their public-domain SFS / AFS / EU
instrument numbers and official titles.

---

## 1. Overview & Methodology

### 1.1 Scope

Nine distinct law lists were parsed, normalised, and loaded into
structured CSV files. Each row represents one regulatory document
(statute, agency regulation, EU instrument, or guidance reference)
together with the list it belongs to, an optional section assignment,
and any associated commentary or summary text.

### 1.2 Identification & Deduplication

Documents were matched across lists by their canonical reference
identifier (e.g. `SFS 2010:1011`, `AFS 2020:1`, `(EU) 2016/679`).
Where the same statute appeared with minor title variations in
different lists the SFS/AFS/EU number was treated as the single
source of truth.

### 1.3 List Shorthand

Throughout this document the following abbreviated names are used:

| Abbreviation | Full laglig.se Working Name                  | Row Count |
| ------------ | -------------------------------------------- | --------- |
| Arb.         | Workplace Safety & Conditions                | 112       |
| Arb.tj.      | Workplace Safety -- Service Sector           | 55        |
| Fast-Bygg    | Property & Construction                      | 110       |
| Halsa        | Healthcare & Patient Safety                  | 91        |
| InfoSak      | Information Security & Data Protection       | 42        |
| Livsm.       | Food Safety & Hygiene                        | 53        |
| Miljo        | Environmental Protection                     | 98        |
| Miljo.SE     | Environmental Compliance -- Sweden Workplace | 64        |
| Miljo.tj.    | Environmental -- Service Sector              | 32        |

**Combined row count: 657**

---

## 2. Overlap Matrix

The matrix below shows the number of documents shared between each
pair of lists. Diagonal values (bold) indicate total documents in
that list.

|               | Arb.    | Arb.tj. | Fast-Bygg | Halsa  | InfoSak | Livsm. | Miljo  | Miljo.SE | Miljo.tj. |
| ------------- | ------- | ------- | --------- | ------ | ------- | ------ | ------ | -------- | --------- |
| **Arb.**      | **112** | 55      | 9         | 4      | 2       | 1      | 22     | 37       | 11        |
| **Arb.tj.**   | 55      | **55**  | 3         | 4      | 2       | 0      | 9      | 30       | 9         |
| **Fast-Bygg** | 9       | 3       | **110**   | 1      | 0       | 0      | 14     | 2        | 7         |
| **Halsa**     | 4       | 4       | 1         | **91** | 3       | 0      | 1      | 5        | 0         |
| **InfoSak**   | 2       | 2       | 0         | 3      | **42**  | 0      | 0      | 3        | 0         |
| **Livsm.**    | 1       | 0       | 0         | 0      | 0       | **53** | 1      | 1        | 0         |
| **Miljo**     | 22      | 9       | 14        | 1      | 0       | 1      | **98** | 1        | 30        |
| **Miljo.SE**  | 37      | 30      | 2         | 5      | 3       | 1      | 1      | **64**   | 1         |
| **Miljo.tj.** | 11      | 9       | 7         | 0      | 0       | 0      | 30     | 1        | **32**    |

### 2.1 Reading the Matrix

- The highest off-diagonal value is **55** (Arb.tj. vs Arb.), meaning
  every document in the service-sector workplace list also appears in
  the full workplace list.
- The second-highest pair is **37** (Miljo.SE vs Arb.), revealing that
  Miljo.SE is predominantly a workplace/HR-oriented list rather than a
  pure environmental list.
- **30** appears twice: Miljo.tj. vs Miljo (environmental service-sector
  subset) and Miljo.SE vs Arb.tj. (workplace overlap).
- Several list pairs share zero documents (e.g. InfoSak-Livsm.,
  InfoSak-Fast-Bygg, Halsa-Miljo.tj.), confirming strong domain
  separation in those cases.

---

## 3. Most Shared Laws (3+ lists)

### 3.1 Laws Appearing in 5 Lists (Maximum Breadth)

These three instruments span the widest range of regulatory domains,
appearing in five of the nine lists:

| Instrument    | Official Title                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| (EU) 2016/679 | Europaparlamentets och radets forordning om skydd for fysiska personer med avseende pa behandling av personuppgifter (GDPR) |
| SFS 2018:218  | Lag med kompletterande bestammelser till EU:s dataskyddsforordning                                                          |
| SFS 2021:890  | Lag om skydd for personer som rapporterar om missforhallanden (visselblasarlagen)                                           |

Data protection (GDPR + its Swedish complement) and whistleblower
protection cut across workplace, environmental, healthcare,
information-security, and property domains.

### 3.2 Laws Appearing in 4 Lists (13 instruments)

| Instrument                                                                   | Domains Represented                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| SFS 2008:567 -- Diskrimineringslag                                           | Workplace, service-sector, healthcare, info-security |
| AFS 2020:1 -- Arbetsplatsens utformning                                      | Workplace, service-sector, property, env-SE          |
| SFS 1991:1273 -- Forordning om funktionskontroll av ventilationssystem (OVK) | Workplace, property, environment, env-service        |
| SFS 2003:778 -- Lag om skydd mot olyckor                                     | Workplace, property, environment, env-service        |
| SRVFS 2004:3 / MSBFS successors -- Systematiskt brandskyddsarbete (SBA)      | Workplace, property, environment, env-service        |
| SFS 2010:1011 -- Lag om brandfarliga och explosiva varor (LBE)               | Workplace, property, environment, env-service        |
| SFS 2010:1075 -- Forordning om brandfarliga och explosiva varor              | Workplace, property, environment, env-service        |
| MSBFS 2020:1 -- Hantering av brandfarlig gas                                 | Workplace, service-sector, property, environment     |
| MSBFS 2018:3 -- Cisterner och rorledningar for brandfarliga vatskor          | Workplace, service-sector, property, environment     |
| (EG) 1907/2006 -- REACH-forordningen                                         | Workplace, service-sector, environment, env-service  |
| (EG) 1272/2008 -- CLP-forordningen                                           | Workplace, service-sector, environment, env-service  |
| KIFS 2017:7 -- Kemiska produkter och biotekniska organismer                  | Workplace, service-sector, environment, env-service  |
| SFS 2007:19 -- Forordning om PCB m.m.                                        | Workplace, property, environment, env-service        |

Fire safety, hazardous substances, and chemical regulations dominate
the 4-list tier, reflecting obligations that span physical workplaces,
buildings, and environmental protection simultaneously.

### 3.3 Laws Appearing in 3 Lists (34 instruments)

Thirty-four additional instruments appear in exactly three lists. These
are predominantly core labour-law statutes shared across Arb., Arb.tj.,
and Miljo.SE (the workplace-oriented trio), along with a secondary
cluster of environmental-management instruments shared across Miljo,
Miljo.tj., and Fast-Bygg.

Key themes in this tier include:

- **Employment conditions & working hours** -- e.g. SFS 1982:80
  (Anstallningsskyddslag), SFS 1970:943 (Arbetstidslag successor refs)
- **Workplace safety specifics** -- e.g. multiple AFS provisions on
  machinery, ergonomics, and chemical exposure limits
- **Environmental operational permits** -- e.g. provisions in
  Miljobalken (SFS 1998:808) chapters, Avfallsforordningen
  (SFS 2020:614)

---

## 4. Complete Source Registry

Thirty distinct regulatory-instrument prefixes were identified across
all 9 lists. They are grouped by issuing authority level.

### 4.1 Swedish Government (Riksdag / Regeringskansliet)

| Prefix | Description                                                                | Occurrences | Lists Present |
| ------ | -------------------------------------------------------------------------- | ----------- | ------------- |
| SFS    | Svensk forfattningssamling -- acts of parliament and government ordinances | 365         | All 9         |

### 4.2 Swedish Agency Regulations

| Prefix   | Issuing Agency                                           | Occurrences | Lists Present                                       |
| -------- | -------------------------------------------------------- | ----------- | --------------------------------------------------- |
| AFS      | Arbetsmiljoverket (Work Environment Authority)           | 87          | Arb., Arb.tj., Fast-Bygg, Miljo.SE                  |
| BFS      | Boverket (National Board of Housing)                     | 21          | Arb., Fast-Bygg, Miljo, Miljo.tj.                   |
| ELSAK-FS | Elsakerhetsverket (Electrical Safety Authority)          | 7           | Arb., Arb.tj., Fast-Bygg                            |
| FFFS     | Finansinspektionen (Financial Supervisory Authority)     | 1           | InfoSak                                             |
| FKFS     | Forsakringskassan (Social Insurance Agency)              | 1           | Miljo.SE                                            |
| HSLF-FS  | Socialstyrelsen -- healthcare & social services regs     | 11          | Fast-Bygg, Halsa                                    |
| HVMFS    | Havs- och vattenmyndigheten (Marine & Water Authority)   | 1           | Livsm.                                              |
| IMYFS    | Integritetsskyddsmyndigheten (Data Protection Authority) | 1           | InfoSak                                             |
| KIFS     | Kemikalieinspektionen (Chemicals Agency)                 | 6           | Arb., Arb.tj., Miljo, Miljo.tj.                     |
| LIVSFS   | Livsmedelsverket (National Food Agency)                  | 16          | Livsm.                                              |
| LMFS     | Lantmateriet (Land Survey Authority)                     | 3           | Fast-Bygg                                           |
| MIGRFS   | Migrationsverket (Migration Agency)                      | 1           | Miljo.SE                                            |
| MSBFS    | MSB (Civil Contingencies Agency)                         | 27          | Arb., Arb.tj., Fast-Bygg, InfoSak, Miljo, Miljo.tj. |
| NFS      | Naturvardsverket (Environmental Protection Agency)       | 17          | Fast-Bygg, Miljo, Miljo.tj.                         |
| PMFS     | Polismyndigheten (Police Authority)                      | 1           | InfoSak                                             |
| PTSFS    | Post- och telestyrelsen (Telecom Authority)              | 1           | InfoSak                                             |
| SCB-FS   | Statistiska centralbyran (Statistics Sweden)             | 2           | Fast-Bygg, Miljo                                    |
| SJVFS    | Jordbruksverket (Board of Agriculture)                   | 3           | Livsm.                                              |
| SKVFS    | Skatteverket (Tax Agency)                                | 3           | Arb., Livsm., Miljo.SE                              |
| SLVFS    | Livsmedelsverket -- legacy prefix                        | 1           | Livsm.                                              |
| SOSFS    | Socialstyrelsen -- older healthcare prefix               | 6           | Halsa                                               |
| SRVFS    | Raddningsverket (now MSB) -- legacy prefix               | 6           | Arb., Arb.tj., Fast-Bygg, Miljo, Miljo.tj.          |
| SSMFS    | Stralsakerhetsmyndigheten (Radiation Safety Authority)   | 3           | Halsa, Miljo                                        |
| STAFS    | SWEDAC (Accreditation Authority)                         | 1           | Miljo                                               |
| STEMFS   | Energimyndigheten (Energy Agency)                        | 2           | Fast-Bygg, InfoSak                                  |
| SvKFS    | Svenska kraftnat (National Grid)                         | 2           | InfoSak                                             |
| TSFS     | Transportstyrelsen (Transport Agency)                    | 4           | Fast-Bygg, InfoSak, Miljo.SE                        |

### 4.3 EU Legislation

| Prefix | Description                               | Approx. Occurrences | Lists Present                                                                        |
| ------ | ----------------------------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| (EU)   | Post-Lisbon EU regulations and directives | ~30                 | 8 of 9 (not Livsm. as standalone prefix -- food-safety EU regs use different format) |
| (EG)   | Pre-Lisbon EC regulations and directives  | ~27                 | Multiple                                                                             |

### 4.4 Non-Regulatory References

| Prefix     | Origin                                          | Occurrences | Lists Present  |
| ---------- | ----------------------------------------------- | ----------- | -------------- |
| Checklista | Arbetsmiljoverket / Prevent guidance checklists | 3           | Arb., Miljo.SE |
| OMD DI     | Datainspektionen (now IMY) guidance documents   | 2           | InfoSak        |
| MXXA       | Livsmedelsverket risk-classification model      | 1           | Livsm.         |
| OVRM       | Industry-body best-practice guidelines          | 2           | Livsm.         |

---

## 5. Per-List Regulatory Prefix Distribution

The table below shows how many documents from each prefix appear in
each list. Only prefixes with at least one occurrence are shown per
list.

### 5.1 Arb. (Workplace Safety & Conditions) -- 112 rows

| Prefix      | Count | Share |
| ----------- | ----- | ----- |
| SFS         | 48    | 42.9% |
| AFS         | 41    | 36.6% |
| (EU) / (EG) | 8     | 7.1%  |
| MSBFS       | 5     | 4.5%  |
| BFS         | 3     | 2.7%  |
| ELSAK-FS    | 2     | 1.8%  |
| KIFS        | 2     | 1.8%  |
| SRVFS       | 1     | 0.9%  |
| Checklista  | 1     | 0.9%  |
| SKVFS       | 1     | 0.9%  |

### 5.2 Arb.tj. (Workplace Safety -- Service Sector) -- 55 rows

| Prefix      | Count | Share |
| ----------- | ----- | ----- |
| SFS         | 22    | 40.0% |
| AFS         | 19    | 34.5% |
| (EU) / (EG) | 5     | 9.1%  |
| MSBFS       | 4     | 7.3%  |
| ELSAK-FS    | 2     | 3.6%  |
| KIFS        | 2     | 3.6%  |
| SRVFS       | 1     | 1.8%  |

### 5.3 Fast-Bygg (Property & Construction) -- 110 rows

| Prefix      | Count | Share |
| ----------- | ----- | ----- |
| SFS         | 56    | 50.9% |
| BFS         | 15    | 13.6% |
| NFS         | 9     | 8.2%  |
| HSLF-FS     | 7     | 6.4%  |
| MSBFS       | 5     | 4.5%  |
| (EU) / (EG) | 4     | 3.6%  |
| ELSAK-FS    | 3     | 2.7%  |
| AFS         | 3     | 2.7%  |
| LMFS        | 3     | 2.7%  |
| SRVFS       | 2     | 1.8%  |
| SCB-FS      | 1     | 0.9%  |
| STEMFS      | 1     | 0.9%  |
| TSFS        | 1     | 0.9%  |

### 5.4 Halsa (Healthcare & Patient Safety) -- 91 rows

| Prefix      | Count | Share |
| ----------- | ----- | ----- |
| SFS         | 67    | 73.6% |
| HSLF-FS     | 4     | 4.4%  |
| SOSFS       | 6     | 6.6%  |
| (EU) / (EG) | 8     | 8.8%  |
| SSMFS       | 2     | 2.2%  |
| AFS         | 2     | 2.2%  |
| Other       | 2     | 2.2%  |

### 5.5 InfoSak (Information Security & Data Protection) -- 42 rows

| Prefix      | Count | Share |
| ----------- | ----- | ----- |
| SFS         | 22    | 52.4% |
| (EU) / (EG) | 6     | 14.3% |
| MSBFS       | 4     | 9.5%  |
| SvKFS       | 2     | 4.8%  |
| STEMFS      | 1     | 2.4%  |
| TSFS        | 2     | 4.8%  |
| PTSFS       | 1     | 2.4%  |
| PMFS        | 1     | 2.4%  |
| FFFS        | 1     | 2.4%  |
| IMYFS       | 1     | 2.4%  |
| OMD DI      | 2     | 4.8%  |

Note: InfoSak has the highest proportion of niche agency prefixes,
reflecting the fragmented regulatory landscape for cybersecurity and
data protection in Sweden.

### 5.6 Livsm. (Food Safety & Hygiene) -- 53 rows

| Prefix      | Count | Share |
| ----------- | ----- | ----- |
| SFS         | 18    | 34.0% |
| LIVSFS      | 16    | 30.2% |
| (EU) / (EG) | 9     | 17.0% |
| SJVFS       | 3     | 5.7%  |
| SKVFS       | 1     | 1.9%  |
| HVMFS       | 1     | 1.9%  |
| SLVFS       | 1     | 1.9%  |
| MXXA        | 1     | 1.9%  |
| OVRM        | 2     | 3.8%  |
| Other       | 1     | 1.9%  |

Note: Livsm. has the strongest agency-specific skew -- nearly a third
of all entries are Livsmedelsverket (LIVSFS) provisions.

### 5.7 Miljo (Environmental Protection) -- 98 rows

| Prefix      | Count | Share |
| ----------- | ----- | ----- |
| SFS         | 45    | 45.9% |
| NFS         | 8     | 8.2%  |
| (EU) / (EG) | 12    | 12.2% |
| MSBFS       | 6     | 6.1%  |
| BFS         | 3     | 3.1%  |
| KIFS        | 2     | 2.0%  |
| SRVFS       | 2     | 2.0%  |
| SCB-FS      | 1     | 1.0%  |
| SSMFS       | 1     | 1.0%  |
| STAFS       | 1     | 1.0%  |
| AFS         | 3     | 3.1%  |
| Other       | 14    | 14.3% |

### 5.8 Miljo.SE (Environmental Compliance -- Sweden Workplace) -- 64 rows

| Prefix      | Count | Share |
| ----------- | ----- | ----- |
| SFS         | 30    | 46.9% |
| AFS         | 19    | 29.7% |
| (EU) / (EG) | 5     | 7.8%  |
| TSFS        | 1     | 1.6%  |
| Checklista  | 2     | 3.1%  |
| FKFS        | 1     | 1.6%  |
| MIGRFS      | 1     | 1.6%  |
| SKVFS       | 1     | 1.6%  |
| Other       | 4     | 6.3%  |

Note: the presence of AFS as the second-largest prefix confirms
Miljo.SE is operationally a workplace-conditions list, not a pure
environmental list.

### 5.9 Miljo.tj. (Environmental -- Service Sector) -- 32 rows

| Prefix      | Count | Share |
| ----------- | ----- | ----- |
| SFS         | 15    | 46.9% |
| NFS         | 4     | 12.5% |
| (EU) / (EG) | 4     | 12.5% |
| MSBFS       | 3     | 9.4%  |
| BFS         | 2     | 6.3%  |
| KIFS        | 2     | 6.3%  |
| SRVFS       | 1     | 3.1%  |
| Other       | 1     | 3.1%  |

---

## 6. Subset and Superset Relationships

### 6.1 Full Subset: Arb.tj. inside Arb.

Every one of the 55 documents in the service-sector workplace list also
appears in the full workplace list (55/55 = 100% overlap). The full
workplace list contains an additional 57 documents covering sectors
beyond service industries (manufacturing, construction-adjacent
provisions, etc.).

**Implication for laglig.se:** Arb.tj. does not need independent
storage -- it can be modelled as a filtered view of Arb. with a
sector tag.

### 6.2 Near-Complete Subset: Miljo.tj. inside Miljo

Thirty of the 32 documents in the environmental service-sector list
also appear in the full environmental list (30/32 = 93.8%). The two
unique entries are minor service-sector-specific provisions.

**Implication for laglig.se:** Similar to the workplace pair, Miljo.tj.
can be treated as a sector-filtered view of Miljo with only 2
supplementary entries.

### 6.3 Misleading Name: Miljo.SE is a Workplace List

Despite its name suggesting "Environmental -- Sweden", Miljo.SE shares
only 1 document with the main Miljo list. Instead, it shares:

- 37 documents with Arb. (57.8% of its content)
- 30 documents with Arb.tj. (46.9% of its content)

The list is operationally a workplace-conditions and employer-obligation
collection that happens to be marketed under an environmental label.

**Implication for laglig.se:** When building domain taxonomies, Miljo.SE
content should be associated with the workplace/employer-obligations
domain, not the environmental-protection domain. Its 27 unique entries
(those not in Arb.) likely represent general employer duties such as
anti-discrimination, migration/work-permit rules, and tax registration.

### 6.4 Fully Independent Lists

The following list pairs share zero documents, confirming they operate
in entirely distinct regulatory domains:

- InfoSak -- Livsm.
- InfoSak -- Fast-Bygg
- InfoSak -- Miljo.tj.
- Halsa -- Miljo.tj.
- Halsa -- Livsm.
- Livsm. -- Fast-Bygg
- Livsm. -- Arb.tj.
- Livsm. -- Miljo.tj.

---

## 7. Categorization Status Comparison

### 7.1 Status Overview

| List      | Categorization Level              | Section Count       | Scheme                                         |
| --------- | --------------------------------- | ------------------- | ---------------------------------------------- |
| Arb.      | Fully categorized with SSDD index | 9 sections          | Two-digit section + two-digit document         |
| Arb.tj.   | Fully categorized with SSDD index | 7 sections          | Two-digit section + two-digit document         |
| Miljo     | Fully categorized with SSDD index | 9 sections          | Two-digit section + two-digit document         |
| Miljo.tj. | Partially structured              | 6 implicit sections | Section names derivable from index gaps        |
| InfoSak   | Partially structured              | 5 named sections    | All documents currently assigned to section 05 |
| Fast-Bygg | Uncategorized                     | --                  | Flat list, no sections                         |
| Halsa     | Uncategorized                     | --                  | Flat list, no sections                         |
| Livsm.    | Uncategorized                     | --                  | Flat list, no sections                         |
| Miljo.SE  | Uncategorized                     | --                  | Flat list, no sections                         |

### 7.2 Observations

- The three fully categorized lists (Arb., Arb.tj., Miljo) use a
  consistent SSDD indexing scheme that should be adopted as the
  laglig.se standard.
- InfoSak has section names defined but the actual assignment is
  broken -- all rows map to a single bucket. This needs manual
  redistribution.
- Four lists (Fast-Bygg, Halsa, Livsm., Miljo.SE) will require
  full section-structure design from scratch.

---

## 8. Content Richness Assessment

### 8.1 Field Coverage by List

| List      | Commentary Field | Summary Field | Compliance-Action Field |
| --------- | ---------------- | ------------- | ----------------------- |
| Arb.      | 100%             | 100%          | 0%                      |
| Arb.tj.   | 100%             | 100%          | 0%                      |
| Miljo     | 100%             | 97%           | 0%                      |
| Halsa     | 99%              | 100%          | 0%                      |
| Miljo.tj. | 100%             | 100%          | 0%                      |
| InfoSak   | ~90%             | ~80%          | 0%                      |
| Fast-Bygg | ~70%             | 0%            | 0%                      |
| Livsm.    | ~70%             | 0%            | 0%                      |
| Miljo.SE  | ~70%             | 0%            | 0%                      |

### 8.2 Three Quality Tiers

**Tier A -- Rich metadata (5 lists, 392 rows / 59.7%)**
Arb., Arb.tj., Miljo, Halsa, Miljo.tj. all have both commentary and
summary text at 97-100% coverage. These lists can be imported into
laglig.se with minimal manual enrichment.

**Tier B -- Partial metadata (1 list, 42 rows / 6.4%)**
InfoSak has reasonable commentary (~90%) but incomplete summaries
(~80%). The missing 10-20% corresponds to niche agency regulations
that had no Notisum editorial text.

**Tier C -- Sparse metadata (3 lists, 223 rows / 33.9%)**
Fast-Bygg, Livsm., and Miljo.SE have commentary on roughly 70% of
rows but zero summary text. These lists will need the most original
content creation during laglig.se onboarding.

### 8.3 Compliance-Action Gap

No list in the source data contains any compliance-action text
(the field that would describe what an organisation must _do_ to
comply). This represents the primary value-add opportunity for
laglig.se: generating original, actionable compliance guidance for
every document.

---

## 9. Notisum Topic Area Context

### 9.1 Topic Area Inventory

The source platform organises its content into 18 named topic areas.
Of these, 14 contain actual law lists and 4 are empty placeholders:

**Active topic areas (14):**
Each active area follows a standard four-part internal structure with
sections for general provisions, specific requirements, reporting/
documentation duties, and enforcement/penalties.

**Empty topic areas (4):**

| Topic Area                      | Likely Intended Scope                |
| ------------------------------- | ------------------------------------ |
| Public administration domain    | Government-agency-specific rules     |
| Forestry and agriculture domain | Primary-sector regulations           |
| Physical security domain        | Guard services, access control, CCTV |
| Transport and traffic domain    | Vehicle, road, and transport rules   |

### 9.2 Mapping to laglig.se Domains

The 9 extracted law lists do not map 1:1 to the 14 active topic areas.
Some topic areas contribute to multiple lists and some lists draw from
multiple topic areas. The laglig.se domain model should be built
independently of the source topic taxonomy.

---

## 10. Summary Statistics

### 10.1 Core Numbers

| Metric                                  | Value                                    |
| --------------------------------------- | ---------------------------------------- |
| Total document rows across all CSVs     | 657                                      |
| Distinct law lists analysed             | 9                                        |
| Total unique regulatory references      | ~477                                     |
| Distinct regulatory-instrument prefixes | 30                                       |
| Most common prefix                      | SFS (365 occurrences, 55.6% of all rows) |

### 10.2 Overlap Distribution

| Appearance Count  | Unique Laws | Share of Total |
| ----------------- | ----------- | -------------- |
| 1 list only       | 369         | 77.4%          |
| Exactly 2 lists   | 58          | 12.2%          |
| Exactly 3 lists   | 34          | 7.1%           |
| Exactly 4 lists   | 13          | 2.7%           |
| 5 lists (maximum) | 3           | 0.6%           |
| **Total**         | **477**     | **100%**       |

### 10.3 Key Ratios

- **Single-list exclusivity:** 77.4% of laws appear in only one list,
  confirming that most regulatory obligations are domain-specific.
- **Cross-domain universals:** Only 3 instruments (0.6%) reach 5 lists --
  all related to data protection or whistleblower protection.
- **Effective deduplication:** 657 rows reduce to 477 unique
  instruments, a 27.4% redundancy rate driven primarily by the
  Arb./Arb.tj. and Miljo/Miljo.tj. subset relationships.

### 10.4 List Size Distribution

| Rank | List      | Documents | Unique to List  |
| ---- | --------- | --------- | --------------- |
| 1    | Arb.      | 112       | ~44             |
| 2    | Fast-Bygg | 110       | ~82             |
| 3    | Miljo     | 98        | ~41             |
| 4    | Halsa     | 91        | ~77             |
| 5    | Miljo.SE  | 64        | ~27             |
| 6    | Arb.tj.   | 55        | 0 (full subset) |
| 7    | Livsm.    | 53        | ~50             |
| 8    | InfoSak   | 42        | ~32             |
| 9    | Miljo.tj. | 32        | ~2              |

---

## 11. Template Construction Guide

### 11.1 Purpose

This section provides a repeatable method for building a new laglig.se
law list for any regulatory domain, using the patterns observed across
the 9 analysed lists.

### 11.2 Step 1 -- Define the Domain

Choose a clear compliance domain (e.g. "Transport & logistics",
"Financial services", "Education"). Identify the 2-4 primary regulatory
bodies whose instruments will dominate the list:

- There will almost always be a set of SFS statutes (acts + ordinances)
- Identify the 1-2 key agency-regulation prefixes (e.g. TSFS for
  transport, FFFS for finance)
- Check for relevant EU regulations

### 11.3 Step 2 -- Determine Section Structure

Based on the successfully categorized lists, use 6-10 sections.
Recommended starting template:

| Section                                   | Purpose                                   |
| ----------------------------------------- | ----------------------------------------- |
| 01 -- Foundational rules & general duties | Core statutes that define the domain      |
| 02 -- Organisational requirements         | Management systems, delegation, roles     |
| 03 -- Physical/technical requirements     | Equipment, premises, infrastructure       |
| 04 -- Personnel & competence              | Training, certification, qualifications   |
| 05 -- Documentation & reporting           | Record-keeping, notifications, registers  |
| 06 -- Inspections & controls              | Audit cycles, authority inspections       |
| 07 -- Hazard-specific provisions          | Domain-specific risk categories           |
| 08 -- Environmental interaction           | Emissions, waste, chemicals if applicable |
| 09 -- Other & cross-cutting               | Catch-all for items that span sections    |

Adjust section names and count to fit the domain. Every list should
include at least one general-rules section and one catch-all section.

### 11.4 Step 3 -- Apply the SSDD Index Scheme

Each document receives a four-digit index: two digits for section,
two digits for position within the section.

```
  SS = Section number (01-09, or up to 99)
  DD = Document sequence within section (01-99)

  Example:  0301  = Section 03, first document
            0715  = Section 07, fifteenth document
```

Leave gaps in the DD sequence (e.g. 01, 03, 05...) to allow future
insertions without renumbering.

### 11.5 Step 4 -- Populate with Cross-Referenced Shared Laws

Before adding domain-specific instruments, check the overlap data in
this document for laws that are likely to appear:

- **Universal three (5-list laws):** GDPR, Kompletterande
  dataskyddslag, Visselblasarlagen -- include in virtually every list.
- **Fire & chemical cluster (4-list laws):** If the domain involves
  physical premises, include the 13 instruments from the 4-list tier.
- **Core labour laws (3-list cluster):** If the domain involves
  employers, include the ~20 labour-law instruments shared across
  Arb., Arb.tj., and Miljo.SE.

### 11.6 Step 5 -- Add Domain-Specific Instruments

Fill remaining sections with instruments unique to the domain. Target
40-120 total documents per list based on observed list sizes. Smaller
niche domains (like InfoSak at 42) are acceptable; very large domains
may approach 110 (like Fast-Bygg).

### 11.7 Step 6 -- Content Fields

For each document, populate the following fields:

| Field                           | Priority | Notes                             |
| ------------------------------- | -------- | --------------------------------- |
| SFS/AFS/EU reference            | Required | Canonical identifier              |
| Official statute title          | Required | Public-domain title               |
| laglig.se section assignment    | Required | SSDD index                        |
| laglig.se summary               | High     | Original 1-2 sentence description |
| laglig.se compliance actions    | High     | Original actionable guidance      |
| Source commentary (if migrated) | Optional | Adapted, never copied verbatim    |

### 11.8 Quality Checklist

Before publishing a new list:

- [ ] Every document has a valid SFS/AFS/EU reference
- [ ] No section has fewer than 2 or more than 20 documents
- [ ] The three universal laws (GDPR, dataskyddslag, visselblasarlagen)
      are included if the domain involves any personal-data processing
- [ ] All summary and compliance-action text is original to laglig.se
- [ ] Section names are original and descriptive (not copied from any
      external source)
- [ ] The SSDD index has no duplicates and maintains insertion gaps
