---
document_type: 'agent-training-guide'
version: '1.0'
target: 'AI agents building laglig.se law list templates'
based_on_analyses:
  [
    '01-arbetsmiljo',
    '02-arbetsmiljo-tjansteforetag',
    '03-miljo',
    '04-miljo-tjansteforetag',
    '05-miljo-sverige',
    '06-informationssakerhet-sverige',
    '07-fastighet-bygg',
    '08-halsa-sjukvard',
    '09-livsmedel-sverige',
  ]
last_updated: '2026-02-05'
---

# Laglig.se -- Agenttreningsguide for laglistor

This document is the primary training material for AI agents constructing, maintaining, and extending law list templates on the laglig.se platform. It codifies the patterns, conventions, and quality standards derived from analysis of nine reference law lists. Every section name, compliance summary, and classification example below is original laglig.se content. Laws are referenced exclusively by their official SFS, AFS, BFS, NFS, EU, or other authority-issued designations and official statute titles.

---

## 1. Swedish Legal Hierarchy

An agent working with Swedish regulatory compliance must understand the normative hierarchy. Higher-level instruments take precedence over lower-level ones. When two provisions conflict, the higher-ranked instrument controls.

### 1.1 The hierarchy, from most to least authoritative

| Level | Swedish Term               | Description                                                                                                                                                                                                                                                                                        | Publication Channel                   | Example                                       |
| ----- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| 1     | **Grundlagar**             | Constitutional laws. Sweden has four: Regeringsformen, Tryckfrihetsforordningen, Yttrandefrihetsgrundlagen, and Successionsordningen. They define fundamental rights and the structure of government. Amending them requires two identical Riksdag decisions with an intervening general election. | SFS                                   | Regeringsformen (1974:152)                    |
| 2     | **Lagar**                  | Acts of Parliament (riksdagslagar). Passed by the Riksdag following the legislative procedure in the Riksdagsordningen. They create rights, obligations, and penalties. Identified by "Lag" in their title.                                                                                        | SFS                                   | Arbetsmiljolag (1977:1160)                    |
| 3     | **Forordningar**           | Government ordinances. Issued by the Regering (cabinet) under delegation from a lag. They add implementation detail -- procedures, fees, exemptions, reporting requirements. Identified by "Forordning" in their title.                                                                            | SFS                                   | Arbetsmiljoforordning (1977:1166)             |
| 4     | **Myndighetsforeskrifter** | Agency regulations. Issued by government agencies under delegation from a lag or forordning. They contain the most granular technical requirements. Each agency has its own publication series.                                                                                                    | Agency-specific (AFS, BFS, NFS, etc.) | AFS 2023:1 (systematiskt arbetsmiljoarbete)   |
| 5     | **EU-forordningar**        | EU regulations with direct applicability. They require no Swedish transposition and take effect across all member states simultaneously. They override conflicting national law below constitutional level.                                                                                        | EU Official Journal                   | (EU) 2016/679 (GDPR)                          |
| 6     | **EU-direktiv**            | EU directives. They set objectives that member states must achieve through national legislation. Sweden transposes directives into SFS lagar and forordningar. Until transposed, the directive text governs interpretation.                                                                        | EU Official Journal                   | 2022/2555/EU (NIS 2-direktivet)               |
| 7     | **Allmanna rad**           | Non-binding general guidance issued by agencies. They describe recommended ways to comply with binding provisions. Not legally enforceable, but courts and supervisory bodies treat compliance with allmanna rad as evidence of due diligence.                                                     | Agency-specific                       | SRVFS 2004:3 (systematiskt brandskyddsarbete) |
| 8     | **Branschriktlinjer**      | Industry guidelines. Developed by trade associations and often approved or endorsed by a supervisory authority. They translate binding rules into sector-specific practice.                                                                                                                        | Industry body                         | OVRM 51 (branschriktlinjer servicehandel)     |

### 1.2 Practical implications for agents

- **Always include the lag and its forordning together.** A lag without its implementing forordning is incomplete for compliance purposes. Many obligations are specified in the forordning, not the lag.
- **Agency foreskrifter contain the operational detail.** When a user asks "what do I actually need to do?", the answer is usually in an AFS, BFS, NFS, LIVSFS, or similar document -- not in the SFS lag.
- **EU regulations sit alongside, not below, Swedish lagar.** In matters covered by EU law, the EU regulation prevails. When building a list, place EU regulations in the section matching their subject matter, not in a separate "EU" section.
- **Allmanna rad and branschriktlinjer are not law.** Flag them clearly in list metadata. They help users understand what compliance looks like in practice but cannot create new legal obligations.

### 1.3 The regulatory-body prefix system

Swedish authorities publish their regulations using standardized alphanumeric prefixes:

| Prefix      | Full Authority Name                                                      | Domain                                                   |
| ----------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| SFS         | Svensk forfattningssamling (Riksdagen / Regeringen)                      | All law and ordinances                                   |
| AFS         | Arbetsmiljoverkets forfattningssamling                                   | Workplace safety and health                              |
| BFS         | Boverkets forfattningssamling                                            | Building, planning, housing                              |
| NFS         | Naturvardsverkets forfattningssamling                                    | Environment, waste, nature                               |
| LIVSFS      | Livsmedelsverkets forfattningssamling                                    | Food safety                                              |
| KIFS        | Kemikalieinspektionens forfattningssamling                               | Chemical products                                        |
| MSBFS       | MSB:s forfattningssamling                                                | Civil protection, flammable/explosive goods, IT security |
| ELSAK-FS    | Elsakerhetsverkets forfattningssamling                                   | Electrical safety                                        |
| SRVFS       | Raddningsverkets forfattningssamling (now MSB)                           | Fire safety (legacy)                                     |
| SKVFS       | Skatteverkets forfattningssamling                                        | Tax and personnel registers                              |
| HSLF-FS     | Gemensam forfattningssamling (halsa, socialtjanst, lakemedel, folkhalsa) | Healthcare, social services                              |
| SOSFS       | Socialstyrelsens forfattningssamling (predecessor to HSLF-FS)            | Healthcare (legacy)                                      |
| SSMFS       | Stralsakerhetsmyndighetens forfattningssamling                           | Radiation safety                                         |
| PTSFS       | Post- och telestyrelsens forfattningssamling                             | Electronic communications                                |
| TSFS        | Transportstyrelsens forfattningssamling                                  | Transport safety                                         |
| SJVFS       | Jordbruksverkets forfattningssamling                                     | Agriculture, animal health, food chain                   |
| STEMFS      | Energimyndighetens forfattningssamling                                   | Energy                                                   |
| SvKFS       | Svenska kraftnats forfattningssamling                                    | Electricity grid                                         |
| FFFS        | Finansinspektionens forfattningssamling                                  | Financial regulation                                     |
| IMYFS       | Integritetsskyddsmyndighetens forfattningssamling                        | Data protection                                          |
| PMFS        | Sakerhetspolisens forfattningssamling                                    | Security protection                                      |
| LMFS        | Lantmateriets forfattningssamling                                        | Real property, surveying                                 |
| HVMFS       | Havs- och vattenmyndighetens forfattningssamling                         | Marine, water management                                 |
| STAFS       | Swedacs forfattningssamling                                              | Accreditation                                            |
| SCB-FS      | SCB:s forfattningssamling                                                | Statistics                                               |
| FKFS        | Forsakringskassans forfattningssamling                                   | Social insurance                                         |
| MIGRFS      | Migrationsverkets forfattningssamling                                    | Immigration, work permits                                |
| SLVFS       | Livsmedelsverkets forfattningssamling (legacy prefix)                    | Food safety (legacy)                                     |
| (EU) / (EG) | EU Official Journal                                                      | Directly applicable EU regulations                       |

