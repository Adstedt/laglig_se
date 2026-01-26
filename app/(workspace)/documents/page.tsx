/**
 * Story 6.7b: Documents Page (Root Level)
 * Shows files and folders at the root level of the workspace
 */

import DocumentsBrowser from './_components/documents-browser'

export default function DocumentsPage() {
  return <DocumentsBrowser initialFolderId={null} />
}
