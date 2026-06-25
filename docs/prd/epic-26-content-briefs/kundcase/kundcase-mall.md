# Innehallsbrief — Kundcase (mall/brief)

- **Route:** /kundcase/kundcase-mall
- **Cluster / template:** kundcase / CaseStudyTemplate
- **Sokintention:** commercial (proof)
- **Ordmal:** ~800

> ATERANVANDBAR MALL — INTE en publicerbar sida. Detta brief beskriver strukturen, faltmappningen och redaktionsreglerna for varje framtida kundcase. Skribenten kopierar mallen, fyller placeholderfalten med VERIFIERAT kundmaterial och publicerar pa /kundcase/{kund-slug}. INGA kunder, citat eller siffror far hittas pa. Almasa ar uttryckligen UNDANTAGEN och far aldrig anvandas som case, citat eller referens.

## Faltmodell (CaseStudyTemplate)

Varje case-instans kraver foljande verifierade falt innan publicering. Saknas ett falt: lamna det tomt eller utelat sektionen — fyll ALDRIG i med antaganden.

- `kund` — foretagsnamn (eller "[Anonymiserad kund, bransch X]" om kund vill vara anonym)
- `bransch` — koppla till en befintlig /branscher/-sida
- `storlek` — antal anstallda / antal arbetsstallen (valfritt)
- `roll` — titel pa den intervjuade (t.ex. miljochef, KMA-ansvarig, kvalitetschef)
- `utmaning` — lage fore Laglig (1-2 meningar, konkret problem)
- `losning` — vilka delar av Laglig som anvands (laglista, lagbevakning, kontroller, revisionsrapport, AI-agent)
- `resultat-metrik` — minst en kvantifierbar effekt (t.ex. timmar/ar sparade, tid till revision, antal lagkrav under bevakning) — MASTE komma fran kunden, ej uppskattad
- `citat` — ordagrant, godkant av kund, med namn + roll (eller anonymiserat med kundens samtycke)
- `publiceringssamtycke` — kryssruta/dokumenterat ja innan publicering

## Nyckelord

- **Primart:** kundcase lagefterlevnad
- **Sekundart:** referenscase laglista, kundexempel lagbevakning, sa anvander {bransch} Laglig
- **Long-tail:**
  - "exempel pa lagefterlevnadsarbete i praktiken"
  - "hur foretag haller koll pa lagandringar"
  - "kundcase laglista verktyg"
  - "sa sparar man tid pa lagbevakning"
  - "referens lagefterlevnadskontroll"
  - "case study compliance Sverige"
  - "erfarenheter av laglista-system"
  - "hur {bransch} jobbar med lagkrav"

## SEO-meta

> Per case-instans skrivs unik meta. Foljande ar MALLAR med placeholders — front-loada kundnamn + resultat.

- **Meta-titel (<=60 tecken):** {Kund}: {kort resultat} med Laglig.se
- **Meta-beskrivning (~155 tecken):** Sa gick {kund} fran {utmaning} till {resultat-metrik} med laglista och lagbevakning i Laglig.se. Las kundcaset och testa med ert organisationsnummer.
- **H1:** {Kund}: {konkret resultat} med Laglig.se

## Produktvinkel (hook)

> MALL: {Kund} ar ett {bransch}-foretag som behovde {utmaning}. Med Lagligs laglista, lagbevakning och revisionsrapport {konkret forandring} — har ar deras berattelse i siffror och egna ord. Hook:en ska binda caset till en konkret Laglig-funktion, inte vara generisk marknadsforing.

## Sidstruktur (H2/H3)

1. **MarketingHero** — H1 ({Kund}: resultat) + en mening om kund/bransch + nyckelmetrik som badge + OrgCheck
   - Eyebrow: "Kundcase · {Bransch}"
2. **ProofBlock — Resultat i korthet** (hogst upp som "stat strip")
   - H3: 2-3 verifierade nyckeltal (t.ex. timmar sparade/ar, lagkrav under bevakning, tid till revisionsklar)
   - Endast metrik kunden bekraftat; annars utelat sektionen
3. **DefinitionBox — Om {Kund}** (kort faktaruta)
   - H3: Bransch, storlek, ort, roll pa intervjuad
4. **H2 — Utmaningen (lage fore Laglig)**
   - H3: Vad var smartan? (manuella Excel-listor, missade lagandringar, stress infor revision)
   - Renderas som textblock; valfri SplitFeature om "fore"-bild finns
5. **SplitFeature — Losningen i Laglig** (skarmdump av kundens faktiska eller representativa vy)
   - H3: Vilka funktioner togs i bruk (laglista, lagbevakning, kontroller, revisionsrapport)
   - H3: Hur infordes det (onboarding, importerad laglista)
6. **FeatureGrid — Sa anvander {Kund} Laglig i vardagen**
   - H3: 3-4 anvandningsmonster (t.ex. veckovis lagbevakning, arlig kontrollcykel, ansvarsfordelning)