---

## 2. Law List Construction Patterns

### 2.1 JSON structure template for a single law list entry

```json
{
  "sfsNumber": "SFS 1977:1160",
  "documentName": "Arbetsmiljolag (1977:1160)",
  "index": "0100",
  "sectionNumber": "01",
  "sectionName": "Grundlaggande regelverk",
  "listId": "arbetsmiljo",
  "lastAmendment": "SFS 2025:732",
  "regulatoryBody": "Riksdagen",
  "sourceType": "lag",
  "euReference": null,
  "replacesOldReference": null,
  "complianceSummary": "Vi ska bedriva ett systematiskt arbetsmiljoarbete...",
  "expertCommentary": "Arbetsmiljolagen ar ramlagen for all arbetsmiljo...",
  "crossListReferences": ["miljo-sverige", "arbetsmiljo-tjansteforetag"],
  "effectiveDate": "1978-07-01",
  "isServiceCompanyRelevant": true
}
```

### 2.2 Index numbering scheme (SSDD)

Every document in a law list receives a four-digit index in the format **SSDD**:

- **SS** = two-digit section number (01, 02, 03, ... 09, 10, ...)
- **DD** = two-digit document sequence within the section (00, 10, 20, ...)

**Rules:**

1. The standard increment between documents is **10** (0100, 0110, 0120, ...) to leave insertion room.
2. When a document must be inserted between two existing entries, use the **units digit** (e.g., 0381 inserted after 0380).
3. When two documents represent complementary product-side and user-side provisions for the same subject, they **may share the same index** (e.g., 0520 for both product requirements and usage rules for display screens).
4. Section 09 documents in the source data often lack index numbers entirely. When building a laglig.se list, **always assign indexes** -- no document should be unindexed.
5. If a list has more than 9 sections, use two-digit section numbers (10, 11, 12, ...) and extend the index to five digits if needed (10100, 10110, ...).

### 2.3 Section structure requirements

| Rule                                  | Specification                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| Recommended section count             | 6--10 per list                                                                               |
| Minimum documents per section         | 3 (avoid orphan sections)                                                                    |
| Maximum percentage in "Other" section | 30% of total documents                                                                       |
| First section                         | Always "general rules" / "framework" / "grundlaggande regelverk"                             |
| Last section (if needed)              | "Other" / "Kompletterande bestammelser" -- only if documents genuinely resist classification |
| Section naming language               | Swedish                                                                                      |
| Naming style                          | Descriptive but concise, 2--6 words                                                          |

### 2.4 Required fields per document

| Field                    | Required?            | Notes                                                                                         |
| ------------------------ | -------------------- | --------------------------------------------------------------------------------------------- |
| sfsNumber                | Yes                  | Official SFS, AFS, (EU), or other reference number                                            |
| documentName             | Yes                  | Official statute title as published                                                           |
| index                    | Yes                  | SSDD format                                                                                   |
| sectionNumber            | Yes                  | Two-digit section number                                                                      |
| sectionName              | Yes                  | laglig.se original name                                                                       |
| listId                   | Yes                  | Kebab-case list identifier                                                                    |
| lastAmendment            | Recommended          | Most recent amendment SFS reference                                                           |
| regulatoryBody           | Recommended          | Issuing authority                                                                             |
| sourceType               | Recommended          | lag / forordning / foreskrift / eu-forordning / eu-direktiv / allmanna-rad / branschriktlinje |
| complianceSummary        | Yes                  | laglig.se-voice obligation summary (see Section 5)                                            |
| expertCommentary         | Yes                  | laglig.se original commentary (see Section 6)                                                 |
| replacesOldReference     | If applicable        | "ersatter AFS YYYY:N" notation for consolidated provisions                                    |
| crossListReferences      | Recommended          | Array of list IDs where this document also appears                                            |
| isServiceCompanyRelevant | Yes for subset lists | Boolean flag for tjanstefoeretag filtering                                                    |

### 2.5 Building a new list from scratch

**Step-by-step process:**

1. **Define the domain and audience.** Write a one-paragraph scope statement: who is the primary user, what regulatory obligations are covered, and what is explicitly excluded.
2. **Inventory all applicable statutes.** Systematically search the Swedish legal databases (riksdagen.se, lagrummet.se) and EU EUR-Lex for every binding instrument in the domain.
3. **Classify by subject matter.** Group documents into 6--10 thematic clusters based on the compliance obligations they create, not by the issuing authority.
4. **Name the sections.** Apply the naming conventions in Section 3 below.
5. **Assign index numbers.** Use the SSDD scheme with increments of 10.
6. **Write compliance summaries.** Follow the style guide in Section 5.
7. **Write expert commentary.** Follow the pattern in Section 6.
8. **Validate against the quality checklist.** Run through Section 8.
9. **Document cross-list overlaps.** Check every document against all existing lists and record which ones share it.
10. **Derive subset variants.** If a tjanstefoeretag or sector-specific variant is needed, apply the subset construction rules in Section 7.

---

## 3. Laglig.se Section Naming Conventions

### 3.1 Decision tree for naming a section

```
1. What is the primary SUBJECT MATTER of the documents in this section?
   |
   v
2. Can it be expressed in 2-6 Swedish words?
   |-- Yes -> Use that phrase
   |-- No  -> Simplify. Focus on the core compliance obligation, not the legal technicalities.
   |
   v
3. Does the name duplicate an existing laglig.se section name in another list?
   |-- Yes -> Add a scope qualifier (e.g., "Kemiska risker i arbetsmiljon" vs. "Kemiska produkter och amneshantering")
   |-- No  -> Proceed
   |
   v
4. Does the name use Notisum's exact section heading?
   |-- Yes -> RENAME. We always use our own names.
   |-- No  -> Approved
```

### 3.2 Naming rules

1. **Always Swedish.** Section names must be in Swedish. Do not use English, Latin, or abbreviations unless the abbreviation is universally understood in Swedish regulatory context (e.g., "OVK" is acceptable within a longer name).
2. **Descriptive but concise.** Target 2--6 words. Avoid single-word names ("Avfall") and avoid long names ("Regler om hantering av avfall, atervinning och producentansvar for forpackningar").
3. **Subject-matter focus.** Name the compliance area, not the regulatory body. "Kemiska risker och farliga amnen" (good) vs. "Kemikalieinspektionens regler" (bad).
4. **Our own words.** Never replicate the source's exact section heading. The source might use "OVRIGA DOKUMENT" -- we use "Kompletterande bestammelser och specialomraden". The source might use "HR" -- we use "Arbetsratt och personalforvaltning".
5. **Pattern: {Topic area} + {scope qualifier}.** The topic area captures what the section is about; the optional scope qualifier distinguishes it from similar sections in other lists.

### 3.3 Section name examples across the 9 analyzed lists

