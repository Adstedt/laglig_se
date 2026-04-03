/**
 * Document Content Generation Prompts
 *
 * Story 12.3: Summering + Kommentar + Tillämpningsområde generation for LegalDocuments.
 * Summering = neutral description of what the law regulates.
 * Kommentar = actionable compliance commentary ("Vi ska..." voice).
 * Tillämpningsområde = LLM-optimized applicability hint for law list generation filtering.
 */

// ============================================================================
// Types
// ============================================================================

export interface DocumentContext {
  document_number: string
  title: string
  content_type: string
  effective_date: string | null
  publication_date: string | null
  status: string
  source_text: string
  metadata: Record<string, unknown> | null
  amendments: AmendmentContext[]
}

export interface AmendmentContext {
  amending_law_title: string
  effective_date: string | null
  affected_sections_raw: string | null
  summary: string | null
}

// ============================================================================
// Few-shot examples — Summering voice (neutral, descriptive, third-person)
// Sourced from notisumComment field in notisum-full-data.json
// ============================================================================

const SUMMERING_FEW_SHOT_EXAMPLES = [
  {
    document: 'Arbetsmiljölag (1977:1160)',
    text: 'Arbetsmiljölagen (AML) är en ramlag som innehåller övergripande regler för hur arbetsmiljöarbetet ska bedrivas och hur ansvar ska fördelas. Syftet med AML är att förebygga ohälsa och olyckor samt att skapa en trygg och trivsam arbetsmiljö. Lagen tydliggör arbetsgivarens ansvar, till exempel skyldigheten att anmäla arbetsskador, dödsfall och allvarliga tillbud till Arbetsmiljöverket, förebygga risker, informera arbetstagare om faror i arbetet och bedriva ett systematiskt arbetsmiljöarbete.',
  },
  {
    document: 'Systematiskt arbetsmiljöarbete, AFS 2023:1',
    text: 'Föreskrifterna om systematiskt arbetsmiljöarbete ställer krav på alla arbetsgivare att organisera, genomföra och följa upp sitt arbetsmiljöarbete för att förebygga risker för ohälsa och olycksfall i arbetet samt uppnå en tillfredsställande arbetsmiljö. Det systematiska arbetet ska vara en del av den dagliga verksamheten där arbetstagare samt skyddsombud ska ges möjlighet att medverka.',
  },
  {
    document: 'Miljöbalk (1998:808)',
    text: 'Miljöbalken är en stor miljölag som smälter samman regler från sexton tidigare miljölagar. Det är verksamhetsutövarens ansvar att se till att miljöbalkens regler inte överträds och att miljöbalkens syfte uppnås. Detta ansvar uppfylls till stor del av verksamhetsutövarens egenkontroll.',
  },
  {
    document: 'EU:s dataskyddsförordning, (EU) 2016/679',
    text: 'EU:s dataskyddsförordning (GDPR) tillämpas på sådan behandling av personuppgifter som helt eller delvis företas på automatisk väg samt på annan behandling än automatisk av personuppgifter som ingår i eller kommer att ingå i ett register.',
  },
  {
    document: 'Lag (2010:1011) om brandfarliga och explosiva varor',
    text: 'Övergripande regler om hantering, förvaring och import av brandfarliga och explosiva varor ska förhindra att brandfarliga eller explosiva varor orsakar oavsiktliga bränder eller explosioner. Byggnader och anordningar ska vara utformade och lokaliserade på ett betryggande sätt. Den som hanterar brandfarliga eller explosiva varor ska ha den kompetens som behövs.',
  },
  {
    document: 'Diskrimineringslag (2008:567)',
    text: 'Syftet med denna lag är att motverka diskriminering och på andra sätt främja lika rättigheter och möjligheter oavsett kön, könsöverskridande identitet eller uttryck, etnisk tillhörighet, religion eller annan trosuppfattning, funktionsnedsättning, sexuell läggning eller ålder. Lagen består av förbudet mot diskriminering samt det förebyggande arbetet mot diskriminering.',
  },
]

// ============================================================================
// Few-shot examples — Kommentar voice ("Vi ska...", obligation-focused)
// Sourced from summaryText field in notisum-full-data.json
// ============================================================================

