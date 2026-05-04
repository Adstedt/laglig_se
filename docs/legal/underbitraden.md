---
status: DRAFT — pending review by Swedish counsel before publishing
last-updated: 2026-04-30
target-route: /underbitraden
---

# Underbiträdesförteckning

> **DRAFT — verifiera varje rad mot prod innan publicering.** Bekräfta särskilt: (a) att alla listade leverantörer faktiskt används i produktion, (b) regionsval i Supabase och Vercel, (c) att DPA-avtal är på plats med samtliga, (d) om Cloudflare/CDN-leverantör ska listas separat.

**Senast uppdaterad:** [FYLL I — datum vid publicering]

För att tillhandahålla Tjänsten anlitar Laglig.se följande underbiträden ("sub-processors"). Vi har personuppgiftsbiträdesavtal (DPA) med samtliga underbiträden enligt artikel 28 i GDPR.

## Aktuella underbiträden

| # | Underbiträde | Funktion | Personuppgifter som behandlas | Plats för behandling | Skyddsåtgärd vid överföring till tredjeland |
| --- | --- | --- | --- | --- | --- |
| 1 | **Vercel Inc.** | Webbhosting, edge-funktioner, deploymentinfrastruktur | Konto- och användningsdata, IP-adresser, loggar | EU + USA | EU-US Data Privacy Framework + SCC |
| 2 | **Supabase Inc.** | Hanterad PostgreSQL-databas, autentisering, fillagring | Kunddata, kontouppgifter, autentiseringsdata | EU (Frankfurt, eu-central-1) | Behandling primärt inom EU. SCC vid eventuell support från USA. |
| 3 | **OpenAI, L.L.C.** | LLM (stora språkmodeller) för AI-funktioner | Indata till AI-funktioner (prompter och företagsuppgifter du anger) | USA | EU-US Data Privacy Framework + SCC. Träning på kunddata avtalsmässigt utesluten via OpenAI Enterprise/API-avtal. |
| 4 | **Anthropic, PBC** | LLM (stora språkmodeller) för AI-funktioner | Indata till AI-funktioner | USA | SCC + tilläggsskydd. Träning på kunddata avtalsmässigt utesluten. |
| 5 | **Cohere Inc.** | Embeddings och sökrelevans | Sökfrågor, dokumentinnehåll för indexering | USA / Kanada | Kanada har adekvat skyddsnivå (kommissionsbeslut). SCC för USA-behandling. |
| 6 | **Resend Inc.** | Transaktionsutskick (e-post) | E-postadress, namn, innehåll i transaktionsmail | EU + USA | EU-US Data Privacy Framework + SCC |
| 7 | **Functional Software, Inc. (Sentry)** | Felmonitorering och prestandaspårning | Felloggar, IP-adress, webbläsare, användar-ID | EU + USA | EU-US Data Privacy Framework + SCC. PII-skrubbning aktiverad. |
| 8 | **Stripe Payments Europe Ltd** | Betalhantering, fakturering | Kortuppgifter (PCI-DSS, hanteras direkt av Stripe), faktureringsadress, organisationsnummer | EU (Irland, primärt) | Inom EU. Visst stöd från Stripe Inc. (USA) under SCC. |
| 9 | **Roaring Apps AB (Bolagsapi)** | Företagsuppslag mot Bolagsverket och offentliga register | Organisationsnummer (slås upp), publika styrelseuppgifter som returneras | EU (Sverige) | Inom EU. |
| 10 | **Google Ireland Ltd / Google LLC** | Webbanalys (Google Analytics 4), webbplatsverifiering (Search Console), annonsering och konverteringsmätning (Google Ads) | IP-adress, klient-ID, händelsedata, konverteringsdata | EU + USA | EU-US Data Privacy Framework + SCC |
| 11 | **Meta Platforms Ireland Ltd** | Annonsering och konverteringsspårning via Meta Ads / Facebook Pixel | IP-adress, browser-ID, händelsedata | EU + USA (Meta Platforms, Inc.) | EU-US Data Privacy Framework + SCC |
| 12 | **LinkedIn Ireland Unlimited Co.** | Annonsering och konverteringsspårning via LinkedIn Ads / Insight Tag | IP-adress, browser-ID, händelsedata | EU + USA (LinkedIn Corporation) | EU-US Data Privacy Framework + SCC |
| 13 | [FYLL I — Cloudflare om ni använder dem för CDN/WAF] | CDN, DDoS-skydd | IP-adress, request-headers | EU + globalt | EU-US Data Privacy Framework + SCC |

## Process vid byte eller tillägg av underbiträden

Vi förbehåller oss rätten att lägga till eller byta ut underbiträden. Vid sådana ändringar:

1. Uppdaterar vi denna förteckning.
2. Meddelar vi befintliga kunder via e-post eller i Tjänsten minst trettio (30) dagar innan ändringen träder i kraft, om det avser ett underbiträde med betydelsefull databehandling.
3. Du har rätt att invända mot ett nytt underbiträde av sakliga skäl. Vid sådan invändning söker vi en alternativ lösning. Om ingen lösning kan nås har du rätt att säga upp avtalet utan kostnad för innevarande period.

## Kontakt

Frågor eller invändningar mot underbiträden: dev@laglig.se

---

> **Granskningsanteckningar (tas bort innan publicering):**
> - Verifiera att DPA är undertecknat med varje listad leverantör (Stripe, Vercel, Supabase, OpenAI, Anthropic, Cohere, Resend, Sentry har alla standardiserade DPA — sign + spara).
> - Bekräfta Supabase-region — om ni körs i USA-region byt formuleringen i raden ovan.
> - Listas Cloudflare separat? Vercel använder dem som infrastrukturlager — i många GDPR-genomgångar listas båda.
> - Roaring Apps / Bolagsapi: bekräfta legalt namn på underbiträdet (det kan vara annat än produktnamnet "Bolagsapi").