| List        | Source Section Name   | laglig.se Section Name                                       | Pattern Applied                                                |
| ----------- | --------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| Arbetsmiljo | ALLMANNA REGLER       | Grundlaggande regelverk                                      | Topic: foundation; Qualifier: none needed                      |
| Arbetsmiljo | HR                    | Arbetsratt och personalforvaltning                           | Topic: employment law; Qualifier: HR management scope          |
| Arbetsmiljo | FYSISK ARBETSMILJO    | Fysisk belastning och lokalforhallanden                      | Topic: physical hazards; Qualifier: body load and premises     |
| Arbetsmiljo | OVRIGA DOKUMENT       | Kompletterande bestammelser och specialomraden               | Topic: supplementary rules; Qualifier: specialized areas       |
| Miljo       | (source section "01") | Overgripande miljolagstiftning och rapporteringsskyldigheter | Topic: environmental framework; Qualifier: reporting duties    |
| Miljo       | (source section "02") | Avfallshantering, atervinning och producentansvar            | Topic: waste; Qualifier: recycling and producer responsibility |
| Miljo tj.   | (section A)           | Grundregler och rapportering                                 | Topic: basics; Qualifier: reporting obligations                |
| Miljo tj.   | (section D)           | Luft, klimat och ventilation                                 | Topic: air/climate; Qualifier: ventilation systems             |
| Info.sak.   | (section B)           | Systematisk informationssakerhet och incidenthantering       | Topic: info security; Qualifier: incident management           |
| Fastighet   | (section A)           | Fastighetsratt och agande                                    | Topic: property law; Qualifier: ownership                      |
| Fastighet   | (section F)           | Energi, klimat och installationer                            | Topic: energy; Qualifier: climate and installations            |
| Halsa       | (section B)           | Patientsakerhet, kvalitetsledning och tillsyn                | Topic: patient safety; Qualifier: quality and oversight        |
| Livsmedel   | (section B)           | Hygien, temperaturkontroll och anlaggningskrav               | Topic: hygiene; Qualifier: temperature and premises            |
| Miljo Sv.   | (section E)           | Likabehandling, transparens och visselblasning               | Topic: equality; Qualifier: transparency and whistleblowing    |

---

## 4. Document Classification Rules

### 4.1 Decision tree for assigning a law to a section

```
START: You have a document with an SFS/AFS/EU number and an official title.
  |
  v
STEP 1: Read the title and identify the PRIMARY subject matter.
  |-- Is it a framework statute that creates overarching obligations for the entire domain?
  |   -> Section 01 (Grundlaggande regelverk / Framework)
  |
  |-- Does it regulate a SPECIFIC hazard type, activity, or sub-domain?
  |   -> Identify which thematic section matches that sub-domain
  |
  |-- Does it address MULTIPLE sub-domains simultaneously?
  |   -> Go to Step 2
  |
  v
STEP 2: For multi-topic documents (e.g., Miljobalken, omnibus AFS provisions):
  |-- Can the document be referenced by chapter or section?
  |   -> Place the document in the section matching its PRIMARY use in this list
  |   -> Add a note in expertCommentary about which chapters are most relevant
  |
  |-- Does the document genuinely span all sections equally?
  |   -> Place it in Section 01 (framework) with cross-references
  |
  v
STEP 3: Check the regulatory-body alignment:
  |-- Does this document come from the same authority as most other documents in a section?
  |   -> Weak signal, but supports the assignment
  |-- Does this document come from a DIFFERENT authority than the section norm?
  |   -> That is fine. Group by SUBJECT MATTER, not by issuing body.
  |
  v
STEP 4: Validate:
  |-- Does the section now have fewer than 3 documents? -> Consider merging
  |-- Does the section now have more than 30% of all documents? -> Consider splitting
  |-- Does the "Other" section exceed 30%? -> Reclassify some documents
```

### 4.2 Classification by subject matter (primary rule)

The primary classification axis is always **what the document regulates**, not who issued it. A chemical-safety provision from Arbetsmiljoverket (AFS) and one from Kemikalieinspektionen (KIFS) belong in the same section if they both regulate chemical handling in the same context.

### 4.3 Secondary classification by regulatory body

Use regulatory-body grouping only as a tiebreaker when subject matter is ambiguous. If a document could fit in two sections equally well, place it in the section where its regulatory body is most represented.

### 4.4 Handling multi-topic laws

Several Swedish laws are "code-type" statutes that span many topics:

| Statute                                 | Approach                                                                                                                                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Miljobalken (SFS 1998:808)              | Reference specific chapters as separate entries if the list needs granular coverage (e.g., "Kap 2 -- Allmanna hansynsregler", "Kap 14 -- Kemiska produkter", "Kap 15 -- Avfall"). Place each chapter entry in its matching section. |
| AFS 2023:2 (omnibus provision)          | Reference specific chapters as separate entries (e.g., "kap. 2 -- organisatorisk och social arbetsmiljo", "kap. 6 -- ensamarbete"). Each chapter entry goes to its matching section.                                                |
| AFS 2023:10 (physical/chemical hazards) | Same approach. Chapters on noise, vibration, chemicals, etc. are separate entries in different sections.                                                                                                                            |
| Socialforsakringsbalken (SFS 2010:110)  | Treat as a single entry in the most relevant section. It is too broad to split by chapter in most lists.                                                                                                                            |

### 4.5 When to use "Other" vs. when to split

- **Use "Other"** when a document genuinely does not fit any thematic section AND there are fewer than 3 documents sharing its sub-topic. A miscellaneous section is acceptable if it remains under 30% of the total list.
- **Split** when the "Other" section grows beyond 30% or when a clear sub-topic within "Other" accumulates 3 or more documents. In the Arbetsmiljo list, the 43-document "Other" section should be split into at least 4 sub-sections (transport, radiation, advanced chemical hazards, specialized equipment). In the Miljo list, the 47-document "Other" should be split into 8-9 sub-groups.

---

## 5. Compliance Summary Style Guide -- Laglig.se Voice

This is the most critical section for agent training. Every law list entry must include a compliance summary written in laglig.se's own distinctive voice. These summaries are the first thing a compliance officer reads. They must be accurate, actionable, and original.

### 5.1 Voice pattern

laglig.se compliance summaries use **first-person plural, obligation-focused language**:

| Pattern                    | Swedish                        | Usage                                                 |
| -------------------------- | ------------------------------ | ----------------------------------------------------- |
| Core obligation            | "Vi ska..." / "Vi behover..."  | For mandatory requirements                            |
| Ensuring compliance        | "Vi ska sakerstalla att..."    | When the obligation is to verify a condition          |
| Legal duty                 | "Vi ar skyldiga att..."        | For absolute obligations with penalty backing         |
| Organizational requirement | "Organisationen maste..."      | When the duty falls on the entity, not individuals    |
| Conditional trigger        | "Om vi [condition], ska vi..." | For obligations triggered by thresholds or activities |
| Prohibition                | "Vi far inte..."               | For explicit prohibitions                             |

### 5.2 Structural rules

