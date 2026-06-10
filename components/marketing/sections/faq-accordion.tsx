import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { FaqItem } from '@/lib/marketing/frontmatter-schemas'

/**
 * Page FAQ — rendered on EVERY marketing page (faq frontmatter is required,
 * min 3 items). The same array feeds FAQPage JSON-LD via
 * getMarketingJsonLd(), so visible content and structured data can't drift.
 */
export function FaqAccordion({
  heading = 'Vanliga frågor',
  items,
}: {
  heading?: string | undefined
  items: FaqItem[]
}) {
  return (
    <section className="container mx-auto px-4 py-14 md:py-20">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-8 text-center font-safiro text-2xl font-medium tracking-tight text-foreground md:text-3xl">
          {heading}
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {items.map((item, i) => (
            <AccordionItem key={item.question} value={`faq-${i}`}>
              <AccordionTrigger className="text-left font-safiro text-[15px] font-medium">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
