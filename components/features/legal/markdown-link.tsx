import Link from 'next/link'
import type { ComponentPropsWithoutRef } from 'react'

// Wraps internal hrefs (anything starting with `/`) in Next.js <Link> for
// client-side nav, leaves external URLs as plain anchors with rel/target set.
// Used as the `a` override in the legal-doc <ReactMarkdown components> map.
//
// We deliberately don't forward ...props onto the Next.js <Link>: tsconfig's
// exactOptionalPropertyTypes rejects HTMLAnchor props that can be undefined.
// react-markdown only sets href+children on these links anyway, and styling
// is handled by the .doc a rule in legal.css — there's nothing to forward.
export function MarkdownLink({
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<'a'>) {
  if (!href) {
    return <a {...props}>{children}</a>
  }
  const isInternal = href.startsWith('/') && !href.startsWith('//')
  if (isInternal) {
    return <Link href={href}>{children}</Link>
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  )
}
