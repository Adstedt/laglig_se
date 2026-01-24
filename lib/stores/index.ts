/**
 * Story P.4: Store Exports
 *
 * Central export point for all Zustand stores.
 */

// Workspace state management
export {
  useWorkspaceStore,
  useCurrentWorkspace,
  useWorkspaceMembers,
  useLawLists,
  useUserPreferences,
  useWorkspaceRole,
} from './workspace-store'

// UI state management
export {
  useUIStore,
  useSidebarCollapsed,
  useSidebarMobileOpen,
  useActiveModal,
  useCommandPaletteOpen,
  useFilterPanelOpen,
  useUIActions,
  type ModalType,
} from './ui-store'

// Document list state management
export {
  useDocumentListStore,
  type ViewMode,
  type ListCacheEntry,
  type DocumentInfo,
} from './document-list-store'

// Layout state
export { useLayoutStore } from './layout-store'
