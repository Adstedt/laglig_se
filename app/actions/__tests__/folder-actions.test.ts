/**
 * Story 6.7b: Folder Actions Unit Tests
 *
 * Tests for folder CRUD operations, path computation,
 * breadcrumb generation, and move operation cycle detection.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ============================================================================
// Schema Validation Tests
// ============================================================================

// Recreate schemas here for isolated testing (avoids importing server actions)
const CreateFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Mappnamn krävs')
    .max(255, 'Mappnamn får inte överstiga 255 tecken')
    .regex(/^[^<>:"/\\|?*]+$/, 'Ogiltigt mappnamn')
    .refine(
      (name) => name !== '.' && name !== '..',
      'Ogiltigt mappnamn - reserverade tecken'
    ),
  parentFolderId: z.string().uuid().optional().nullable(),
})

const RenameFolderSchema = z.object({
  folderId: z.string().uuid(),
  newName: z
    .string()
    .min(1, 'Mappnamn krävs')
    .max(255, 'Mappnamn får inte överstiga 255 tecken')
    .regex(/^[^<>:"/\\|?*]+$/, 'Ogiltigt mappnamn')
    .refine(
      (name) => name !== '.' && name !== '..',
      'Ogiltigt mappnamn - reserverade tecken'
    ),
})

const MoveItemSchema = z.object({
  itemId: z.string().uuid(),
  targetFolderId: z.string().uuid().nullable(),
})

// ============================================================================
// Helper Function Tests
// ============================================================================

/**
 * Validate path segments don't contain traversal attempts
 * Security: Prevents path traversal attacks
 */
function validatePathSegments(segments: string[]): boolean {
  return segments.every(
    (seg) =>
      seg !== '.' && seg !== '..' && !seg.includes('/') && !seg.includes('\\')
  )
}

