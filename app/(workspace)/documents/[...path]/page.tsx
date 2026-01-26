/**
 * Story 6.7b: Dynamic Folder Route
 * AC: 32, 33 - URL-based folder navigation supporting paths like /documents/Projekt/2024
 */

import { notFound } from 'next/navigation'
import { resolveFolderFromPath, getFolderPath } from '@/app/actions/files'
import DocumentsBrowser from '../_components/documents-browser'

interface PageProps {
  params: Promise<{ path?: string[] }>
}

export default async function DocumentsFolderPage({ params }: PageProps) {
  const { path } = await params

  // Resolve folder from path segments
  const pathSegments = path ?? []
  const folderResult = await resolveFolderFromPath(pathSegments)

  if (!folderResult.success) {
    notFound()
  }

  const folderId = folderResult.data?.id ?? null

  // Get breadcrumb path
  const breadcrumbResult = await getFolderPath(folderId)
  const breadcrumbs = breadcrumbResult.success
    ? (breadcrumbResult.data ?? [])
    : []

  return (
    <DocumentsBrowser
      initialFolderId={folderId}
      initialBreadcrumbs={breadcrumbs}
    />
  )
}