1. **Start with the core obligation.** The first sentence must state what the organization is required to do.
2. **Include who is responsible.** Identify the duty-holder: employer, building owner, food business operator, care provider, etc.
3. **Mention key thresholds or limits.** If the law has employee-count triggers, quantity thresholds, or time limits, include them.
4. **Reference related regulations.** If compliance requires reading another provision in conjunction, mention it briefly.
5. **Keep to 2--4 sentences.** Compliance summaries are not legal analyses. They are orientation texts.
6. **Use active voice, present tense.** "Vi ska genomfora riskbedomningar" (active), not "Riskbedomningar ska genomforas" (passive).
7. **Never copy text from any external source.** Every compliance summary must be an original laglig.se formulation.

### 5.3 Original compliance summary examples

**Example 1 -- Framework law (Arbetsmiljolag, SFS 1977:1160):**

> Vi ska bedriva ett systematiskt arbetsmiljoarbete och sakerstalla att arbetsforhaallandena ar sakra och halsosamma. Arbetsgivaren har huvudansvaret, men arbetstagare ska medverka i arbetsmiljoarbetet. Vi behover dokumentera var arbetsmiljopolicy, genomfora riskbedomningar och folja upp atgarder kontinuerligt.

**Example 2 -- EU regulation (GDPR, (EU) 2016/679):**

> Vi ska behandla personuppgifter lagligt, korrekt och oppet. Vi behover ha en rattslig grund for varje behandling, informera de registrerade om hur deras uppgifter anvands, och vidta lampliga tekniska och organisatoriska atgarder for att skydda uppgifterna. Personuppgiftsincidenter ska rapporteras till IMY inom 72 timmar.

**Example 3 -- Technical provision (Buller, AFS 2023:10):**

> Vi ska sakerstalla att ingen arbetstagare utsatts for bullerniva over gallande gransvarden. Det innebar att vi genomfor bullermatningar, riskbedomer resultaten och vidtar atgarder -- i forsta hand genom att minska bullret vid kallan. Om exponering overskrider de undre insatsvaerdena ska vi tillhandahalla horselskydd och erbjuda horselundersokning.

**Example 4 -- Environmental framework (Miljobalken, SFS 1998:808):**

> Vi ska tillaampa miljobalkens grundprinciper i all var verksamhet. Det innebar att vi behover ha tillracklig kunskap om hur vara aktiviteter paverkar miljon, anvanda basta tillgangliga teknik dar det ar relevant, valja minst skadliga kemiska produkter vid inkop, och hushalla med ravaaror och energi. Den som orsakar en miljoskada ar ansvarig for att avhjalpa den.

**Example 5 -- Building regulation (Plan- och bygglag, SFS 2010:900):**

> Vi behover bygglov for nybyggnad, tillbyggnad och vasentlig andring av byggnader. Innan vi borjar bygga kravs startbesked fran kommunens byggnadsnaamnd, och nar bygget ar klart ska vi fa slutbesked. Vi ar skyldiga att folja den kontrollplan som faststallts och se till att byggnationen uppfyller de tekniska egenskapskraven i Boverkets foreskrifter.

**Example 6 -- Food safety (EU-forordning om allmanna livsmedelsprinciper, (EG) 178/2002):**

> Vi ska sakerstalla att alla livsmedel vi slapper ut paa marknaden ar sakra for konsumenter. Vi ar skyldiga att kunna sparaa alla livsmedel ett steg bakaat och ett steg framaat i leveranskedjan. Om vi misstanker att ett livsmedel kan vara halsofarligt ska vi omedelbart paaborja en aaterkallelse och underratta kontrollmyndigheten.

**Example 7 -- Healthcare (Halso- och sjukvaardslag, SFS 2017:30):**

> Vi ska erbjuda halso- och sjukvaard av god kvalitet paa lika villkor for hela befolkningen. Vaarden ska bygga paa respekt for patientens sjalvbestammande och integritet. Vi behover organisera vaarden sa att den ar tillganglig, samordnad med andra vaardgivare, och i enlighet med vetenskap och beprovad erfarenhet.

**Example 8 -- Information security (NIS-lagen, SFS 2018:1174):**

> Vi ska vidta tekniska och organisatoriska atgarder for att sakerstalla informationssakerheten i vara samhallsviktiga eller digitala tjanster. Allvarliga incidenter ska rapporteras utan drojsmaal till tillsynsmyndigheten. Vi behover arbeta systematiskt och riskbaserat med informationssakerhet och genomfora regelbundna utvaerderingar av vara skyddsatgarder.

**Example 9 -- Fire safety (Lag om brandfarliga och explosiva varor, SFS 2010:1011):**

> Vi ska vidta nodvandiga forsiktighetsmatt vid hantering och forvaring av brandfarliga och explosiva varor. Om vi forvarar brandfarliga vatskor eller gaser over vissa mangdgranser behover vi tillstaand fran kommunen. Vi ar skyldiga att utse en forestaandare med kompetens inom omraadet och se till att personalen har tillracklig utbildning.

**Example 10 -- Discrimination law (Diskrimineringslag, SFS 2008:567):**

> Vi ska sakerstalla att ingen arbetstagare, arbetssokande eller inhyrd personal diskrimineras paa grund av kon, aalder, funktionsnedsattning, etnisk tillhorighet, religion, sexuell laggning eller konsoverskridande identitet. Vi behover bedriva ett aktivt forebyggande arbete mot diskriminering och trakasserier, inklusive aarlig lonekartlaggning. Dokumenterade aatgardsplaner kravs for arbetsgivare med 25 eller fler anstallda.

---

## 6. Expert Commentary Writing Patterns

Expert commentary is the second content layer in a law list entry. While compliance summaries answer "what must we do?", expert commentary answers "what does this law cover, who does it apply to, what are the key requirements, and what has changed recently?"

### 6.1 Structure

Every expert commentary follows a four-part structure:

1. **What the law covers** (1--2 sentences): Scope and purpose of the provision.
2. **Who it applies to** (1 sentence): Target audience -- which organizations or roles are affected.
3. **Key requirements** (2--4 sentences): The most important operative provisions.
4. **Recent changes** (1--2 sentences, if applicable): Amendments, consolidations, or upcoming transitions.

### 6.2 Original expert commentary examples

**Example 1 -- AFS 2023:1 (Systematiskt arbetsmiljoarbete):**

> (1) Denna foreskrift reglerar hur arbetsgivare ska bedriva ett loopande, strukturerat arbetsmiljoarbete i sin verksamhet. (2) Den galler alla arbetsgivare i Sverige oavsett bransch och storlek -- fran ensamforetag till storforetag. (3) Arbetsgivaren ska ha en skriftlig arbetsmiljopolicy (krav fran 10 anstallda), genomfora regelbundna riskbedomningar, dokumentera handlingsplaner, utreda tillbud och olyckor, samt folja upp arbetsmiljoarbetet arligen paa ledningsniva. Uppgiftsfordelningen till chefer och arbetsledare ska vara skriftlig och tydlig. (4) AFS 2023:1 ersatter AFS 2001:1 och tradde i kraft den 1 januari 2025 som del av Arbetsmiljoverkets stora regelkonsolidering.

**Example 2 -- (EU) 2016/679 (GDPR):**

