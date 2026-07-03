/** Highlighted definition callout for topic pages (/omraden) — answers the
 *  "vad är X?" intent right under the first H2, quotable width like the prose
 *  column so it reads as part of the article, not a full-bleed section. */
export function DefinitionBox({
  term,
  source,
  children,
}: {
  term: string
  source?: string
  children: React.ReactNode
}) {
  return (
    <aside className="mx-auto mt-6 w-full max-w-3xl px-4">
      <div className="rounded-2xl border border-border bg-section-cream p-6 sm:p-7">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Definition
        </p>
        <p className="mt-2 font-safiro text-lg font-medium tracking-tight text-foreground">
          {term}
        </p>
        <div className="mt-2 text-[15px] leading-relaxed text-muted-foreground sm:text-base [&>p]:mt-2 [&>p:first-child]:mt-0">
          {children}
        </div>
        {source && (
          <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
            {source}
          </p>
        )}
      </div>
    </aside>
  )
}
