'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'Hur lång tid tar det att komma igång?',
    answer:
      'Under 3 minuter. Ange ditt organisationsnummer, så genererar vår AI en personlig laglista baserad på din bransch och verksamhet.',
  },
  {
    question: 'Hur fungerar AI-assistenten?',
    answer:
      'Vår AI använder RAG-teknologi som säkerställer att alla svar baseras på faktiska svenska lagar. Du får alltid källhänvisningar så du kan verifiera svaren.',
  },
  {
    question: 'Kan jag testa gratis?',
    answer:
      'Ja. Du får 14 dagars gratis provperiod med full tillgång utan att ange betalkort.',
  },
  {
    question: 'Finns det bindningstid?',
    answer:
      'Nej. Du kan avsluta när som helst via kontoinställningar. Din data exporteras enkelt om du vill.',
  },
  {
    question: 'Är min data säker?',
    answer:
      'Ja. Vi använder krypterad överföring (TLS 1.3), lagrar all data i Sverige (GDPR-compliant), och delar aldrig information med tredje part.',
  },
  {
    question: 'Vilka lagar täcker ni?',
    answer:
      '10 000+ svenska lagar och förordningar från Riksdagen, relevanta EU-direktiv och rättsfall. Systemet uppdateras dagligen.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-12 text-center">
            <h2
              className="font-safiro mb-4 text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
            >
              Vanliga frågor
            </h2>
            <p className="text-muted-foreground">
              Har du fler frågor?{' '}
              <a
                href="mailto:support@laglig.se"
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