> (1) Dataskyddsforordningen ar EU:s ramverk for skydd av fysiska personers personuppgifter vid all typ av behandling -- automatiserad och manuell. (2) Den galler alla organisationer som behandlar personuppgifter om personer i EU/EES, oavsett var organisationen ar etablerad. (3) Centrala krav omfattar rattslig grund for behandling (samtycke, avtal, rattslig skyldighet m.fl.), informationsplikt, rattigheter for registrerade (tillgang, rattelse, radering), konsekvensbedoming vid hog risk, och utnamnande av dataskyddsombud for offentliga organ och vissa privata verksamheter. Administrativa sanktionsavgifter kan uppga till 20 miljoner euro eller 4 procent av global omsattning. (4) Sverige kompletterar forordningen med Lag (2018:218) och Forordning (2018:219).

**Example 3 -- SFS 2020:614 (Avfallsforordning):**

> (1) Avfallsforordningen reglerar hantering, klassificering, transport och bortskaffande av avfall i Sverige. (2) Den galler alla som producerar, transporterar eller behandlar avfall -- fran hushall till industri. (3) Avfall ska klassificeras med tvastaelliga avfallskoder, farligt avfall ska separeras och rapporteras till Naturvaardsverkets avfallsregister inom tva arbetsdagar fran overlaamnande, och bygg- och rivningsavfall ska sorteras i minst sex fraktioner. Forordningen implementerar EU:s avfallsdirektiv och avfallshierarkin (forebygga, atervanda, materialatervinna, energiutvinna, bortskaffa). (4) Forordningen har andrats flertalet ganger, senast genom SFS 2025:824.

**Example 4 -- SFS 2018:585 (Sakerhetsskyddslag):**

> (1) Sakerhetsskyddslagen styr skyddet av information och verksamheter som ar av betydelse for Sveriges sakerhet. (2) Den galler bade offentliga myndigheter och privata verksamhetsutovare som bedriver sakerhetskanslig verksamhet. (3) Verksamhetsutovaren ska genomfora sakerhetsskyddsanalyser, uppraatta sakerhetsskyddsplaner, sakerhetsprova personal i sakerhetskansliga befattningar, och inga sakerhetsskyddsavtal nar upphandlingar eller samarbeten kan ge tillgang till sakerhetsskyddsklassificerad information. (4) Lagen har skarpts vasentligt sedan 2021 med utokade krav paa verksamhetsutovare utanfor offentlig sektor, sarskilt vid utlandska direktinvesteringar.

---

## 7. Subset Construction Patterns

Several laglig.se law lists exist as subsets (varianter) of larger parent lists. The most common variant is the **tjanstefoeretag** (service-company) edition, which removes provisions irrelevant to office-based employers.

### 7.1 What a subset is

A subset is a reduced version of a parent list that serves a narrower audience. It shares the same domain but removes documents that do not apply to the target audience. It may also:

- Remove entire sections that are irrelevant
- Reduce documents within retained sections
- Renumber sections to fill gaps
- Promote documents from the parent's "Other" section to more prominent positions

### 7.2 Rules for determining service-company relevance

A document is **relevant** to a service company if it creates obligations for organizations that:

- Operate from office premises
- Employ knowledge workers (IT, consulting, finance, education, marketing)
- Do not manufacture, construct, transport, or handle heavy equipment
- May employ customer-facing staff (retail, call-centre, social work)

A document is **not relevant** to a service company if it primarily regulates:

- Industrial manufacturing processes
- Construction-site activities
- Heavy machinery or lifting equipment
- Dangerous-goods transport
- Advanced chemical handling (asbestos, welding, radiation)
- Agricultural or food production
- Seveso-level major-accident prevention

### 7.3 Section filtering decisions

| Decision                 | Rule                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------ |
| Keep section entirely    | If ALL documents in the section apply to service companies                           |
| Drop section entirely    | If NONE of the documents in the section apply to service companies                   |
| Reduce section           | If SOME documents apply -- keep the relevant ones, drop the rest                     |
| Merge remaining sections | If a section drops below 3 documents, consider merging it with an adjacent section   |
| Renumber sections        | Fill any gaps created by dropped sections so the final list has continuous numbering |

### 7.4 Worked example: Arbetsmiljo (112 docs) to Arbetsmiljo for tjanstefoeretag (55 docs)

| Parent Section                        | Parent Doc Count | Subset Decision | Subset Doc Count | Rationale                                                                          |
| ------------------------------------- | ---------------- | --------------- | ---------------- | ---------------------------------------------------------------------------------- |
| 01 Grundlaggande regelverk            | 7                | Reduced         | 6                | AFS 2023:15 (medical controls) dropped -- tied to physical-exposure risks          |
| 02 Arbetsratt och personalforvaltning | 20               | Kept + expanded | 21               | Utstationeringslagen added; all employment law relevant                            |
| 03 Arbetsplatsens utformning          | 10               | Kept            | 10               | Includes ergonomics, lone work, psychosocial -- all relevant to offices            |
| 04 Fysisk belastning                  | 5                | Dropped         | 0                | Noise, vibration, heavy lifting not applicable to offices                          |
| 05 Maskiner och utrustning            | 8                | Reduced         | 5                | Only display screens and ladders retained; industrial machinery dropped            |
| 06 Brand och explosion                | 9                | Reduced         | 6                | Core fire/explosion safety kept; pressurized equipment dropped                     |
| 07 Elsakerhet                         | 6                | Reduced         | 3                | Framework law and inspection duties kept; detailed installation provisions dropped |
| 08 Kemiska risker                     | 4                | Kept            | 4                | REACH, CLP, chemical risk sources -- even offices use cleaning agents              |
| 09 Kompletterande                     | 43               | Dropped         | 0                | Radiation, Seveso, asbestos, transport, construction -- none applicable            |

**Key principle:** The subset preserves ALL universal employer obligations (SAM, OSA, GDPR, discrimination, fire safety, basic electrical safety, basic chemical safety) while removing industry-specific technical provisions.

### 7.5 Promotion pattern

Some documents that sit in the parent's "Other" section may be promoted to a prominent position in the subset. Example: in the Miljo tjanstefoeretag list, the EU Taxonomy regulation and Arsredovisningslagen were promoted from the parent's Section 09 to Section 01 (index 0120 and 0130), because sustainability reporting is a core obligation for service companies even though it is secondary for industrial operators.

---

## 8. Quality Checklist for New Law Lists

Run this checklist before publishing any new law list. Every item must pass.

### 8.1 Structural integrity

- [ ] Every document has an official SFS/reference number
- [ ] Every document has its full official statute title
- [ ] Every document is assigned to exactly one section (no duplicates, no orphans)
- [ ] Index numbers follow the SSDD scheme with increments of 10
- [ ] No duplicate index numbers (except for intentional product/user provision pairs)
- [ ] Section numbers are sequential with no gaps (01, 02, 03, ..., not 01, 03, 05)
- [ ] Section count is between 6 and 10 (inclusive)
- [ ] No section has fewer than 3 documents
- [ ] The "Other" / "Kompletterande" section contains no more than 30% of total documents
- [ ] The first section covers framework/general rules
- [ ] If an "Other" section exists, it is the last section

### 8.2 Naming and language

- [ ] All section names are original laglig.se names (not copied from source)
- [ ] All section names are in Swedish
- [ ] No section name exceeds 8 words
- [ ] No two sections share the same name (within the list or across lists without a qualifier)

### 8.3 Content completeness

