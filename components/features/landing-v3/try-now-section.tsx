import { OrgCheckForm } from './org-check-form'
import { SubLabel } from './section-label'

/**
 * Mid-page conversion moment — wraps the org-number form widget that used to
 * live in the hero. Sits after the value-prop sections but before pricing,
 * so the user has seen what the product does and is now invited to try it.
 *
 * Linear pulls a similar move: hero is product-first, the actual "try it"
 * surface lives deeper in the page where buying intent has built up.
 */
export function TryNowSection() {
  return (
    <section
      id="testa"
      className="relative scroll-mt-16 overflow-hidden border-y bg-section-cream py-16 md:py-24"
    >
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <SubLabel className="mb-3">Testa direkt · 30 sekunder</SubLabel>
            <h2
              className="mb-4 text-3xl font-medium tracking-tight md:text-4xl lg:text-5xl"
              style={{ fontFamily: "'Safiro', system-ui, sans-serif" }}
            >
              Vilka regler gäller ert företag?
            </h2>
            <p className="mx-auto max-w-xl text-base text-muted-foreground md:text-lg">
              Skriv in ert organisationsnummer så ser ni direkt vad ni behöver
              ha koll på. Lägg till en webbplats för en mer träffsäker bild.
            </p>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-6 -inset-y-4 rounded-3xl bg-gradient-to-br from-amber-100/30 via-orange-50/20 to-transparent blur-3xl"
            />
            <div className="relative rounded-2xl border border-border/60 bg-card p-6 shadow-xl md:p-8">
              <OrgCheckForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
