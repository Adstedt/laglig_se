/**
 * Story 6.7a: File Management Components
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