const KOMMENTAR_FEW_SHOT_EXAMPLES = [
  {
    document: 'Arbetsmiljölag (1977:1160)',
    text: 'Vi ska ha en tillfredsställande arbetsmiljö som är anpassad till människors olika förutsättningar och där arbetstagaren är delaktig i utformningen kring sin egen arbetssituation. Vi ska förebygga risker i verksamheten och bedriva ett systematiskt arbetsmiljöarbete. Arbetsmiljölagen kompletteras av arbetsmiljöförordningen och andra författningar.',
  },
  {
    document: 'Systematiskt arbetsmiljöarbete, AFS 2023:1',
    text: 'Vi ska planera, undersöka, genomföra och följa upp verksamheten på ett sådant sätt att ohälsa och olycksfall i arbetet förebyggs och en tillfredsställande arbetsmiljö uppnås. Vi ska ha en arbetsmiljöpolicy samt rutiner som beskriver hur SAM skall gå till. Vi ska årligen göra en uppföljning av det systematiska arbetsmiljöarbetet.',
  },
  {
    document: 'EU:s dataskyddsförordning, (EU) 2016/679',
    text: 'Vi ska bestämma ändamålet till behandlingen av personuppgifterna samt ha en rättslig grund till densamma. Vi ska informera de registrerade hur vi använder deras uppgifter. Vi ska ha en förteckning över vilka typer av personuppgifter som finns i företaget och hur vi använder dessa uppgifter. Vi ska se till att vi har rutiner för att rapportera personuppgiftsincidenter.',
  },
  {
    document: 'Lag (2010:1011) om brandfarliga och explosiva varor',
    text: 'Vi ska vidta de åtgärder och de försiktighetsmått som behövs för att hindra, förebygga och begränsa olyckor och skador på liv, hälsa, miljö eller egendom som kan uppkomma genom brand eller explosion. Om vi bedriver tillståndspliktig verksamhet ska vi bl.a. utreda riskerna, ha personal med rätt kompetens och utse en eller flera föreståndare.',
  },
  {
    document: 'Diskrimineringslag (2008:567)',
    text: 'Vi ska säkerställa att ingen arbetstagare, arbetssökande eller inhyrd personal diskrimineras på grund av de skyddade diskrimineringsgrunderna. Vi behöver bedriva ett aktivt förebyggande arbete mot diskriminering och trakasserier, inklusive årlig lönekartläggning. Dokumenterade åtgärdsplaner krävs för arbetsgivare med 25 eller fler anställda.',
  },
  {
    document: 'Miljöbalk (1998:808)',
    text: 'Miljöbalken berör alla typer av åtgärder, oavsett om de ingår i den enskildes dagliga liv eller i någon form av näringsverksamhet. Vi har ett ansvar att förvalta naturen väl. Lagen syftar till att främja en hållbar utveckling som innebär att nuvarande och kommande generationer tillförsäkras en hälsosam och god miljö.',
  },
]

// ============================================================================
// Few-shot examples — Tillämpningsområde (applicability hint, LLM-optimized)
// Format: "Gäller [who]. [Threshold]. Reglerar [what]."
// ============================================================================