- [ ] Every document has a compliance summary written in laglig.se voice
- [ ] Every compliance summary starts with "Vi ska...", "Vi behover...", or equivalent obligation-focused phrasing
- [ ] Every compliance summary is 2--4 sentences
- [ ] Every document has expert commentary covering scope, applicability, key requirements
- [ ] Expert commentary mentions recent amendments where applicable
- [ ] Amendment dates are tracked (lastAmendment field populated where known)

### 8.4 Legal accuracy

- [ ] EU regulations are included where directly applicable in the domain
- [ ] For each lag, the corresponding forordning is also included (if one exists)
- [ ] The AFS 2023 consolidation is reflected: new AFS numbers used with "ersatter" notation
- [ ] No provisions that have been repealed or superseded remain in the list without annotation
- [ ] Regulatory-body coverage is complete for the domain (all relevant agencies represented)

### 8.5 Cross-referencing

- [ ] Cross-references to related lists are documented for every shared document
- [ ] Subset relationship (parent/child) is documented in list metadata
- [ ] Documents that appear in other lists have consistent sfsNumber and documentName across lists
- [ ] If the list has a tjanstefoeretag variant, the isServiceCompanyRelevant flag is set for every document

### 8.6 Consistency

- [ ] The list overview matches the actual document count and section count
- [ ] Target audience description is specific and accurate
- [ ] Primary regulatory bodies listed in metadata match the actual content
- [ ] All dates are in ISO 8601 format (YYYY-MM-DD)
- [ ] All SFS references follow the pattern "SFS YYYY:NNN" or "(EU) nr NNN/YYYY"

---

## 9. Regulatory Body Reference

Quick reference for all known regulatory prefixes encountered in laglig.se law lists. This table is organized alphabetically by prefix.

| #   | Prefix      | Full Name                                              | Domain                                                                | Typical List Presence                           |
| --- | ----------- | ------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | AFS         | Arbetsmiljoverkets forfattningssamling                 | Workplace safety, health, equipment, chemicals, construction          | Arbetsmiljo, Arb. tj., Miljo Sverige, Fastighet |
| 2   | BFS         | Boverkets forfattningssamling                          | Building codes, housing, energy, ventilation, accessibility           | Fastighet-Bygg, Miljo, Miljo tj.                |
| 3   | ELSAK-FS    | Elsakerhetsverkets forfattningssamling                 | Electrical installations, inspection, safety                          | Arbetsmiljo, Arb. tj., Fastighet                |
| 4   | (EU) / (EG) | EU Official Journal                                    | All domains with EU regulation                                        | All lists except Fastighet-Bygg                 |
| 5   | FFFS        | Finansinspektionens forfattningssamling                | Financial services, information security                              | Informationssakerhet                            |
| 6   | FKFS        | Forsakringskassans forfattningssamling                 | Social insurance, sick pay                                            | Miljo Sverige                                   |
| 7   | HSLF-FS     | Gemensam forfattningssamling (halsa m.fl.)             | Healthcare, social services, pharmaceuticals, public health           | Halsa och sjukvaard, Fastighet (legionella)     |
| 8   | HVMFS       | Havs- och vattenmyndighetens forfattningssamling       | Marine environment, water management, fisheries                       | Livsmedel                                       |
| 9   | IMYFS       | Integritetsskyddsmyndighetens forfattningssamling      | Data protection                                                       | Informationssakerhet                            |
| 10  | KIFS        | Kemikalieinspektionens forfattningssamling             | Chemical products, biotic organisms, pesticides                       | Arbetsmiljo, Miljo, Miljo tj.                   |
| 11  | LIVSFS      | Livsmedelsverkets forfattningssamling                  | Food safety, hygiene, labeling, contaminants                          | Livsmedel                                       |
| 12  | LMFS        | Lantmateriets forfattningssamling                      | Real property formation, surveying, geographic data                   | Fastighet-Bygg                                  |
| 13  | MIGRFS      | Migrationsverkets forfattningssamling                  | Work permits, immigration                                             | Miljo Sverige                                   |
| 14  | MSBFS       | MSB:s forfattningssamling                              | Fire/explosion safety, dangerous goods, IT security, civil protection | Arbetsmiljo, Miljo, Info.sak., Fastighet        |
| 15  | NFS         | Naturvardsverkets forfattningssamling                  | Environmental protection, waste, emissions, pesticides                | Miljo, Miljo tj., Fastighet                     |
| 16  | PMFS        | Sakerhetspolisens forfattningssamling                  | Security protection, national security                                | Informationssakerhet                            |
| 17  | PTSFS       | Post- och telestyrelsens forfattningssamling           | Telecom, electronic communications                                    | Informationssakerhet                            |
| 18  | SCB-FS      | SCB:s forfattningssamling                              | Statistical reporting                                                 | Miljo, Fastighet                                |
| 19  | SFS         | Svensk forfattningssamling                             | All Swedish law (lagar and forordningar)                              | All lists                                       |
| 20  | SJVFS       | Jordbruksverkets forfattningssamling                   | Agriculture, veterinary, food-chain primary production                | Livsmedel                                       |
| 21  | SKVFS       | Skatteverkets forfattningssamling                      | Tax compliance, personnel registers                                   | Arbetsmiljo, Miljo Sverige, Livsmedel           |
| 22  | SLVFS       | Livsmedelsverkets forfattningssamling (legacy)         | Food safety (older provisions still in force)                         | Livsmedel                                       |
| 23  | SOSFS       | Socialstyrelsens forfattningssamling (legacy)          | Healthcare, social care (older provisions still in force)             | Halsa och sjukvaard                             |
| 24  | SRVFS       | Raddningsverkets forfattningssamling (legacy, now MSB) | Fire safety, systematic fire-safety work                              | Arbetsmiljo, Miljo, Miljo tj., Fastighet        |
| 25  | SSMFS       | Stralsakerhetsmyndighetens forfattningssamling         | Radiation safety, medical radiation                                   | Halsa och sjukvaard, Miljo                      |
| 26  | STAFS       | Swedacs forfattningssamling                            | Accreditation, CE-marking                                             | Miljo                                           |
| 27  | STEMFS      | Energimyndighetens forfattningssamling                 | Energy, energy efficiency                                             | Informationssakerhet, Fastighet                 |
| 28  | SvKFS       | Svenska kraftnats forfattningssamling                  | Electricity grid, electricity preparedness                            | Informationssakerhet                            |
| 29  | TSFS        | Transportstyrelsens forfattningssamling                | Transport safety, vehicle regulations, crypto keys                    | Miljo Sverige, Informationssakerhet, Fastighet  |
| 30  | OVRM        | Branchorganisationers riktlinjer (diverse)             | Industry guidelines, self-monitoring programs                         | Livsmedel                                       |

---

## 10. Common Patterns and Anti-Patterns

### 10.1 DO (patterns to follow)

