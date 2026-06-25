# Innehallsbrief — Lagkatalog & rattskallor

- **Route:** /funktioner/lagkatalog
- **Cluster / template:** funktioner / FeaturePageTemplate
- **Sokintention:** commercial (med stark informationell ingang — "var hittar jag lagtext")
- **Ordmal:** ~1000

## Nyckelord

- **Primart:** lagkatalog
- **Sekundart:** rattskallor, svenska lagar och forfattningar, sok i lagtext
- **Long-tail:**
  - "var hittar jag gallande lagtext"
  - "databas over svenska lagar och forordningar"
  - "skillnad mellan lag forordning och foreskrift"
  - "vad ar rattskallor"
  - "sok foreskrifter AFS"
  - "EU-forordningar pa svenska"
  - "halla koll pa gallande lagar"
  - "konsoliderad lagtext SFS"
  - "lista over myndighetsforeskrifter"
  - "lankar till riksdagen lagtext"

## SEO-meta

- **Meta-titel (<=60 tecken):** Lagkatalog — alla svenska lagar & rattskallor pa ett stalle
- **Meta-beskrivning (~155 tecken):** En sokbar lagkatalog med svenska lagar, forordningar, foreskrifter och EU-ratt — alltid gallande version. Sok pa SFS-nummer eller amne. Testa med ert organisationsnummer.
- **H1:** Lagkatalog: alla rattskallor som gor er laglista mojlig

## Produktvinkel (hook)

Lagkatalogen ar grunden hela Laglig.se star pa: en kontinuerligt uppdaterad samling svenska och europeiska rattskallor som er laglista, era kravpunkter och er bevakning bygger pa. I stallet for att leta i riksdagen.se, myndigheternas forfattningssamlingar och EUR-Lex var for sig sla upp varje forfattning pa ett stalle — och se direkt vilka som gäller just er verksamhet.

## Sidstruktur (H2/H3)

1. **MarketingHero** — H1 + hook + OrgCheck i hero
   - Eyebrow: "Funktion · Lagkatalog"
   - Subtitle: sokbar katalog over rattskallor, alltid gallande version, kopplad till er laglista
2. **DefinitionBox — Vad ar en lagkatalog (och vad ar rattskallor)?**
   - H3: Rattskallehierarkin: grundlag, lag, forordning, foreskrift, EU-ratt
   - H3: Konsoliderad vs ursprunglig lydelse — varfor "gallande version" ar poangen
   - Renderas i DefinitionBox hogst upp
3. **FeatureGrid — Vad katalogen innehaller**
   - H3: SFS-lagar och forordningar (riksdagen/SFS)
   - H3: Myndighetsforeskrifter (AFS, BFS, MSBFS, NFS m.fl.)
   - H3: EU-forordningar och direktiv (EUR-Lex)
   - Renderas i FeatureGrid
4. **SplitFeature — Sok pa SFS-nummer, amne eller paragraf** (skarmdump: sokvy/filtrering)
   - H3: Fritextsok och filter pa omrade, utgivare, status
5. **SplitFeature — Fran katalog till er laglista** (skarmdump: "lagg till i laglista")
   - H3: Lagg till en forfattning i laglistan med ett klick
   - H3: AI-sammanfattning + "Hur paverkar detta oss?" pa varje forfattning
6. **OrgCheckCta** — mid-page: "Se vilka av katalogens forfattningar som traffar er bransch"
7. **CatalogLawList — Exempel pa flitigt anvanda forfattningar** (lankar in i live-katalogen)
8. **ChangeFeedEmbed — Katalogen halls levande**
   - H3: Hur nya och andrade forfattningar tas in (koppling till /funktioner/lagandringar)
9. **FaqAccordion**
10. **CtaBlock + RelatedPagesGrid**

## Kataloglankar (CatalogLawList)