const APPLICABILITY_FEW_SHOT_EXAMPLES = [
  {
    document: 'Arbetsmiljölag (1977:1160)',
    text: 'Gäller alla arbetsgivare och den som hyr in arbetskraft. Reglerar det övergripande ansvaret för arbetsmiljön, skyldighet att förebygga ohälsa och olycksfall samt att bedriva systematiskt arbetsmiljöarbete.',
  },
  {
    document: 'Systematiskt arbetsmiljöarbete, AFS 2023:1',
    text: 'Gäller alla arbetsgivare oavsett storlek eller bransch. Skriftlig dokumentation krävs vid 10 eller fler arbetstagare. Reglerar hur arbetsmiljöarbetet ska organiseras: policy, riskbedömningar, handlingsplaner och årlig uppföljning.',
  },
  {
    document: 'EU:s dataskyddsförordning, (EU) 2016/679',
    text: 'Gäller alla organisationer som behandlar personuppgifter om personer i EU, oavsett var organisationen är etablerad. Reglerar insamling, lagring, delning och radering av personuppgifter samt de registrerades rättigheter.',
  },
  {
    document: 'Diskrimineringslag (2008:567)',
    text: 'Gäller alla arbetsgivare, utbildningsanordnare och verksamheter som tillhandahåller varor och tjänster. Aktiva åtgärder och lönekartläggning årligen; dokumentationskrav vid 25 eller fler anställda. Reglerar förbud mot diskriminering och krav på förebyggande arbete.',
  },
  {
    document: 'Lag (2010:1011) om brandfarliga och explosiva varor',
    text: 'Gäller den som hanterar, överför, importerar eller exporterar brandfarliga eller explosiva varor. Tillståndsplikt för hantering över vissa mängder. Reglerar säkerhetskrav, kompetens och föreståndaransvar vid hantering av brandfarliga och explosiva varor.',
  },
  {
    document: 'Lag (1992:1534) om CE-märkning',
    text: 'Gäller företag som tillverkar, importerar eller distribuerar produkter som omfattas av EU:s harmoniserade produktlagstiftning. Reglerar CE-märkning, försäkran om överensstämmelse och teknisk dokumentation för produkter som släpps ut på den inre marknaden.',
  },
  {
    document: 'Avfallsförordning (2020:614)',
    text: 'Gäller alla verksamheter som producerar, transporterar eller behandlar avfall. Särskilt relevant för bygg-, rivnings-, tillverknings- och industriföretag som genererar bygg- och rivningsavfall, farligt avfall eller stora avfallsvolymer. Tillståndsplikt för yrkesmässig avfallstransport; anmälningsplikt vid farligt avfall över 100 kg eller 100 liter per kalenderår. Reglerar klassificering, utsortering, spårbarhet av farligt avfall och rapportering till Naturvårdsverkets avfallsregister.',
  },
]

// ============================================================================
// System prompt — combined for Summering, Kommentar and Tillämpningsområde
// ============================================================================

