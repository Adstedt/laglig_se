import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LayoutState {
  // Right sidebar (AI Chat) state - not managed by shadcn/ui sidebar
  rightSidebarFolded: boolean
  toggleRightSidebar: () => void
  setRightSidebarFolded: (_folded: boolean) => void

  // Accordion states for sidebar sections
  accordionStates: Record<string, boolean>
  setAccordionState: (_id: string, _isOpen: boolean) => void
  getAccordionState: (_id: string) => boolean
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      rightSidebarFolded: false,
      toggleRightSidebar: () =>
        set((state) => ({ rightSidebarFolded: !state.rightSidebarFolded })),
      setRightSidebarFolded: (folded: boolean) =>
        set({ rightSidebarFolded: folded }),

      accordionStates: {},
      setAccordionState: (id: string, isOpen: boolean) =>
        set((state) => ({
          accordionStates: { ...state.accordionStates, [id]: isOpen },
        })),
      getAccordionState: (id: string) => get().accordionStates[id] ?? false,
    }),
    {
      name: 'layout-storage',
    }
  )
)