| #   | Pattern                                                       | Explanation                                                                                                                                                                                            |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Group by subject matter, not by regulatory body**           | A section named "Arbetsmiljoverkets regler" is wrong. A section named "Kemiska risker och farliga amnen" is right -- even though it contains documents from AFS, KIFS, and EU.                         |
| 2   | **Include both the lag and its forordning together**          | Lag (2006:263) om transport av farligt gods and Forordning (2006:311) om transport av farligt gods belong in the same section, adjacent by index number.                                               |
| 3   | **Use the "ersatter" notation for AFS 2023 consolidation**    | Write "AFS 2023:10 (ersatter AFS 2005:16)" so users can find provisions using either old or new references.                                                                                            |
| 4   | **Place EU regulations in subject-matter sections**           | GDPR goes in the data-protection or HR section, not in a separate "EU" section. REACH goes in the chemical-safety section.                                                                             |
| 5   | **Split oversized "Other" sections**                          | If "Kompletterande bestammelser" exceeds 30% of the list, analyze the documents and create new thematic sections.                                                                                      |
| 6   | **Include paired product/user provisions**                    | When Arbetsmiljoverket issues both product requirements (e.g., AFS 2023:9) and usage requirements (e.g., AFS 2023:11) for the same equipment, include both and optionally share the same index number. |
| 7   | **Track cross-list overlaps**                                 | Every document that appears in another laglig.se list should have its crossListReferences field populated. This enables deduplication for customers subscribing to multiple lists.                     |
| 8   | **Follow the normative pyramid within each section**          | Order documents within a section by hierarchy: lag first, forordning second, foreskrift third, EU regulation contextually, allmanna rad last.                                                          |
| 9   | **Write compliance summaries in present tense, active voice** | "Vi ska genomfora riskbedomningar" -- not "Riskbedomningar bor genomforas" or "Riskbedomningar ska ha genomforts."                                                                                     |
| 10  | **Name sections in Swedish using our own words**              | Never copy the source's exact section name. Always rewrite it in laglig.se's style.                                                                                                                    |
| 11  | **Include amendment references**                              | If a statute has been amended, record the most recent amendment SFS number. This helps users verify they are reading the current version.                                                              |
| 12  | **Document the filtering logic for subsets**                  | When creating a tjanstefoeretag variant, record which parent sections were kept, dropped, or reduced, and why.                                                                                         |

### 10.2 DON'T (anti-patterns to avoid)

| #   | Anti-Pattern                                                   | Why It Is Wrong                                                                                                                                                               |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Create sections with fewer than 3 documents**                | Orphan sections fragment the user experience. Merge small sections with thematically adjacent ones.                                                                           |
| 2   | **Put more than 30% of documents in "Other"**                  | A bloated "Other" section means the classification scheme is incomplete. Analyze and split.                                                                                   |
| 3   | **Name sections after regulatory bodies**                      | "MSB:s regler" or "Boverkets foreskrifter" does not tell the user what compliance area is covered. Name by subject matter.                                                    |
| 4   | **Copy descriptive text from any external source**             | All compliance summaries, expert commentaries, and section descriptions must be original laglig.se content. Reference laws by official SFS/EU numbers and titles only.        |
| 5   | **Leave documents unindexed**                                  | Every document in a laglig.se list must have a four-digit SSDD index number. No exceptions.                                                                                   |
| 6   | **Separate a lag from its forordning into different sections** | They implement the same regulatory obligation and must appear together for the user to understand the full requirement.                                                       |
| 7   | **Create a separate "EU" section**                             | EU regulations address specific subject matters. Place them in the subject-matter section alongside their Swedish counterparts.                                               |
| 8   | **Use English section names**                                  | All section names must be in Swedish. Internal metadata fields may be in English, but user-facing names are Swedish.                                                          |
| 9   | **Include repealed provisions without annotation**             | If a provision has been superseded, either remove it or clearly mark it as "ersatt av [new reference]" with an effective date.                                                |
| 10  | **Use passive voice in compliance summaries**                  | "Det ska sakerstallas att..." is weaker than "Vi ska sakerstalla att...". Active voice creates clearer accountability.                                                        |
| 11  | **Assign a document to multiple sections**                     | Every document belongs to exactly one section. If it is relevant to multiple topics, place it in the primary section and add a cross-reference note to the expert commentary. |
| 12  | **Ignore the AFS 2023 consolidation**                          | Many old AFS numbers were replaced effective January 2025. Always use the new number with the "ersatter" notation. Users searching for old numbers need the mapping.          |
| 13  | **Omit thresholds and employee-count triggers**                | Many Swedish laws have triggers at 5, 10, 25, or 50 employees. These are critical compliance triggers and must be mentioned in the summary.                                   |
| 14  | **Write summaries longer than 5 sentences**                    | Compliance summaries are orientation texts, not legal analyses. Keep them concise. For detail, use the expert commentary field.                                               |

---

## 11. Cross-List Overlap Management

### 11.1 Documents that appear in many lists

Several "horizontal" laws appear across multiple laglig.se lists because they apply to all employers regardless of domain:

| Document                                  | Typical Lists                                          | Treatment                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| (EU) 2016/679 (GDPR)                      | Arbetsmiljo, Arb. tj., Miljo Sverige, Info.sak., Halsa | Compliance summary and commentary should be identical across lists; section placement varies by list domain |
| SFS 2008:567 (Diskrimineringslag)         | Arbetsmiljo, Arb. tj., Miljo Sverige, Halsa            | Same approach as GDPR                                                                                       |
| SFS 2021:890 (Visselblasarlagen)          | Arbetsmiljo, Arb. tj., Miljo Sverige, Fastighet, Halsa | Same approach                                                                                               |
| SFS 2003:778 (Lag om skydd mot olyckor)   | Arbetsmiljo, Miljo, Miljo tj., Fastighet               | Fire-safety sections across lists                                                                           |
| SFS 2010:1011 (Lag om brandfarliga varor) | Arbetsmiljo, Miljo, Miljo tj.                          | Fire/explosion sections                                                                                     |
| (EG) nr 1907/2006 (REACH)                 | Arbetsmiljo, Arb. tj., Miljo, Miljo tj.                | Chemical-safety sections                                                                                    |
| (EG) nr 1272/2008 (CLP)                   | Arbetsmiljo, Arb. tj., Miljo, Miljo tj.                | Chemical-safety sections                                                                                    |
| SKVFS 2015:6 (Personalliggare)            | Arbetsmiljo, Miljo Sverige, Livsmedel                  | Cross-domain tax-compliance obligation                                                                      |

### 11.2 Consistency rule

When a document appears in multiple lists, its **sfsNumber** and **documentName** fields must be identical across all lists. Compliance summaries and expert commentaries should be substantively identical, though minor adjustments for domain context are acceptable (e.g., REACH commentary in an environmental list may emphasize environmental release, while in a workplace list it may emphasize worker exposure).

---

## 12. AFS 2023 Consolidation Reference

Arbetsmiljoverket consolidated its entire provision portfolio into a new series effective 1 January 2025. Agents must understand this mapping because many users still reference old AFS numbers.

### 12.1 Main consolidation containers

