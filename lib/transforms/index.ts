/**
 * Document transformation utilities
 * Story 2.29: Deterministic transforms for deriving content formats
 */

export {
  htmlToMarkdown,
  htmlToPlainText,
  type HtmlToMarkdownOptions,
} from './html-to-markdown'

export {
  htmlToJson,
  parseHtmlToJson,
  type LegalDocumentJson,
  type Section,
  type TransitionProvision,
  type Footnote,
  type Definition,
  type DocumentMetadata,
  type HtmlToJsonOptions,
} from './html-to-json'
