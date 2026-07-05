import type { MDXComponents } from 'mdx/types'
import Link from 'next/link'
import { SplitFeature } from '@/components/marketing/sections/split-feature'
import { ScreenshotFrame } from '@/components/marketing/media/screenshot-frame'
import { FeatureGrid } from '@/components/marketing/sections/feature-grid'
import { ProofBlock } from '@/components/marketing/sections/proof-block'
import { DefinitionBox } from '@/components/marketing/sections/definition-box'
import { ProcessSteps } from '@/components/marketing/sections/process-steps'
import { Lead } from '@/components/marketing/mdx/lead'

/**
 * Global MDX component map — required by @next/mdx with the App Router.
 *
 * Maps markdown elements in content/marketing/*.mdx to the brand typography:
 * Safiro (font-medium, never bolder) for headings, Google Sans Flex (the
 * body default) for prose. Spacing is tuned for the marketing article column,
 * not the app shell.
 */
// Prose elements center at a readable width; inline section components
// (<SplitFeature> etc.) render full-width because they are NOT wrapped here.
// (Story 26.4 — bridge-row layout.)
const PROSE = 'mx-auto w-full max-w-3xl px-4'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: ({ children, ...props }) => (
      <h2
        className={`${PROSE} mt-12 font-safiro text-2xl font-medium tracking-tight text-foreground sm:text-3xl`}
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3
        className={`${PROSE} mt-8 font-safiro text-xl font-medium tracking-tight text-foreground`}
        {...props}
      >
        {children}
      </h3>
    ),
    p: ({ children, ...props }) => (
      <p
        className={`${PROSE} mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base`}
        {...props}
      >
        {children}
      </p>
    ),
    ul: ({ children, ...props }) => (
      <ul
        className={`${PROSE} mt-4 list-disc space-y-2 pl-9 text-[15px] leading-relaxed text-muted-foreground sm:text-base`}
        {...props}
      >
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol
        className={`${PROSE} mt-4 list-decimal space-y-2 pl-9 text-[15px] leading-relaxed text-muted-foreground sm:text-base`}
        {...props}
      >
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => <li {...props}>{children}</li>,
    a: ({ href, children, ...props }) => (
      <Link
        href={href ?? '#'}
        className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
        {...props}
      >
        {children}
      </Link>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-semibold text-foreground" {...props}>
        {children}
      </strong>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote
        className={`${PROSE} mt-6 border-l-2 border-amber-400 italic text-muted-foreground`}
        {...props}
      >
        {children}
      </blockquote>
    ),
    hr: (props) => <hr className={`${PROSE} my-10 border-border`} {...props} />,
    h4: ({ children, ...props }) => (
      <h4
        className={`${PROSE} mt-6 font-safiro text-lg font-medium tracking-tight text-foreground`}
        {...props}
      >
        {children}
      </h4>
    ),
    table: ({ children, ...props }) => (
      <div className={`${PROSE} mt-6 overflow-x-auto`}>
        <table
          className="w-full border-collapse text-left text-[15px] text-muted-foreground"
          {...props}
        >
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th
        className="border-b border-border py-2 pr-4 font-safiro font-medium text-foreground"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="border-b border-border py-2 pr-4 align-top" {...props}>
        {children}
      </td>
    ),
    pre: ({ children, ...props }) => (
      <pre
        className={`${PROSE} mt-6 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-sm`}
        {...props}
      >
        {children}
      </pre>
    ),
    code: ({ children, ...props }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...props}>
        {children}
      </code>
    ),
    // Standfirst/deck for the article lede (see components/marketing/mdx/lead).
    Lead,
    // Marketing section components usable inline in any MDX body (Story 26.4
    // bridge rows). These render full-width — they are not PROSE-wrapped.
    SplitFeature,
    ScreenshotFrame,
    FeatureGrid,
    ProofBlock,
    DefinitionBox,
    ProcessSteps,
    ...components,
  }
}
