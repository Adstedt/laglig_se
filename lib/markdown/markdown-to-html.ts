import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkHtml from 'remark-html'

/**
 * Story 14.22: convert agent-authored markdown to the HTML expected by the task
 * description rich-text field.
 *
 * The agent emits markdown (`**bold**`, numbered/bulleted lists, paragraphs),
 * but `Task.description` is a rich-text/HTML field rendered by `RichTextDisplay`
 * via `dangerouslySetInnerHTML`. Storing raw markdown there collapses newlines
 * and shows literal `**`. This bridges the formats on the agent's create path.
 *
 * The render path (`RichTextDisplay`) DOMPurify-sanitizes to a tag allowlist —
 * that is the XSS trust boundary — so this produces clean HTML for that consumer
 * without needing a server-side sanitizer. Used only on the agent path; tasks
 * authored in the editor already store HTML.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return ''
  return remark()
    .use(remarkGfm)
    .use(remarkHtml)
    .processSync(markdown)
    .toString()
    .trim()
}
