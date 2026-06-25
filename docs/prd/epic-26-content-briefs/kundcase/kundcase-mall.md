# Innehållsbrief — Kundcase (mall/brief)

- **Route:** /kundcase/kundcase-mall
- **Cluster / template:** kundcase / CaseStudyTemplate
- **Sökintention:** commercial (proof)
- **Ordmål:** ~800

> ÅTERANVÄNDBAR MALL — INTE en publicerbar sida. Detta brief beskriver strukturen, fältmappningen och redaktionsreglerna för varje framtida kundcase. Skribenten kopierar mallen, fyller placeholderfälten med VERIFIERAT kundmaterial och publicerar på /kundcase/{kund-slug}. INGA kunder, citat eller siffror får hittas på. Almåsa är uttryckligen UNDANTAGEN och får aldrig användas som case, citat eller referens.

## Fältmodell (CaseStudyTemplate)

Varje case-instans kräver följande verifierade fält innan publicering. Saknas ett fält: lämna det tomt eller utelämna sektionen — fyll ALDRIG i med antaganden.

- `kund` — företagsnamn (eller "[Anonymiserad kund, bransch X]" om kund vill vara anonym)
- `bransch` — koppla till en befintlig /branscher/-sida
- `storlek` — antal anställda / antal arbetsställen (valfritt)
- `roll` — titel på den intervjuade (t.ex. miljöchef, KMA-ansvarig, kvalitetschef)
- `utmaning` — läge före Laglig (1-2 meningar, konkret problem)
- `losning` — vilka delar av Laglig som används (laglista, lagbevakning, kontroller, revisionsrapport, AI-agent)
- `resultat-metrik` — minst en kvantifierbar effekt (t.ex. timmar/år sparade, tid till revision, antal lagkrav under bevakning) — MÅSTE komma från kunden, ej uppskattad
- `citat` — ordagrant, godkänt av kund, med namn + roll (eller anonymiserat med kundens samtycke)
- `publiceringssamtycke` — kryssruta/dokumenterat ja innan publicering

## Nyckelord

- **Primärt:** kundcase lagefterlevnad
- **Sekundärt:** referenscase laglista, kundexempel lagbevakning, så använder {bransch} Laglig
- **Long-tail:**
  - "exempel på lagefterlevnadsarbete i praktiken"
  - "hur företag håller koll på lagändringar"
  - "kundcase laglista verktyg"
  - "så sparar man tid på lagbevakning"
  - "referens lagefterlevnadskontroll"
  - "case study compliance Sverige"
  - "erfarenheter av laglista-system"
  - "hur {bransch} jobbar med lagkrav"

## SEO-meta

> Per case-instans skrivs unik meta. Följande är MALLAR med placeholders — front-loada kundnamn + resultat.

- **Meta-titel (<=60 tecken):** {Kund}: {kort resultat} med Laglig.se
- **Meta-beskrivning (~155 tecken):** Så gick {kund} från {utmaning} till {resultat-metrik} med laglista och lagbevakning i Laglig.se. Läs kundcaset och testa med ert organisationsnummer.
- **H1:** {Kund}: {konkret resultat} med Laglig.se

## Produktvinkel (hook)

> MALL: {Kund} är ett {bransch}-företag som behövde {utmaning}. Med Lagligs laglista, lagbevakning och revisionsrapport {konkret forandring} — här är deras berättelse i siffror och egna ord. Hook:en ska binda caset till en konkret Laglig-funktion, inte vara generisk marknadsföring.

## Sidstruktur (H2/H3)

1. **MarketingHero** — H1 ({Kund}: resultat) + en mening om kund/bransch + nyckelmetrik som badge + OrgCheck
   - Eyebrow: "Kundcase · {Bransch}"
2. **ProofBlock — Resultat i korthet** (högst upp som "stat strip")
   - H3: 2-3 verifierade nyckeltal (t.ex. timmar sparade/år, lagkrav under bevakning, tid till revisionsklar)
   - Endast metrik kunden bekräftat; annars utelämna sektionen
3. **DefinitionBox — Om {Kund}** (kort faktaruta)
   - H3: Bransch, storlek, ort, roll på intervjuad
4. **H2 — Utmaningen (läge före Laglig)**
   - H3: Vad var smärtan? (manuella Excel-listor, missade lagändringar, stress inför revision)
   - Renderas som textblock; valfri SplitFeature om "före"-bild finns
5. **SplitFeature — Lösningen i Laglig** (skärmdump av kundens faktiska eller representativa vy)
   - H3: Vilka funktioner togs i bruk (laglista, lagbevakning, kontroller, revisionsrapport)
   - H3: Hur infördes det (onboarding, importerad laglista)
6. **FeatureGrid — Så använder {Kund} Laglig i vardagen**
   - H3: 3-4 användningsmönster (t.ex. veckovis lagbevakning, årlig kontrollcykel, ansvarsfördelning)
