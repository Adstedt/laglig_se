export interface ProcessStep {
  title: string
  description: string
}

/** Vertical numbered step list with a connector line — for principles,
 *  procedures and "så gör ni"-sequences in topic-page bodies. Sits in the
 *  prose column since it belongs to the article flow. */
export function ProcessSteps({
  heading,
  steps,
}: {
  heading?: string | undefined
  steps: ProcessStep[]
}) {
  return (
    <section className="mx-auto mt-8 w-full max-w-3xl px-4">
      {heading && (
        <h3 className="font-safiro text-xl font-medium tracking-tight text-foreground">
          {heading}
        </h3>
      )}
      <ol className={heading ? 'mt-6' : ''}>
        {steps.map((step, i) => (
          <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className="absolute left-4 top-9 h-[calc(100%-2.5rem)] w-px bg-border"
              />
            )}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary font-safiro text-sm font-medium text-foreground">
              {i + 1}
            </span>
            <div className="pt-1">
              <p className="font-safiro text-base font-medium text-foreground">
                {step.title}
              </p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
