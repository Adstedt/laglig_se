import type { ReactNode } from 'react'

/**
 * Standfirst/deck for a marketing article's lede. Authors wrap the opening
 * sentence in `<Lead>…</Lead>` in MDX. We restyle it — bigger and in the ink
 * color — so the lede reads as an intentional intro rather than orphaned body
 * text under the hero, with no heading competing with the H1.
 *
 * This wrapper owns the centered PROSE width itself (`mx-auto max-w-3xl px-4`),
 * so the lede aligns with the body column regardless of how MDX renders the
 * child: block form (`<Lead>` with the sentence on its own line) wraps it in a
 * real `<p>`, while inline form (`<Lead>…</Lead>` on one line) leaves bare text
 * with no `<p>`. The `[&>p]` rules restyle that inner `<p>` when present and
 * strip its own PROSE width/margins so it doesn't double up on this wrapper.
 * (Previously the width lived only on the inner `<p>`, so the inline form had no
 * `<p>` and the text bled flush-left to the viewport edge.)
 *
 * Lives under components/ (not inline in mdx-components.tsx) so Tailwind's
 * content scan actually generates these `[&>p]:` arbitrary-variant utilities —
 * the repo root is outside the content globs.
 */
export function Lead({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto mb-2 mt-1 w-full max-w-3xl px-4 text-lg leading-relaxed text-foreground/90 sm:text-xl [&>p]:m-0 [&>p]:max-w-none [&>p]:px-0 [&>p]:text-lg [&>p]:leading-relaxed [&>p]:text-foreground/90 sm:[&>p]:text-xl">
      {children}
    </div>
  )
}