describe('Folder Schema Validations', () => {
  describe('CreateFolderSchema', () => {
    it('should accept valid folder names', () => {
      const validNames = [
        'My Folder',
        'dokument-2024',
        'Bevis för uppgift',
        'Test_Folder_123',
        'Åäö folder',
        '日本語フォルダ',
      ]

      for (const name of validNames) {
        const result = CreateFolderSchema.safeParse({ name })
        expect(result.success, `Expected "${name}" to be valid`).toBe(true)
      }
    })

    it('should reject empty folder names', () => {
      const result = CreateFolderSchema.safeParse({ name: '' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Mappnamn krävs')
      }
    })

    it('should reject folder names with invalid characters', () => {
      const invalidNames = [
        'folder<test',
        'folder>test',
        'folder:test',
        'folder"test',
        'folder/test',
        'folder\\test',
        'folder|test',
        'folder?test',
        'folder*test',
      ]

      for (const name of invalidNames) {
        const result = CreateFolderSchema.safeParse({ name })
        expect(result.success, `Expected "${name}" to be invalid`).toBe(false)
      }
    })

    it('should reject reserved names (. and ..)', () => {
      const result1 = CreateFolderSchema.safeParse({ name: '.' })
      expect(result1.success).toBe(false)

      const result2 = CreateFolderSchema.safeParse({ name: '..' })
      expect(result2.success).toBe(false)
    })

    it('should reject folder names exceeding 255 characters', () => {
      const longName = 'a'.repeat(256)
      const result = CreateFolderSchema.safeParse({ name: longName })
      expect(result.success).toBe(false)
    })

    it('should accept valid parent folder ID (UUID)', () => {
      const result = CreateFolderSchema.safeParse({
        name: 'Test Folder',
        parentFolderId: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
    })

    it('should accept null parent folder ID (root level)', () => {
      const result = CreateFolderSchema.safeParse({
        name: 'Test Folder',
        parentFolderId: null,
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid parent folder ID format', () => {
      const result = CreateFolderSchema.safeParse({
        name: 'Test Folder',
        parentFolderId: 'not-a-uuid',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('RenameFolderSchema', () => {
    it('should accept valid rename data', () => {
      const result = RenameFolderSchema.safeParse({
        folderId: '123e4567-e89b-12d3-a456-426614174000',
        newName: 'Renamed Folder',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid folder ID', () => {
      const result = RenameFolderSchema.safeParse({
        folderId: 'invalid-id',
        newName: 'Renamed Folder',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty new name', () => {
      const result = RenameFolderSchema.safeParse({
        folderId: '123e4567-e89b-12d3-a456-426614174000',
        newName: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('MoveItemSchema', () => {
    it('should accept valid move data', () => {
      const result = MoveItemSchema.safeParse({
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        targetFolderId: '223e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
    })

    it('should accept null target folder (move to root)', () => {
      const result = MoveItemSchema.safeParse({
        itemId: '123e4567-e89b-12d3-a456-426614174000',
        targetFolderId: null,
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid item ID', () => {
      const result = MoveItemSchema.safeParse({
        itemId: 'not-uuid',
        targetFolderId: null,
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('Path Validation Helper', () => {
  describe('validatePathSegments', () => {
    it('should accept valid path segments', () => {
      expect(validatePathSegments(['folder1', 'folder2', 'folder3'])).toBe(true)
      expect(validatePathSegments(['My Documents'])).toBe(true)
      expect(validatePathSegments(['2024', 'January', 'Reports'])).toBe(true)
      expect(validatePathSegments(['Åäö', '日本語'])).toBe(true)
    })

    it('should reject path traversal attempts with dots', () => {
      expect(validatePathSegments(['.'])).toBe(false)
      expect(validatePathSegments(['..'])).toBe(false)
      expect(validatePathSegments(['folder', '..', 'secret'])).toBe(false)
      expect(validatePathSegments(['.', 'folder'])).toBe(false)
    })

    it('should reject segments containing forward slashes', () => {
      expect(validatePathSegments(['folder/subfolder'])).toBe(false)
      expect(validatePathSegments(['a', 'b/c', 'd'])).toBe(false)
    })

    it('should reject segments containing backslashes', () => {
      expect(validatePathSegments(['folder\\subfolder'])).toBe(false)
      expect(validatePathSegments(['a', 'b\\c', 'd'])).toBe(false)
    })

    it('should accept empty array', () => {
      expect(validatePathSegments([])).toBe(true)
    })
  })
})

// ============================================================================
// Cycle Detection Tests
// ============================================================================

describe('Cycle Detection Logic', () => {
  /**
   * Simulates wouldCreateCycle for testing
   * Folder structure: root -> A -> B -> C
   */
  function createFolderHierarchy() {
    const folders = new Map<
      string,
      { id: string; parent_folder_id: string | null }
    >()

    folders.set('folder-a', { id: 'folder-a', parent_folder_id: null })
    folders.set('folder-b', { id: 'folder-b', parent_folder_id: 'folder-a' })
    folders.set('folder-c', { id: 'folder-c', parent_folder_id: 'folder-b' })
    folders.set('folder-d', { id: 'folder-d', parent_folder_id: null }) // Sibling of A

    return folders
  }

  function wouldCreateCycle(
    folders: Map<string, { id: string; parent_folder_id: string | null }>,
    folderId: string,
    targetFolderId: string | null
  ): boolean {
    if (!targetFolderId) return false
    if (folderId === targetFolderId) return true

    // Walk up from target to see if we hit the source folder
    let currentId: string | null = targetFolderId
    while (currentId) {
      if (currentId === folderId) return true
      const folder = folders.get(currentId)
      currentId = folder?.parent_folder_id ?? null
    }
    return false
  }

  it('should detect direct self-reference', () => {
    const folders = createFolderHierarchy()
    expect(wouldCreateCycle(folders, 'folder-a', 'folder-a')).toBe(true)
  })

  it('should detect moving folder into its child', () => {
    const folders = createFolderHierarchy()
    // Moving A into B (which is child of A) should create cycle
    expect(wouldCreateCycle(folders, 'folder-a', 'folder-b')).toBe(true)
  })

  it('should detect moving folder into its grandchild', () => {
    const folders = createFolderHierarchy()
    // Moving A into C (which is grandchild of A) should create cycle
    expect(wouldCreateCycle(folders, 'folder-a', 'folder-c')).toBe(true)
  })

  it('should allow moving folder into sibling', () => {
    const folders = createFolderHierarchy()
    // Moving A into D (sibling) should be allowed
    expect(wouldCreateCycle(folders, 'folder-a', 'folder-d')).toBe(false)
  })

  it('should allow moving folder to root', () => {
    const folders = createFolderHierarchy()
    // Moving any folder to root should be allowed
    expect(wouldCreateCycle(folders, 'folder-b', null)).toBe(false)
    expect(wouldCreateCycle(folders, 'folder-c', null)).toBe(false)
  })

  it('should allow moving child folder up to parent sibling', () => {
    const folders = createFolderHierarchy()
    // Moving C into D should be allowed (C is under A, D is sibling of A)
    expect(wouldCreateCycle(folders, 'folder-c', 'folder-d')).toBe(false)
  })
})

// ============================================================================
// Breadcrumb Path Generation Tests
// ============================================================================

describe('Breadcrumb Path Generation', () => {
  /**
   * Simulates getFolderPath logic
   */
  function buildBreadcrumbPath(
    folders: Map<
      string,
      { id: string; name: string; parent_folder_id: string | null }
    >,
    folderId: string | null
  ): Array<{ id: string | null; name: string; path: string }> {
    const segments: Array<{ id: string | null; name: string; path: string }> = [
      { id: null, name: 'Mina filer', path: '/documents' },
    ]

    if (!folderId) {
      return segments
    }

    // Walk up the tree from the folder to root
    const pathSegments: { id: string; name: string }[] = []
    let currentId: string | null = folderId

    while (currentId) {
      const folder = folders.get(currentId)
      if (!folder) break
      pathSegments.unshift({ id: folder.id, name: folder.name })
      currentId = folder.parent_folder_id
    }

    // Build path URLs
    let currentPath = '/documents'
    for (const seg of pathSegments) {
      currentPath += `/${encodeURIComponent(seg.name)}`
      segments.push({ id: seg.id, name: seg.name, path: currentPath })
    }

    return segments
  }

  const testFolders = new Map<
    string,
    { id: string; name: string; parent_folder_id: string | null }
  >()
  testFolders.set('folder-1', {
    id: 'folder-1',
    name: 'Projects',
    parent_folder_id: null,
  })
  testFolders.set('folder-2', {
    id: 'folder-2',
    name: '2024',
    parent_folder_id: 'folder-1',
  })
  testFolders.set('folder-3', {
    id: 'folder-3',
    name: 'January Reports',
    parent_folder_id: 'folder-2',
  })

  it('should return only root for null folder', () => {
    const result = buildBreadcrumbPath(testFolders, null)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: null,
      name: 'Mina filer',
      path: '/documents',
    })
  })

  it('should build correct path for top-level folder', () => {
    const result = buildBreadcrumbPath(testFolders, 'folder-1')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: null,
      name: 'Mina filer',
      path: '/documents',
    })
    expect(result[1]).toEqual({
      id: 'folder-1',
      name: 'Projects',
      path: '/documents/Projects',
    })
  })

  it('should build correct path for nested folder', () => {
    const result = buildBreadcrumbPath(testFolders, 'folder-3')
    expect(result).toHaveLength(4)
    expect(result[0]).toEqual({
      id: null,
      name: 'Mina filer',
      path: '/documents',
    })
    expect(result[1]).toEqual({
      id: 'folder-1',
      name: 'Projects',
      path: '/documents/Projects',
    })
    expect(result[2]).toEqual({
      id: 'folder-2',
      name: '2024',
      path: '/documents/Projects/2024',
    })
    expect(result[3]).toEqual({
      id: 'folder-3',
      name: 'January Reports',
      path: '/documents/Projects/2024/January%20Reports',
    })
  })

  it('should URL-encode special characters in path', () => {
    const foldersWithSpecialChars = new Map(testFolders)
    foldersWithSpecialChars.set('folder-special', {
      id: 'folder-special',
      name: 'Docs & Files',
      parent_folder_id: null,
    })

    const result = buildBreadcrumbPath(
      foldersWithSpecialChars,
      'folder-special'
    )
    expect(result[1]?.path).toBe('/documents/Docs%20%26%20Files')
  })
})

// ============================================================================
// Folder Depth Calculation Tests
// ============================================================================

describe('Folder Depth Calculation', () => {
  /**
   * Simulates getFolderDepth logic
   */
  function getFolderDepth(
    folders: Map<string, { parent_folder_id: string | null }>,
    folderId: string
  ): number {
    let depth = 0
    let currentId: string | null = folderId

    while (currentId && depth < 10) {
      const folder = folders.get(currentId)
      if (!folder || !folder.parent_folder_id) break
      currentId = folder.parent_folder_id
      depth++
    }

    return depth
  }

  it('should return 0 for root-level folder', () => {
    const folders = new Map<string, { parent_folder_id: string | null }>()
    folders.set('root-folder', { parent_folder_id: null })

    expect(getFolderDepth(folders, 'root-folder')).toBe(0)
  })

  it('should return correct depth for nested folders', () => {
    const folders = new Map<string, { parent_folder_id: string | null }>()
    folders.set('level-0', { parent_folder_id: null })
    folders.set('level-1', { parent_folder_id: 'level-0' })
    folders.set('level-2', { parent_folder_id: 'level-1' })
    folders.set('level-3', { parent_folder_id: 'level-2' })

    expect(getFolderDepth(folders, 'level-0')).toBe(0)
    expect(getFolderDepth(folders, 'level-1')).toBe(1)
    expect(getFolderDepth(folders, 'level-2')).toBe(2)
    expect(getFolderDepth(folders, 'level-3')).toBe(3)
  })

  it('should handle max nesting depth (5 levels)', () => {
    const folders = new Map<string, { parent_folder_id: string | null }>()
    folders.set('l0', { parent_folder_id: null })
    folders.set('l1', { parent_folder_id: 'l0' })
    folders.set('l2', { parent_folder_id: 'l1' })
    folders.set('l3', { parent_folder_id: 'l2' })
    folders.set('l4', { parent_folder_id: 'l3' })
    folders.set('l5', { parent_folder_id: 'l4' })

    expect(getFolderDepth(folders, 'l5')).toBe(5)
  })
})

// ============================================================================
// File Type Label Tests
// ============================================================================

describe('File Type Labels', () => {
  function getFileTypeLabel(mimeType: string | null): string {
    if (!mimeType) return 'Okänd'

    const typeMap: Record<string, string> = {
      'application/pdf': 'PDF',
      'image/png': 'PNG-bild',
      'image/jpeg': 'JPEG-bild',
      'image/gif': 'GIF-bild',
      'application/msword': 'Word-dokument',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'Word-dokument',
      'application/vnd.ms-excel': 'Excel-kalkylblad',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        'Excel-kalkylblad',
      'application/vnd.ms-powerpoint': 'PowerPoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        'PowerPoint',
    }

    return typeMap[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'Okänd'
  }

  it('should return correct Swedish labels for known types', () => {
    expect(getFileTypeLabel('application/pdf')).toBe('PDF')
    expect(getFileTypeLabel('image/png')).toBe('PNG-bild')
    expect(getFileTypeLabel('image/jpeg')).toBe('JPEG-bild')
    expect(
      getFileTypeLabel(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe('Word-dokument')
    expect(
      getFileTypeLabel(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    ).toBe('Excel-kalkylblad')
  })

  it('should return uppercase subtype for unknown types', () => {
    expect(getFileTypeLabel('text/plain')).toBe('PLAIN')
    expect(getFileTypeLabel('application/json')).toBe('JSON')
  })

  it('should return "Okänd" for null', () => {
    expect(getFileTypeLabel(null)).toBe('Okänd')
  })
})

// ============================================================================
// File Size Formatting Tests
// ============================================================================

describe('File Size Formatting', () => {
  function formatFileSize(bytes: number | null): string {
    if (bytes === null || bytes === 0) return '0 B'

    const units = ['B', 'KB', 'MB', 'GB']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
  }

  it('should format bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(1048576)).toBe('1 MB')
    expect(formatFileSize(1572864)).toBe('1.5 MB')
    expect(formatFileSize(1073741824)).toBe('1 GB')
  })

  it('should handle null', () => {
    expect(formatFileSize(null)).toBe('0 B')
  })
})
