import { create } from 'zustand'

interface BreadcrumbOverrideState {
  label: string | null
  setLabel: (_label: string | null) => void
}

export const useBreadcrumbOverrideStore = create<BreadcrumbOverrideState>()(
  (set) => ({
    label: null,
    setLabel: (label: string | null) => set({ label }),
  })
)
