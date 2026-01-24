/**
 * Story P.4: UI State Store
 *
 * Manages UI state for modals, sidebars, and other transient UI elements.
 * Uses Zustand for minimal re-renders via selective subscriptions.
 */

import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'

// ============================================================================
// Types
// ============================================================================

export type ModalType =
  | 'addDocument'
  | 'manageList'
  | 'taskDetail'
  | 'createTask'
  | 'settings'
  | 'invite'
  | 'exportList'
  | 'confirmDelete'
  | null

interface UIState {
  // Sidebar state
  sidebarCollapsed: boolean
  sidebarMobileOpen: boolean

  // Modal state
  activeModal: ModalType
  modalData: Record<string, unknown>

  // Toast/notification queue (managed by sonner, this is for persistence)
  pendingNotifications: Array<{
    id: string
    message: string
    type: 'success' | 'error' | 'info'
    timestamp: number
  }>

  // Command palette
  commandPaletteOpen: boolean

  // Filter panel state
  filterPanelOpen: boolean

  // Actions
  toggleSidebar: () => void
  setSidebarCollapsed: (_collapsed: boolean) => void
  setSidebarMobileOpen: (_open: boolean) => void
  openModal: (_type: ModalType, _data?: Record<string, unknown>) => void
  closeModal: () => void
  setCommandPaletteOpen: (_open: boolean) => void
  toggleFilterPanel: () => void
  setFilterPanelOpen: (_open: boolean) => void
  addNotification: (
    _message: string,
    _type: 'success' | 'error' | 'info'
  ) => string
  removeNotification: (_id: string) => void
  clearNotifications: () => void
}

// ============================================================================
// Store
// ============================================================================

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        sidebarCollapsed: false,
        sidebarMobileOpen: false,
        activeModal: null,
        modalData: {},
        pendingNotifications: [],
        commandPaletteOpen: false,
        filterPanelOpen: true,

        // Sidebar actions
        toggleSidebar: () =>
          set(
            (state) => ({ sidebarCollapsed: !state.sidebarCollapsed }),
            false,
            'toggleSidebar'
          ),

        setSidebarCollapsed: (collapsed) =>
          set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed'),

        setSidebarMobileOpen: (open) =>
          set({ sidebarMobileOpen: open }, false, 'setSidebarMobileOpen'),

        // Modal actions
        openModal: (type, data = {}) =>
          set({ activeModal: type, modalData: data }, false, 'openModal'),

        closeModal: () =>
          set({ activeModal: null, modalData: {} }, false, 'closeModal'),

        // Command palette
        setCommandPaletteOpen: (open) =>
          set({ commandPaletteOpen: open }, false, 'setCommandPaletteOpen'),

        // Filter panel
        toggleFilterPanel: () =>
          set(
            (state) => ({ filterPanelOpen: !state.filterPanelOpen }),
            false,
            'toggleFilterPanel'
          ),

        setFilterPanelOpen: (open) =>
          set({ filterPanelOpen: open }, false, 'setFilterPanelOpen'),

        // Notification actions
        addNotification: (message, type) => {
          const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          set(
            (state) => ({
              pendingNotifications: [
                ...state.pendingNotifications,
                { id, message, type, timestamp: Date.now() },
              ],
            }),
            false,
            'addNotification'
          )
          return id
        },

        removeNotification: (id) =>
          set(
            (state) => ({
              pendingNotifications: state.pendingNotifications.filter(
                (n) => n.id !== id
              ),
            }),
            false,
            'removeNotification'
          ),

        clearNotifications: () =>
          set({ pendingNotifications: [] }, false, 'clearNotifications'),
      }),
      {
        name: 'ui-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // Only persist these UI preferences
          sidebarCollapsed: state.sidebarCollapsed,
          filterPanelOpen: state.filterPanelOpen,
        }),
      }
    ),
    { name: 'UIStore' }
  )
)

// ============================================================================
// Selector Hooks (for performance - only subscribe to what you need)
// ============================================================================

export const useSidebarCollapsed = () =>
  useUIStore((state) => state.sidebarCollapsed)

export const useSidebarMobileOpen = () =>
  useUIStore((state) => state.sidebarMobileOpen)

export const useActiveModal = () =>
  useUIStore((state) => ({
    type: state.activeModal,
    data: state.modalData,
    isOpen: state.activeModal !== null,
  }))

export const useCommandPaletteOpen = () =>
  useUIStore((state) => state.commandPaletteOpen)

export const useFilterPanelOpen = () =>
  useUIStore((state) => state.filterPanelOpen)

// ============================================================================
// Action Hooks (stable references)
// ============================================================================

export const useUIActions = () =>
  useUIStore((state) => ({
    toggleSidebar: state.toggleSidebar,
    setSidebarCollapsed: state.setSidebarCollapsed,
    setSidebarMobileOpen: state.setSidebarMobileOpen,
    openModal: state.openModal,
    closeModal: state.closeModal,
    setCommandPaletteOpen: state.setCommandPaletteOpen,
    toggleFilterPanel: state.toggleFilterPanel,
    setFilterPanelOpen: state.setFilterPanelOpen,
  }))
