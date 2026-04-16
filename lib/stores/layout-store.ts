import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LayoutState {
  // Left sidebar collapsed state
  leftSidebarCollapsed: boolean
  toggleLeftSidebar: () => void
  setLeftSidebarCollapsed: (_collapsed: boolean) => void

  // Right sidebar (AI Chat) state - not managed by shadcn/ui sidebar
  rightSidebarFolded: boolean
  toggleRightSidebar: () => void
  setRightSidebarFolded: (_folded: boolean) => void

  // Chat history sidebar (nested panel beside left nav)
  chatHistoryOpen: boolean
  setChatHistoryOpen: (_open: boolean) => void

  // Accordion states for sidebar sections
  accordionStates: Record<string, boolean>
  setAccordionState: (_id: string, _isOpen: boolean) => void
  getAccordionState: (_id: string) => boolean
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      leftSidebarCollapsed: false,
      toggleLeftSidebar: () =>
        set((state) => ({
          leftSidebarCollapsed: !state.leftSidebarCollapsed,
        })),
      setLeftSidebarCollapsed: (collapsed: boolean) =>
        set({ leftSidebarCollapsed: collapsed }),

      rightSidebarFolded: false,
      toggleRightSidebar: () =>
        set((state) => ({ rightSidebarFolded: !state.rightSidebarFolded })),
      setRightSidebarFolded: (folded: boolean) =>
        set({ rightSidebarFolded: folded }),

      chatHistoryOpen: false,
      setChatHistoryOpen: (open: boolean) => set({ chatHistoryOpen: open }),

      accordionStates: {},
      setAccordionState: (id: string, isOpen: boolean) =>
        set((state) => ({
          accordionStates: { ...state.accordionStates, [id]: isOpen },
        })),
      getAccordionState: (id: string) => get().accordionStates[id] ?? false,
    }),
    {
      name: 'layout-storage',
      partialize: (state) => ({
        leftSidebarCollapsed: state.leftSidebarCollapsed,
        rightSidebarFolded: state.rightSidebarFolded,
        accordionStates: state.accordionStates,
      }),
    }
  )
)
