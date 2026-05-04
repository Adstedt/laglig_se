---
status: DRAFT — pending review by Swedish counsel before publishing
last-updated: 2026-04-30
target-route: /integritetspolicy
---

# Integritetspolicy

> **DRAFT — får ej publiceras innan juridisk granskning.** Fält markerade `[FYLL I]` måste verifieras. Granska särskilt: (a) fullständigt firmanamn och organisationsnummer, (b) postadress för Personuppgiftsansvarig, (c) faktiska lagringstider per kategori, (d) bekräfta att alla uppräknade underbiträden faktiskt används i produktion.

**Senast uppdaterad:** [FYLL I — datum vid publicering]

Denna integritetspolicy beskriver hur Laglig.se behandlar personuppgifter när du använder vår tjänst på laglig.se ("Tjänsten"). Vi följer EU:s dataskyddsförordning (GDPR, 2016/679) samt svensk kompletterande dataskyddslagstiftning.

## 1. Personuppgiftsansvarig

| | |
| --- | --- |
| Företag | Grro Technologies AB |
| Organisationsnummer | 559498-1903 |
| Adress | Stallmästarevägen 17, 254 84 Helsingborg |
| E-post | dev@laglig.se |

`dev@laglig.se` används för både allmänna frågor och frågor som rör dataskydd. Vid frågor om hur vi behandlar dina personuppgifter, eller för att utöva dina rättigheter (avsnitt 8), kontakta oss på e-postadressen ovan.

## 2. Vilka personuppgifter vi behandlar

Vi behandlar följande kategorier av personuppgifter:

### 2.1 Konto- och kontaktuppgifter
- Namn, e-postadress, lösenord (lagras krypterat).
- Företagstillhörighet, roll/titel, organisationsnummer för det företag du representerar.
- Telefonnummer (om angivet).

### 2.2 Användningsdata
- Inloggningstidpunkter, IP-adress, webbläsare, enhetstyp, sidvisningar inom Tjänsten.
- Innehåll du skapar i Tjänsten: laglistor, anteckningar, kommentarer, uppladdade filer, styrdokument.
- Sökfrågor, AI-prompter och resultat från AI-funktioner.

### 2.3 Företagsdata från offentliga register
När du anger ett organisationsnummer hämtar vi företagsuppgifter via Bolagsapi (vidare till Bolagsverket). Detta kan inkludera namn på styrelseledamöter och firmatecknare som är publikt tillgängliga i Bolagsverkets register.

### 2.4 Faktura- och betaluppgifter
Faktureringsadress, organisationsnummer, fakturahistorik. Kortuppgifter och bankuppgifter behandlas av Stripe (se avsnitt 6) — vi lagrar dem inte själva.

### 2.5 Supportkommunikation
Innehåll i e-postkonversationer, supportärenden och feedback du skickar till oss.

### 2.6 Cookies och liknande tekniker
Se separat **[Cookiepolicy](/cookiepolicy)**.

## 3. Varifrån personuppgifterna kommer

- Direkt från dig vid registrering, användning och kommunikation.
- Från offentliga register (Bolagsverket via Bolagsapi) när du slår upp ett företag.
- Automatiskt från din enhet (IP, webbläsare, enhetstyp) när du besöker Tjänsten.

## 4. Ändamål och rättslig grund

| Ändamål | Rättslig grund (Art. 6 GDPR) |
| --- | --- |
| Tillhandahålla Tjänsten du har tecknat avtal om | Avtal (Art. 6.1.b) |
| Skapa och underhålla ditt konto | Avtal (Art. 6.1.b) |
| Fakturering, redovisning och uppfyllande av bokföringslagen | Rättslig förpliktelse (Art. 6.1.c) |
| Säkerhet, bedrägeribekämpning, loggning | Berättigat intresse (Art. 6.1.f) — att skydda Tjänsten och våra användare |
| Felsökning och förbättring av Tjänsten | Berättigat intresse (Art. 6.1.f) |
| Utskick av servicemeddelanden (driftinformation, säkerhetsincidenter) | Avtal (Art. 6.1.b) |
| Marknadsföring till befintliga kunder om liknande tjänster | Berättigat intresse (Art. 6.1.f), möjlighet att invända i varje utskick |
| Marknadsföring till icke-kunder | Samtycke (Art. 6.1.a) |
| Statistik och analys (aggregerat) | Berättigat intresse (Art. 6.1.f) |
| Cookies som inte är strikt nödvändiga | Samtycke (Art. 6.1.a, ePrivacy) |

## 5. Lagringstid

Vi lagrar personuppgifter så länge det är nödvändigt för det ändamål de samlades in för:

- **Aktivt konto:** så länge du har ett aktivt abonnemang plus [FYLL I — t.ex. 90 dagar] efter avslutat abonnemang för att möjliggöra återaktivering eller export.
- **Dataminimering efter avslut:** [FYLL I — t.ex. "efter 90 dagar anonymiseras eller raderas innehåll, men aggregerad statistik kan behållas"].
- **Bokförings- och fakturaunderlag:** sju (7) år enligt bokföringslagen (1999:1078).
- **Säkerhetsloggar:** [FYLL I — t.ex. 12 månader].
- **Supportkonversationer:** [FYLL I — t.ex. 24 månader].
- **Marknadsföringsdata:** tills du återkallar samtycke eller invänder.

## 6. Mottagare och underbiträden

För att leverera Tjänsten anlitar vi noga utvalda underbiträden. En aktuell lista finns på **[/underbitraden](/underbitraden)**. Vi har personuppgiftsbiträdesavtal med samtliga underbiträden enligt Art. 28 GDPR.

I korthet — våra huvudsakliga underbiträden är:

| Underbiträde | Funktion | Plats för behandling |
| --- | --- | --- |
| Vercel Inc. | Webbhosting / edge | EU + USA |
| Supabase Inc. | Databas, autentisering, lagring | EU (Frankfurt) |
| OpenAI, L.L.C. | AI-funktioner (LLM) | USA |
| Anthropic, PBC | AI-funktioner (LLM) | USA |
| Cohere Inc. | AI-funktioner (embeddings/sökrelevans) | USA / Kanada |
| Resend Inc. | Transaktionsutskick (e-post) | EU + USA |
| Functional Software, Inc. (Sentry) | Felmonitorering | EU + USA |
| Stripe Payments Europe Ltd | Betalhantering | EU (Irland) |
| Bolagsapi / Roaring Apps AB | Företagsuppslag | EU (Sverige) |
| Google Ireland Ltd / Google LLC | Webbanalys (Google Analytics, Search Console) och annonsering (Google Ads) | EU + USA |
| Meta Platforms Ireland Ltd | Annonsering och konverteringsspårning (Meta Ads / Facebook Pixel) | EU + USA |
| LinkedIn Ireland Unlimited Co. | Annonsering och konverteringsspårning (LinkedIn Ads / Insight Tag) | EU + USA |

## 7. Överföring till tredjeland

Vissa underbiträden behandlar personuppgifter utanför EU/EES. När så sker överförs uppgifterna med stöd av ett av följande:

- EU-kommissionens beslut om adekvat skyddsnivå (t.ex. EU-US Data Privacy Framework där tillämpligt).
- Standardavtalsklausuler (SCC) godkända av EU-kommissionen, kompletterade med tekniska och organisatoriska skyddsåtgärder.

Du kan begära kopia av tillämpliga skyddsåtgärder via dev@laglig.se.

## 8. Dina rättigheter

Enligt GDPR har du rätt att:

- **Få information** om hur dina personuppgifter behandlas (denna policy).
- **Få tillgång** till dina personuppgifter (registerutdrag, Art. 15).
- **Få felaktiga uppgifter rättade** (Art. 16).
- **Få uppgifter raderade** ("rätt att bli glömd", Art. 17), när det är förenligt med rättsliga förpliktelser.
- **Begära begränsning** av behandlingen (Art. 18).
- **Invända mot behandling** baserad på berättigat intresse, inklusive direktmarknadsföring (Art. 21).
- **Dataportabilitet** — få ut dina uppgifter i ett maskinläsbart format (Art. 20).
- **Återkalla samtycke** när behandlingen baseras på samtycke (utan att tidigare behandling påverkas).

För att utöva dina rättigheter, kontakta oss på dev@laglig.se. Vi besvarar din begäran inom en (1) månad enligt Art. 12.3 GDPR.

Du har även rätt att lämna klagomål till tillsynsmyndigheten **Integritetsskyddsmyndigheten (IMY)**, imy.se.

## 9. AI-behandling

Tjänsten innehåller AI-funktioner som genererar laglistor, sammanfattningar och rekommendationer baserat på dina indata och företagsuppgifter. Vad du behöver veta:

- Vi använder OpenAI, Anthropic och Cohere som underbiträden för LLM- och embeddings-funktioner.
- Avtalsenligt får dessa leverantörer **inte** använda din indata för att träna sina allmänna modeller.
- AI-genererade resultat är tekniska förslag och **utgör inte juridisk rådgivning**. Slutligt beslut om relevans och efterlevnad ligger hos dig.
- Vi loggar prompter och svar i 30 dagar för felsökning och kvalitetskontroll, därefter raderas de.

## 10. Säkerhet

Vi vidtar tekniska och organisatoriska åtgärder enligt Art. 32 GDPR, bland annat:

- TLS-kryptering för all trafik mellan användare och Tjänsten.
- Kryptering av databasen i vila (AES-256, hanterad av Supabase).
- Row Level Security (RLS) i databasen — applikationsdata är åtkomstbegränsad per användare/arbetsyta.
- Tvåfaktorsautentisering för administrativ åtkomst.
- Loggning och övervakning av säkerhetshändelser.
- Personalåtkomst till produktionsdata begränsad enligt principen om minsta behörighet.
- Underbiträden granskas innan de tas i bruk.

Vid en personuppgiftsincident anmäler vi till IMY inom 72 timmar enligt Art. 33 GDPR. Drabbade användare informeras enligt Art. 34 där det krävs.

## 11. Barn

Tjänsten riktar sig till företag och yrkesverksamma. Vi samlar inte medvetet in personuppgifter om personer under 18 år. Om du blir medveten om sådan behandling, kontakta oss så raderar vi uppgifterna.

## 12. Ändringar i policyn

Vi kan komma att uppdatera denna policy. Vid väsentliga ändringar informerar vi dig via e-post eller i Tjänsten innan ändringen träder i kraft. Aktuell version finns alltid på laglig.se/integritetspolicy.

## 13. Kontakt

| | |
| --- | --- |
| E-post (allmän kontakt och dataskyddsfrågor) | dev@laglig.se |
| Kontaktsida | [/kontakt](/kontakt) |
| Postadress | Grro Technologies AB, Stallmästarevägen 17, 254 84 Helsingborg |
| Organisationsnummer | 559498-1903 |

---

> **Granskningsanteckningar (tas bort innan publicering):**
> - Bekräfta full lista underbiträden mot prod-konfiguration
> - Verifiera lagringstider efter att retention-policyer är beslutade
> - Lägg till DSO/dataskyddsombud om ni utses ett (rekommenderat för en jur. SaaS)
> - Kontrollera om ni omfattas av Art. 30-skyldighet (registerförteckning) — sannolikt ja
> - Klargör om ni säljer till offentlig sektor (då tillkommer kompletterande krav)
