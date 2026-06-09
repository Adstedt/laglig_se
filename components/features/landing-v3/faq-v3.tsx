'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

// Landing-v3 FAQ — a fuller, product-accurate set than the shared faq-section:
// covers the agent, regeländringar, audit/bevis, revisor access and scale, plus
// de-jargoned answers (no "RAG") and EU data residency. Kept v3-specific so the
// live page's FAQ is untouched.
const faqs = [
  {
    question: 'Hur lång tid tar det att komma igång?',
    answer:
      'Under 3 minuter. Ange ert organisationsnummer, så bygger vår AI en laglista utifrån er bransch och verksamhet — eller ta med er befintliga lista om ni redan har en.',
  },
  {
    question: 'Kan vi importera vår nuvarande laglista?',
    answer:
      'Ja. Har ni redan en laglista — i Excel eller ett annat verktyg — kan ni ta med den in i Laglig. Annars bygger vår AI en åt er utifrån er verksamhet. Ni väljer.',
  },
  {
    question: 'Vilka lagar och regler täcker ni?',
    answer:
      '10 000+ svenska lagar, förordningar och myndighetsföreskrifter samt relevanta EU-regler. Allt uppdateras dagligen.',
  },
  {
    question: 'Passar det vårt företag?',
    answer:
      'Ja, från enskild firma till koncern. Laglistan byggs utifrån er bransch, storlek och verksamhet — och plattformen växer med er.',
  },
  {
    question: 'Hur fungerar AI-assistenten?',
    answer:
      'Ni kan fråga vad som helst om era regler och er efterlevnad. Svaren bygger alltid på faktiska svenska lagar och regler, med källhänvisningar ni kan verifiera.',
  },
  {
    question: 'Vad händer när en lag ändras?',
    answer:
      'Ni får besked direkt när en regel på er laglista ändras. AI:n läser ändringen mot er verksamhet, bedömer hur den påverkar er och föreslår konkreta åtgärder — som ni godkänner.',
  },
  {
    question: 'Gör AI:n saker automatiskt?',
    answer:
      'AI-agenten kan föreslå och förbereda — skapa uppgifter, skriva utkast till styrdokument och uppdatera status — men inget genomförs utan ert godkännande. Allt loggas och är spårbart.',
  },
  {
    question: 'Hur visar vi att vi följer reglerna?',
    answer:
      'Koppla bevis till varje krav och genomför kontroller. Varje statusändring loggas över tid, så ni kan dela en komplett, spårbar rapport till ledning, styrelse eller revisor.',
  },
  {
    question: 'Kan vår revisor få tillgång?',
    answer:
      'Ja. Bjud in er revisor med en egen, kostnadsfri inloggning med läsbehörighet — de ser allt som behövs för att granska, men ändrar ingenting.',
  },
  {
    question: 'Är vår data säker?',
    answer:
      'Ja. Krypterad överföring (TLS 1.3), all data lagras inom EU (GDPR), och vi delar aldrig information med tredje part.',
  },
  {
    question: 'Kan vi testa gratis?',
    answer:
      'Ja. 15 dagars gratis provperiod med full tillgång — utan betalkort.',
  },
  {
    question: 'Finns det bindningstid?',
    answer:
      'Nej. Avsluta när som helst — och exportera er data enkelt om ni vill.',
  },
  {
    question: 'Är det här juridisk rådgivning?',
    answer:
      'Nej. Laglig.se ger AI-assisterad juridisk information med källhänvisningar, inte juridisk rådgivning. För specifik vägledning, kontakta en jurist.',
  },
]

export function FaqV3() {
  return (
    <section id="faq" className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-12 text-center">
            <h2
              className="mb-4 text-3xl font-medium tracking-tight sm:text-4xl"
              style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
            >
              Vanliga frågor
            </h2>
            <p className="text-muted-foreground">
              Har ni fler frågor?{' '}
              <a
                href="mailto:dev@laglig.se"
                className="text-primary underline-offset-4 hover:underline"
              >
                Kontakta oss
              </a>
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-base">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
