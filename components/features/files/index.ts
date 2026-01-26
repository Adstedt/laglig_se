/**
 * Story 6.7a & 6.7b: File Management Components
 * Exports all file-related components and utilities
 */

// Components
export { FileDropzone } from './file-dropzone'
export {
  FileCard,
  FileCardSkeleton,
  categoryLabels,
  categoryColors,
} from './file-card'
export { FilePreviewPanel } from './file-preview-panel'
export { FilePickerModal } from './file-picker-modal'
export { FileLinkModal } from './file-link-modal'

// Story 6.7b: Folder components
export { FolderTree, FolderTreeSkeleton } from './folder-tree'
export { FolderBreadcrumb, FolderBreadcrumbSimple } from './folder-breadcrumb'
export { FolderContextMenu } from './folder-context-menu'
export { MoveToModal } from './move-to-modal'

// Story 6.7b: Preview components
export {
  ImagePreview,
  ImagePreviewCompact,
  PdfPreview,
  PdfThumbnail,
  OfficePreview,
  OfficeFallback,
  FileLightbox,
  ImageLightbox,
  MetadataPanel,
} from './preview'
export { QuickPreview, useQuickPreview } from './quick-preview'

// Story 6.7b: Enhanced list view
export { FileListView, getFileTypeLabel } from './file-list-view'
export type { SortField, SortDirection } from './file-list-view'

// Utilities
export {
  MAX_FILE_SIZE,
  MAX_FILES,
  ACCEPTED_TYPES,
  ACCEPT_STRING,
  getFileIcon,
  formatFileSize,
  validateFile,
} from './file-dropzone'

// Types
export type { UploadingFile, FileDropzoneProps } from './file-dropzone'
