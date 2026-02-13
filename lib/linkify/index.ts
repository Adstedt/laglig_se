/**
 * Legal reference linkification utilities
 *
 * Detects references to Swedish laws, agency regulations, and court cases
 * in HTML content and injects navigable links.
 */

export { detectReferences, type DetectedReference } from './detect-references'

export {
  linkifyHtmlContent,
  type LinkifyResult,
  type LinkedReference,
} from './linkify-html'

export { buildSlugMap, type SlugMap, type SlugMapEntry } from './build-slug-map'

export { saveCrossReferences } from './save-cross-references'

export { rewriteLinksForWorkspace } from './rewrite-links'