7. **Citatblock (i ProofBlock-varianten)** — ordagrant kundcitat med namn + roll + foto/avatar (med samtycke)
8. **OrgCheckCta** — mid-page: "Vill ni komma igång som {Kund}? Testa med ert organisationsnummer"
9. **CatalogLawList — Lagkrav som är centrala för {Kund}s bransch** (länkar in i katalogen, hämtas från branschsidan)
10. **ChangeFeedEmbed** (valfritt) — färskhet i kundens område för att visa varför bevakning behövs
11. **FaqAccordion**
12. **CtaBlock + RelatedPagesGrid**

## Kataloglänkar (CatalogLawList)

> Per case väljs 6-12 lagar från motsvarande /branscher/-sida (återanvänd den sidans lista). Generiska baslager som nästan alltid passar:

- Förordning om verksamhetsutövares egenkontroll (SFS 1998:901) — dokumenterad koll på efterlevnad.
- Miljöbalk (SFS 1998:808), 26 kap. — egenkontroll och tillsynsunderlag.
- Arbetsmiljölag (SFS 1977:1160) — grund för systematiskt arbetsmiljöarbete.
- Systematiskt arbetsmiljöarbete (AFS 2023:1) — kräver uppföljning och dokumentation.
- Lag om skydd mot olyckor (SFS 2003:778) — systematiskt brandskyddsarbete.
- Dataskyddsförordningen GDPR (32016R0679) — efterlevnad som ofta efterfrågas.
- {Branschspecifika krav — hämtas från kundens branschsida, [bekräfta i katalogen]}

## FAQ (3-5)

- **Vilken bransch tillhör {Kund} och varför är caset relevant för oss?**
  - Beskriv bransch och storlek; peka på likheter så läsaren känner igen sin egen situation. Länk till relevant /branscher/-sida.
- **Vilka funktioner i Laglig använder {Kund}?**
  - Räkna upp de faktiskt använda delarna (laglista, lagbevakning, kontroller, revisionsrapport) med länkar till funktionssidorna.
- **Hur snabbt såg {Kund} resultat?**
  - Ange verifierad tidsram och metrik från kunden; spekulera inte. Om okänt, utelämna frågan.
- **Kan vi få samma resultat?**
  - Mjuk CTA: testa med organisationsnummer, starta provperiod. Var tydlig att resultat varierar per verksamhet.
- **Får jag kontakta {Kund} som referens?**
  - Endast om kunden gett samtycke; annars hänvisa till sälj. Standard: nej utan dokumenterat ja.

## Interna länkar (relatedPages)

> Per case: länk till kundens branschsida + de funktionssidor caset nämner + 1-2 syskon-case.

- /branscher/{kundens-bransch}
- /funktioner/revisionsrapport
- /funktioner/lagkatalog
- /kundcase/{annat-relevant-case}

## Bildmaterial

- **Skärmdumpar:** Kundens faktiska laglista/kontrollvy om samtycke finns (anonymisera känslig data), annars en representativ Laglig-vy som speglar branschens lagkrav. Wrap i ScreenshotFrame.
- **Personbild (prompt):** "Photorealistic editorial photograph. A compliance manager reviewing a digital legal-requirements list on a laptop in a Swedish industrial office. Authentic Scandinavian workplace, natural daylight, warm neutral colour grading that sits on a cream/off-white palette, candid and unposed, soft shallow depth of field, documentary feel. Not glossy stock photography. No text, no logos, no watermarks. Realistic skin and hands."
  - Använd riktigt kundfoto endast med uttryckligt samtycke; annars generisk branschbild enligt scaffolden ovan (variera roll/aktivitet/setting per bransch).

## Källor (grundning)

- Kundens egna, godkända uppgifter (intervju, e-post, signerat samtycke) — primärkälla för ALLA siffror och citat.
- Motsvarande /branscher/-sida för korrekta lagkrav och kataloglänkar.
- Riksdagen.se / SFS för verifiering av lagnamn och nummer som nämns.
- Laglig egen produkt för funktionsbeskrivningar (laglista, lagbevakning, kontroller, revisionsrapport).

## Anmärkningar

- KRITISK PRODUKTSANNING: Inga uppfunna kunder, citat eller siffror. Varje metrik och citat MÅSTE härstamma från kund med dokumenterat publiceringssamtycke. Saknas verifiering: utelämna fältet/sektionen.
- ALMÅSA ÄR UNDANTAGEN: använd aldrig Almåsa som case, kund, citat eller referens någonstans.
- Anonymisering: om kund vill vara anonym, använd "[Anonymiserad kund, {bransch}]" och utelämna foto/namn i citat — men metriken måste ändå vara verklig.
- Kannibalisering: kundcase ska INTE konkurrera med branschsidan om samma sökord. Branschsidan äger "lagar för {bransch}"; caset äger proof/erfarenhet ("så använder {kund}..."). Sätt canonical på caset till sig självt.
- INGA påståenden om SHA-256/kryptografisk signering för revisionsrapporten — den är en avslutad kontrollcykel, signerad av ansvarig, exporterad som PDF.
- Denna sida (/kundcase/kundcase-mall) är en intern mall och bör INTE indexeras (noindex) eller publiceras som ett riktigt case.