export function buildSystemPrompt(): string {
  const summeringExamples = SUMMERING_FEW_SHOT_EXAMPLES.map(
    (ex, i) => `  Exempel ${i + 1} (${ex.document}):\n  "${ex.text}"`
  ).join('\n\n')

  const kommentarExamples = KOMMENTAR_FEW_SHOT_EXAMPLES.map(
    (ex, i) => `  Exempel ${i + 1} (${ex.document}):\n  "${ex.text}"`
  ).join('\n\n')

  const applicabilityExamples = APPLICABILITY_FEW_SHOT_EXAMPLES.map(
    (ex, i) => `  Exempel ${i + 1} (${ex.document}):\n  "${ex.text}"`
  ).join('\n\n')

  return `Du är en juridisk expert på svensk lagstiftning och svenska myndighetsföreskrifter. Din uppgift är att producera tre texter för ett givet juridiskt dokument:

1. **Summering** — en neutral, saklig beskrivning av vad lagen/dokumentet reglerar.
2. **Kommentar** — en handlingsinriktad efterlevnadskommentar som beskriver vad organisationen måste göra.
3. **Tillämpningsområde** — en kort, LLM-optimerad text som beskriver vilka företag/verksamheter lagen gäller för.

## Summering-instruktioner

Skriv en saklig, beskrivande sammanfattning av vad det juridiska dokumentet reglerar. Texten ska täcka:
- Lagens/föreskriftens syfte och tillämpningsområde
- Vilka den gäller för
- Centrala bestämmelser och krav
- Senaste ändringar (om relevant)
- Om källtexten hänvisar till kompletterande förordningar, föreskrifter eller andra författningar, nämn dessa kort (t.ex. "Lagen kompletteras av X förordning och Y:s föreskrifter") — detta hjälper läsaren att förstå var detaljreglerna finns

Stilregler för Summering:
- Tredjeperson, neutral ton (aldrig "vi", "oss", "vår")
- 3–5 meningar (mjuk gräns — hellre informativ än kort)
- Saklig och deskriptiv — beskriv lagen utifrån
- Presens, aktiv form när det är naturligt
- Inget skyldighets- eller åtgärdsspråk ("Vi ska...", "Vi behöver...", "Vi är skyldiga att..." är FÖRBJUDET i Summering)
- Inkludera alltid konkreta numeriska tröskelvärden (antal anställda, belopp, tidsfrister) som lagen definierar — dessa är avgörande för att förstå vilka reglerna gäller för

Stilexempel för Summering:
${summeringExamples}

## Kommentar-instruktioner

Skriv en handlingsinriktad efterlevnadskommentar som beskriver vad organisationen måste göra för att följa det juridiska dokumentet. Texten ska:
- Börja med den centrala skyldigheten
- Nämna viktiga tröskelvärden och gränsvärden
- Använda aktiv röst i presens
- Om källtexten hänvisar till kompletterande förordningar eller föreskrifter med detaljkrav, nämn att vi även ska följa dessa

Stilregler för Kommentar:
- Förstaperson plural: "Vi ska...", "Vi behöver...", "Vi är skyldiga att..."
- Inledande mening som sammanfattar kärnkravet, följt av en punktlista med konkreta skyldigheter — detta ger bäst läsbarhet när lagen innehåller flera separata krav
- Skyldighets- och åtgärdsfokus — beskriv vad organisationen ska göra
- Starta med kärnkravet, inte med bakgrundsbeskrivning
- Presens, aktiv form
- Inkludera alltid konkreta numeriska tröskelvärden (antal anställda, belopp, tidsfrister) som utlöser specifika skyldigheter — dessa är det första en organisation behöver veta

Stilexempel för Kommentar:
${kommentarExamples}

## Tillämpningsområde-instruktioner

Skriv en kort text som beskriver vilka företag eller verksamheter lagen gäller för. Denna text används av ett AI-system för att avgöra om en lag ska inkluderas i ett specifikt företags laglista — den måste därför vara precis och matchbar mot företagsprofiler.

Texten ska följa denna struktur:
- Mening 1: "Gäller [vem/vilka]." — kärnmålgruppen
- Mening 2 (om relevant): Tröskelvärden, villkor eller särskild relevans för specifika branscher/aktiviteter
- Mening 3: "Reglerar [vad — kort]." — vad lagen handlar om

Stilregler för Tillämpningsområde:
- Max 2–4 meningar, under 80 ord
- Första meningen börjar ALLTID med "Gäller"
- Deklarativ ton — beskriv *när* lagen gäller, inte *vad organisationen ska göra*
- Nämn konkreta branscher, aktiviteter, produkttyper eller företagsegenskaper som avgör tillämplighet
- Inkludera storlekströsklar om lagen definierar sådana (t.ex. "vid 10+ anställda", "vid 25+ anställda")
- Om lagen gäller alla/de flesta verksamheter men har SÄRSKILD relevans för vissa branscher eller verksamhetstyper, lägg till: "Särskilt relevant för [bransch/aktivitet]." — detta hjälper AI-systemet att prioritera lagen för rätt företag
- Aldrig "Vi ska..." — detta är INTE en skyldighetstext

Stilexempel för Tillämpningsområde:
${applicabilityExamples}

## DO (mönster att följa)
- Gruppera efter sakinnehåll, inte myndighet
- Använd aktiv röst, presens
- Nämn ALLTID konkreta numeriska tröskelvärden (anställningsgränser, belopp, tidsfrister) som definieras i källtexten — dessa är kritiska för efterlevnadsbeslut och ska framgå tydligt i ALLA tre texterna
- Allt innehåll ska vara egenformulerat — kopiera aldrig text från källdokumentet

## DON'T (antimönster att undvika)
- Blanda ALDRIG ihop rösterna: Summering = neutral, Kommentar = "Vi ska...", Tillämpningsområde = "Gäller..."
- Skriv inte fler än 5 meningar per Summering/Kommentar, eller 3 meningar per Tillämpningsområde
- Kopiera aldrig direkt från lagtexten
- Använd aldrig passiv form ("Det ska säkerställas att...") — använd aktiv form ("Vi ska säkerställa att...")
- Inkludera aldrig påståenden som inte stöds av källtexten

## PRECISION (vanliga misstag att undvika)
- **Krav vs rekommendation**: Skilj ALLTID mellan "ska" (krav) och "bör" (rekommendation/allmänt råd). Formulera ALDRIG en rekommendation som en skyldighet — om källtexten säger "bör", skriv "bör", inte "ska"
- **Undantag och villkor**: Utelämna ALDRIG väsentliga undantag eller villkor. Om ett krav har ett "om inte"-villkor, ett tidsvillkor, eller gäller under begränsade omständigheter — inkludera villkoret
- **Numerisk precision**: Förenkla ALDRIG numeriska gränsvärden, trösklar eller intervall om det ändrar innebörden. Om källtexten anger olika värden för olika kategorier, slå inte ihop dem
- **Kategorisering**: Blanda ALDRIG ihop vilka regler som gäller för vilka kategorier. Om olika krav gäller för t.ex. hög- och lågspänning, eller yrkesmässig och icke-yrkesmässig verksamhet — håll dem åtskilda
- **Omfattning**: Lägg ALDRIG till kvalificerare som "alla", "varje", "samtliga" om källtexten inte explicit använder dem — de kan bredda tillämpningsområdet felaktigt

## Output-format

Svara ENBART med ett JSON-objekt. Ingen markdown, inga kodblock, ingen inledande text.

{"summering": "...", "kommentar": "...", "applicability": "..."}`
}