7. **Citatblock (i ProofBlock-varianten)** — ordagrant kundcitat med namn + roll + foto/avatar (med samtycke)
8. **OrgCheckCta** — mid-page: "Vill ni komma igang som {Kund}? Testa med ert organisationsnummer"
9. **CatalogLawList — Lagkrav som ar centrala for {Kund}s bransch** (lankar in i katalogen, hamtas fran branschsidan)
10. **ChangeFeedEmbed** (valfritt) — fardesh i kundens omrade for att visa varför bevakning behovs
11. **FaqAccordion**
12. **CtaBlock + RelatedPagesGrid**

## Kataloglankar (CatalogLawList)

> Per case valjs 6-12 lagar fran motsvarande /branscher/-sida (ateranvand den sidans lista). Generiska baslager som nastan alltid passar:

- Forordning om verksamhetsutovares egenkontroll (SFS 1998:901) — dokumenterad koll pa efterlevnad.
- Miljobalk (SFS 1998:808), 26 kap. — egenkontroll och tillsynsunderlag.
- Arbetsmiljolag (SFS 1977:1160) — grund for systematiskt arbetsmiljoarbete.
- Systematiskt arbetsmiljoarbete (AFS 2023:1) — kraver uppfoljning och dokumentation.
- Lag om skydd mot olyckor (SFS 2003:778) — systematiskt brandskyddsarbete.
- Dataskyddsforordningen GDPR (32016R0679) — efterlevnad som ofta efterfragas.
- {Branschspecifika krav — hamtas fran kundens branschsida, [bekrafta i katalogen]}

## FAQ (3-5)

- **Vilken bransch tillhor {Kund} och varfor ar caset relevant for oss?**
  - Beskriv bransch och storlek; peka pa likheter sa lasaren kanner igen sin egen situation. Lank till relevant /branscher/-sida.
- **Vilka funktioner i Laglig anvander {Kund}?**
  - Rakna upp de faktiskt anvanda delarna (laglista, lagbevakning, kontroller, revisionsrapport) med lankar till funktionssidorna.
- **Hur snabbt sag {Kund} resultat?**
  - Ange verifierad tidsram och metrik fran kunden; spekulera inte. Om okant, utelat fragan.
- **Kan vi fa samma resultat?**
  - Mjuk CTA: testa med organisationsnummer, starta provperiod. Var tydlig att resultat varierar per verksamhet.
- **Far jag kontakta {Kund} som referens?**
  - Endast om kunden gett samtycke; annars hanvisa till salj. Standard: nej utan dokumenterat ja.

## Interna lankar (relatedPages)

> Per case: lank till kundens branschsida + de funktionssidor caset namner + 1-2 syskon-case.

- /branscher/{kundens-bransch}
- /funktioner/revisionsrapport
- /funktioner/lagkatalog
- /kundcase/{annat-relevant-case}

## Bildmaterial

- **Skarmdumpar:** Kundens faktiska laglista/kontrollvy om samtycke finns (anonymisera kanslig data), annars en representativ Laglig-vy som speglar branschens lagkrav. Wrap i ScreenshotFrame.
- **Personbild (prompt):** "Photorealistic editorial photograph. A compliance manager reviewing a digital legal-requirements list on a laptop in a Swedish industrial office. Authentic Scandinavian workplace, natural daylight, warm neutral colour grading that sits on a cream/off-white palette, candid and unposed, soft shallow depth of field, documentary feel. Not glossy stock photography. No text, no logos, no watermarks. Realistic skin and hands."
  - Anvand riktigt kundfoto endast med uttryckligt samtycke; annars generisk branschbild enligt scaffolden ovan (variera roll/aktivitet/setting per bransch).

## Kallor (grundning)

- Kundens egna, godkanda uppgifter (intervju, e-post, signerat samtycke) — primarkalla for ALLA siffror och citat.
- Motsvarande /branscher/-sida for korrekta lagkrav och kataloglankar.
- Riksdagen.se / SFS for verifiering av lagnamn och nummer som namns.
- Laglig egen produkt for funktionsbeskrivningar (laglista, lagbevakning, kontroller, revisionsrapport).

## Anmarkningar

- KRITISK PRODUKTSANNING: Inga uppfunna kunder, citat eller siffror. Varje metrik och citat MASTE harstamma fran kund med dokumenterat publiceringssamtycke. Saknas verifiering: utelat faltet/sektionen.
- ALMASA AR UNDANTAGEN: anvand aldrig Almasa som case, kund, citat eller referens nagonstans.
- Anonymisering: om kund vill vara anonym, anvand "[Anonymiserad kund, {bransch}]" och utelat foto/namn i citat — men metriken maste anda vara verklig.
- Kannibalisering: kundcase ska INTE konkurrera med branschsidan om samma sokord. Branschsidan agar "lagar for {bransch}"; caset agar proof/erfarenhet ("sa anvander {kund}..."). Satt canonical pa caset till sig sjalvt.
- INGA pastaenden om SHA-256/kryptografisk signering for revisionsrapporten — den ar en avslutad kontrollcykel, signerad av ansvarig, exporterad som PDF.
- Denna sida (/kundcase/kundcase-mall) ar en intern mall och bor INTE indexeras (noindex) eller publiceras som ett riktigt case.