| New AFS     | Content                                                                                                                                                                     | Key Old AFS Replaced                                                                                                                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AFS 2023:1  | Systematiskt arbetsmiljoarbete (SAM)                                                                                                                                        | AFS 2001:1                                                                                                                                                                                                      |
| AFS 2023:2  | Multiple chapters: OSA, lone work, youth labor, pregnancy, first aid, violence, overtime records, work adaptation                                                           | AFS 2015:4, AFS 1982:3, AFS 2012:3, AFS 2007:5, AFS 1999:7, AFS 1993:2, AFS 1982:17, AFS 2020:5                                                                                                                 |
| AFS 2023:3  | Construction safety (Bas-P/Bas-U) and building/construction work                                                                                                            | AFS 1999:3                                                                                                                                                                                                      |
| AFS 2023:4  | Machinery                                                                                                                                                                   | AFS 2008:3                                                                                                                                                                                                      |
| AFS 2023:5  | Pressure-bearing equipment (products)                                                                                                                                       | (various)                                                                                                                                                                                                       |
| AFS 2023:9  | Product requirements: ladders, scaffolding, pressurized devices                                                                                                             | AFS 2004:3 (product side)                                                                                                                                                                                       |
| AFS 2023:10 | Physical/chemical/biological hazards: ergonomics, noise, vibration, chemicals, radiation, infection, quartz, asbestos-adjacent, gases, explosion, welding, synthetic fibers | AFS 2012:2, AFS 2005:16, AFS 2005:15, AFS 2011:19, AFS 2016:3, AFS 2018:4, AFS 2018:1, AFS 2015:2, AFS 2009:7, AFS 2004:1, AFS 2003:3, AFS 1998:6, AFS 1997:7, AFS 1992:9, AFS 1988:4, AFS 1981:14, AFS 1981:15 |
| AFS 2023:11 | Work equipment and PPE: trucks, lifting, scaffolding, chainsaws, presses, display screens                                                                                   | AFS 2006:4, AFS 1998:5 (user side), AFS 2006:5, AFS 2004:3 (user side), AFS 2013:4, AFS 2012:1, AFS 2006:7, AFS 2006:6, AFS 2003:6, AFS 1999:8, AFS 2001:3                                                      |
| AFS 2023:12 | Workplace design: layout, climate, lighting, display-screen illumination                                                                                                    | AFS 2020:1, AFS 1998:5 (lighting)                                                                                                                                                                               |
| AFS 2023:13 | Risks in specific work types: construction, asbestos                                                                                                                        | AFS 2006:1                                                                                                                                                                                                      |
| AFS 2023:14 | Air-quality limit values (gransvarden for luftvagsexponering)                                                                                                               | AFS 2018:1                                                                                                                                                                                                      |
| AFS 2023:15 | Medical examinations in working life                                                                                                                                        | AFS 2019:3                                                                                                                                                                                                      |

### 12.2 Agent behavior for AFS references

When a user queries an old AFS number (e.g., "AFS 2001:1"), the agent should:

1. Identify the corresponding new AFS number (AFS 2023:1)
2. Present the current provision under its new designation
3. Include the "ersatter" notation to confirm the mapping
4. Note the effective date (1 January 2025)

---

## 13. Naming Confusion Alerts

Several lists have names that do not match their content. Agents must be trained to route queries correctly.

| Source Name                 | Actual Content                                                           | laglig.se Recommended Name              | Routing Rule                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| "Miljo Sverige"             | Workplace and HR law -- NOT environmental law                            | "Arbetsratt och personal -- grundpaket" | Queries about "anstallning", "personal", "HR", "arbetsratt" -> this list. Queries about "miljo", "avfall", "kemikalier" -> Miljo list instead. |
| "Miljo for tjanstefoeretag" | Environmental law for service companies (correct)                        | "Miljoregler for tjansteforetag"        | Queries from service companies about environmental compliance -> this list                                                                     |
| "Fastighet-Bygg"            | Property law, building regulation, and construction (correct, but broad) | "Fastighet och byggande"                | Contains both property-law fundamentals and construction-specific regulation                                                                   |

---

## 14. Domain-Specific Agent Routing

When a user's query indicates a specific industry or role, agents should present lists in priority order:

### 14.1 Service-company employer (IT, consulting, finance)

1. Arbetsmiljo for tjanstefoeretag (workplace safety, HR)
2. Miljo for tjanstefoeretag (environmental basics)
3. Informationssakerhet Sverige (if handling data or operating digital services)
4. Miljo Sverige / Arbetsratt och personal (extended HR/workplace package)

### 14.2 Manufacturing employer

1. Arbetsmiljo (full workplace safety)
2. Miljo (full environmental)
3. Relevant sector-specific list (Livsmedel for food manufacturing, etc.)

### 14.3 Property owner / facility manager

1. Fastighet och byggande
2. Arbetsmiljo (for tenant employer obligations)
3. Miljo (for environmental obligations on property operations)

### 14.4 Healthcare provider

1. Halsa och sjukvaard
2. Arbetsmiljo (healthcare is a high-risk work environment)
3. Informationssakerhet Sverige (patient data, GDPR)

### 14.5 Food business operator

1. Livsmedel Sverige
2. Arbetsmiljo (or Arb. tj. for restaurant/office operations)
3. Miljo (if generating industrial waste or handling chemicals)

---

## 15. Worked Example: Building a New Law List

This section walks through a hypothetical example of building a new list for the **transport and logistics** sector, to demonstrate the full process.

### Step 1: Define domain and audience

> **Scope:** Swedish employers in the transport and logistics sector -- freight carriers, passenger transport operators, warehousing companies, and logistics service providers. Covers road, rail, sea, and air transport regulatory obligations relevant to the employer. Excludes purely vehicle-technical regulation (road-worthiness testing, type approval) that applies to manufacturers rather than operators.

### Step 2: Inventory applicable statutes

Search riksdagen.se, lagrummet.se, and EUR-Lex for statutes containing "transport", "vagtransport", "jarnvag", "farligt gods", "kor- och vilotider", "fardskrivare", "cabotage", etc. Cross-reference the Arbetsmiljo list (Section 09 transport cluster) and the Miljo list (Section 06 transport of dangerous goods) for known instruments.

### Step 3: Classify by subject matter

Draft sections:

1. Framework transport legislation
2. Driving and rest time rules
3. Transport of dangerous goods
4. Posted transport workers
5. Workplace safety for transport workers
6. Environmental obligations for transport operators
7. Specialized vehicle and freight requirements

### Step 4: Name the sections (in Swedish)

1. Grundlaggande transportlagstiftning
2. Kor- och vilotider samt fardskrivare
3. Transport av farligt gods
4. Utstationering och cabotage
5. Arbetsmiljo for transportarbetare
6. Miljoansvar for transportforetag
7. Fordon, last och sarskilda transportkrav

### Step 5: Assign index numbers

Section 01: 0100, 0110, 0120, ...
Section 02: 0200, 0210, 0220, ...
(and so on)

### Step 6: Write compliance summaries

Follow the voice pattern: "Vi ska sakerstalla att vara forare foljer gallande kor- och vilotidsregler. Det innebar att vi behover utrusta fordon med fardskrivare, instruera forare om korrekt anvandning, och kontrollera fardskrivardata regelbundet."

### Step 7: Validate against checklist

Run Section 8 quality checklist. Verify all items pass.

---

## 16. Version History and Maintenance

This guide should be updated when:

- A new law list is added to the laglig.se platform
- A major regulatory consolidation occurs (like the AFS 2023 series)
- New EU regulations enter force that affect multiple lists
- Quality issues are identified in agent-generated law lists
- New anti-patterns are discovered

| Version | Date       | Changes                                                    |
| ------- | ---------- | ---------------------------------------------------------- |
| 1.0     | 2026-02-05 | Initial version based on analysis of 9 reference law lists |

---

_This document is original laglig.se content. All section names, compliance summaries, expert commentaries, and classification examples are laglig.se originals. Laws are referenced exclusively by their official SFS, AFS, EU, or other authority-issued designations and official statute titles, which are public domain._