// ============================================================================
// Per-document user message — context assembly
// ============================================================================

/**
 * Strip HTML tags and normalize whitespace for LLM input.
 * No truncation — full document text is sent.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&aring;/g, 'å')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Aring;/g, 'Å')
    .replace(/&#\d+;/g, '')
    .replace(/&\w+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Get the best available source text from a LegalDocument.
 * Priority: html_content (stripped) → markdown_content → full_text.
 * Returns null if all three are unavailable.
 */
export function getSourceText(doc: {
  html_content: string | null
  markdown_content: string | null
  full_text: string | null
}): string | null {
  if (doc.html_content) {
    return stripHtml(doc.html_content)
  }
  if (doc.markdown_content) {
    return doc.markdown_content
  }
  if (doc.full_text) {
    return doc.full_text
  }
  return null
}

/**
 * Build the user message (per-document context) for the LLM.
 * Includes document text, metadata, and amendment history.
 * No truncation — full document text is sent.
 */
export function buildDocumentContext(ctx: DocumentContext): string {
  const parts: string[] = []

  parts.push(`## Dokument: ${ctx.title}`)
  parts.push(`Dokumentnummer: ${ctx.document_number}`)
  parts.push(`Innehållstyp: ${ctx.content_type}`)
  parts.push(`Status: ${ctx.status}`)

  if (ctx.effective_date) {
    parts.push(`Ikraftträdandedatum: ${ctx.effective_date}`)
  }
  if (ctx.publication_date) {
    parts.push(`Publiceringsdatum: ${ctx.publication_date}`)
  }

  // Include "ersätter" mapping for AFS 2023 consolidated provisions
  if (ctx.metadata && typeof ctx.metadata === 'object') {
    const meta = ctx.metadata as Record<string, unknown>
    if (meta.replacesOldReference) {
      parts.push(`Ersätter: ${meta.replacesOldReference}`)
    }
  }

  // Amendment history
  if (ctx.amendments.length > 0) {
    parts.push('\n## Ändringshistorik (senaste först)')
    for (const a of ctx.amendments) {
      const datePart = a.effective_date
        ? ` (ikraftträdande: ${a.effective_date})`
        : ''
      const sectionsPart = a.affected_sections_raw
        ? ` — ${a.affected_sections_raw}`
        : ''
      const summaryPart = a.summary ? `\n  ${a.summary}` : ''
      parts.push(
        `- ${a.amending_law_title}${datePart}${sectionsPart}${summaryPart}`
      )
    }
  }

  // Full document source text — no truncation
  parts.push('\n## Fullständig lagtext')
  parts.push(ctx.source_text)

  return parts.join('\n')
}

// ============================================================================
// Hallucination validation prompt (for Haiku 4.5 second batch)
// ============================================================================

export function buildHallucinationCheckPrompt(): string {
  return `Du är en faktagranskare. Du får en genererad Summering, Kommentar och Tillämpningsområde samt källtexten de baseras på.

Din uppgift: Identifiera om den genererade texten innehåller påståenden som INTE stöds av källtexten.

Svara ENBART med ett JSON-objekt:
{"has_unsupported_claims": true/false, "flagged_claims": ["lista av påståenden som inte stöds av källtexten"]}`
}

export function buildHallucinationCheckUserMessage(
  summering: string,
  kommentar: string,
  sourceText: string,
  applicability?: string
): string {
  return `## Genererad Summering
${summering}

## Genererad Kommentar
${kommentar}
${applicability ? `\n## Genererat Tillämpningsområde\n${applicability}` : ''}

## Källtext
${sourceText}`
}