- Arbetsmiljolag (SFS 1977:1160) — central arbetsmiljoreglering for i stort sett alla arbetsgivare.
- Miljobalk (SFS 1998:808) — ramlag for miljo, gäller verksamheter med miljopaverkan.
- Systematiskt arbetsmiljoarbete (AFS 2023:1) — exempel pa myndighetsforeskrift i katalogen.
- Forordning om verksamhetsutovares egenkontroll (SFS 1998:901) — kopplar miljobalken till dokumenterad lagkoll.
- Diskrimineringslag (SFS 2008:567) — gäller alla arbetsgivare.
- Arbetstidslag (SFS 1982:673) — reglerar arbetstid, dygns- och veckovila.
- Avfallsforordning (SFS 2020:614) — avfallshantering, gäller breda verksamhetsgrupper.
- Dataskyddsforordningen GDPR (32016R0679) — exempel pa EU-forordning i katalogen.
- Lag om skydd mot olyckor (SFS 2003:778) — brandskydd och systematiskt brandskyddsarbete.
- Plan- och bygglag (SFS 2010:900) — bygg- och fastighetsverksamhet.
- Livsmedelslag (SFS 2006:804) — livsmedelshantering [bekrafta i katalogen].
- REACH-forordningen (32006R1907) — kemikalier, exempel pa EU-forordning.

## FAQ (3-5)

- **Vad ar skillnaden mellan en lag, en forordning och en foreskrift?**
  - Lag = beslutad av riksdagen; forordning = regeringen; foreskrift = myndighet (t.ex. Arbetsmiljoverket/AFS). Beskriv hierarkin och att alla tre kan ge bindande krav. Peka pa att katalogen rymmer alla niva er.
- **Visar lagkatalogen alltid gallande lagtext?**
  - Ja — katalogen speglar gallande/konsoliderad lydelse och uppdateras nar forfattningar andras; koppling till lagbevakning. Undvik att lova realtid pa sekunden — beskriv kontinuerlig uppdatering.
- **Ingar EU-ratt och myndighetsforeskrifter, eller bara svenska lagar?**
  - Hela kedjan: SFS, myndighetsforeskrifter (AFS m.fl.) och EU-forordningar/direktiv, lankade till kallan.
- **Hur vet jag vilka av alla dessa forfattningar som gäller mitt foretag?**
  - Org-nummer-kollen + branschprofil bygger en laglista ur katalogen; lank till /funktioner/laglista.
- **Kan jag lanka direkt till en paragraf eller forfattning?**
  - Varje forfattning har en egen sida i katalogen som gar att sla upp och dela.

## Interna lankar (relatedPages)

- /funktioner/laglista
- /funktioner/ai-sammanfattningar
- /funktioner/lagandringar
- /funktioner/kravpunkter

## Bildmaterial

- **Skarmdumpar:** Katalogens sokvy med filter (utgivare/omrade/status), en enskild forfattningssida med AI-sammanfattning, "lagg till i laglista"-flodet. Wrap i ScreenshotFrame.
- **Personbild (prompt):** "Photorealistic editorial photograph. A compliance officer looking up a regulation on a laptop in a bright Swedish open-plan office. Authentic Scandinavian workplace, natural daylight, warm neutral colour grading that sits on a cream/off-white palette, candid and unposed, soft shallow depth of field, documentary feel. Not glossy stock photography. No text, no logos, no watermarks. Realistic skin and hands."

## Kallor (grundning)

- riksdagen.se (SFS, konsoliderad lagtext), regeringen.se for forordningar.
- Myndigheternas forfattningssamlingar: Arbetsmiljoverket (AFS), Boverket (BFS), MSB (MSBFS), Naturvardsverket (NFS).
- EUR-Lex for EU-forordningar/direktiv.
- Laglig egen katalog (47 000+ forfattningar) for omfang och struktur.

## Anmarkningar

- Risk for kannibalisering mot sjalva katalog-ytan (/lagar el. motsv.): denna sida ar funktions-/saljsidan om katalogen som produktfunktion; den faktiska katalogen ar verktyget. Canonical pekar pa denna funktionssida; lank tydligt vidare till live-katalogen. Halls aven isar fran /funktioner/lagandringar (bevakning) som agar "andringar over tid".
