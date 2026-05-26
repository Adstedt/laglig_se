import { OrgCheckForm } from './org-check-form'

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
    <section className="relative overflow-hidden border-y bg-section-cream py-16 md:py-24">
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Testa direkt · 30 sekunder
            </p>
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
              <p className="mt-4 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
                Sen bygger vi er egen laglista – med allt ni behöver göra,
                samlat och klart.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
