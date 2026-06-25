import type { ReactNode } from 'react'

/**
 * Standfirst/deck for a marketing article's lede. Authors wrap the opening
 * sentence in `<Lead>…</Lead>` in MDX; Prettier reflows that to block form, so
 * the child is a real `<p>` (which keeps the centered PROSE width from the
 * global `p` mapping in mdx-components.tsx). We restyle that child here — bigger
 * and in the ink color — via `[&>p]`, so the lede reads as an intentional intro
 * rather than orphaned body text under the hero, with no heading competing with
 * the H1.
 *
 * Lives under components/ (not inline in mdx-components.tsx) so Tailwind's
 * content scan actually generates these `[&>p]:` arbitrary-variant utilities —
 * the repo root is outside the content globs.
 */
export function Lead({ children }: { children: ReactNode }) {
  return (
    <div className="[&>p]:mb-2 [&>p]:mt-1 [&>p]:text-lg [&>p]:leading-relaxed [&>p]:text-foreground/90 sm:[&>p]:text-xl">
      {children}
    </div>
  )
}
