import { promises as fs } from 'node:fs'
import path from 'node:path'

import matter from 'gray-matter'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { getLegalDoc, type LegalDocSlug } from './legal-doc-registry'
import { MarkdownLink } from './markdown-link'

interface LegalDocProps {
  slug: LegalDocSlug
}

// Server component. Reads the markdown file at build/request time and renders
// it through react-markdown + remark-gfm. The DOM produced here is styled by
// the .doc * rules in app/(public)/(legal)/legal.css — no Tailwind class soup
// in the output, just semantic HTML.
export async function LegalDoc({ slug }: LegalDocProps) {
  const doc = getLegalDoc(slug)
  const filePath = path.join(process.cwd(), 'docs', 'legal', doc.file)
  const raw = await fs.readFile(filePath, 'utf-8')
  const { data, content } = matter(raw)

  // Drop the leading H1 and the "Senast uppdaterad" line — both are re-rendered
  // by the page chrome (hero + meta badge), so we strip them from the body to
  // avoid duplication. trimStart() handles the blank line gray-matter may leave
  // between frontmatter and body.
  const body = content
    .trimStart()
    .replace(/^#\s+.+\n+/, '') // first h1
    .replace(/^\*\*Senast uppdaterad:\*\*[^\n]*\n+/, '')
    .trimStart()

  const lastUpdated =
    typeof data['last-updated'] === 'string'
      ? data['last-updated']
      : data['last-updated'] instanceof Date
        ? data['last-updated'].toISOString().slice(0, 10)
        : null

  return (
    <article className="doc-container min-w-0">
      <div className="doc-meta">
        {lastUpdated && (
          <span className="text-stone-500">
            Senast uppdaterad{' '}
            <span className="text-stone-700">{lastUpdated}</span>
          </span>
        )}
      </div>
      <h1 className="display doc-title">{doc.title}</h1>
      <p className="doc-subtitle">{doc.subtitle}</p>

      <div className="doc mt-8">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node: _node, ...props }) => <MarkdownLink {...props} />,
          }}
        >
          {body}
        </ReactMarkdown>
      </div>
    </article>
  )
}
