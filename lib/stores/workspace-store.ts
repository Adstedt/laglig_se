/**
 * Client-Side Workspace State Store (Story P.2)
 * 
 * Manages workspace data on the client side using Zustand.
 * Provides persistent caching with localStorage and optimistic updates.
 * 
 * @see docs/stories/P.2.systematic-caching.story.md
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { 
  Workspace, 
  WorkspaceMember, 
  LawList,
  LawListItem,
  WorkspaceRole
} from '@prisma/client'

interface WorkspaceState {
  // Current workspace data
  currentWorkspace: Workspace | null
  currentRole: WorkspaceRole | null
  
  // Workspace members (cached for 1 hour)
  members: WorkspaceMember[]
  membersLastFetched: number | null
  
  // Law lists for current workspace (cached for 5 minutes)
  lawLists: LawList[]
  lawListsLastFetched: number | null
  
  // Law list items by list ID
  listItems: Record<string, LawListItem[]>
  listItemsLastFetched: Record<string, number>
  
  // User's workspaces
  userWorkspaces: Workspace[]
  
  // User preferences
  userPreferences: {
    theme?: 'light' | 'dark' | 'system'
    language?: 'sv' | 'en'
    defaultView?: 'grid' | 'list' | 'kanban'
    sidebarCollapsed?: boolean
  }
  
  // Loading states
  isLoadingWorkspace: boolean
  isLoadingMembers: boolean
  isLoadingLists: boolean
  
  // Actions
  setCurrentWorkspace: (workspace: Workspace, role: WorkspaceRole) => void
  setMembers: (members: WorkspaceMember[]) => void
  setLawLists: (lists: LawList[]) => void
  setListItems: (listId: string, items: LawListItem[]) => void
  setUserWorkspaces: (workspaces: Workspace[]) => void
  updateUserPreferences: (prefs: Partial<WorkspaceState['userPreferences']>) => void
  
  // Cache management
  shouldRefetchMembers: () => boolean
  shouldRefetchLists: () => boolean
  shouldRefetchListItems: (listId: string) => boolean
  clearWorkspaceCache: () => void
  
  // Optimistic updates
  addLawList: (list: LawList) => void
  updateLawList: (listId: string, updates: Partial<LawList>) => void
  deleteLawList: (listId: string) => void
  addListItem: (listId: string, item: LawListItem) => void
  removeListItem: (listId: string, itemId: string) => void
  
  // Loading state setters
  setLoadingWorkspace: (loading: boolean) => void
  setLoadingMembers: (loading: boolean) => void
  setLoadingLists: (loading: boolean) => void
}

// Cache TTLs in milliseconds
const CACHE_TTL = {
  MEMBERS: 60 * 60 * 1000,    // 1 hour
  LAW_LISTS: 5 * 60 * 1000,   // 5 minutes
  LIST_ITEMS: 5 * 60 * 1000,  // 5 minutes
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      currentWorkspace: null,
      currentRole: null,
      members: [],
      membersLastFetched: null,
      lawLists: [],
      lawListsLastFetched: null,
      listItems: {},
      listItemsLastFetched: {},
      userWorkspaces: [],
      userPreferences: {},
      isLoadingWorkspace: false,
      isLoadingMembers: false,
      isLoadingLists: false,
      
      // Actions
      setCurrentWorkspace: (workspace, role) => set((state) => {
        state.currentWorkspace = workspace
        state.currentRole = role
        // Clear cached data when switching workspaces
        if (workspace.id !== state.currentWorkspace?.id) {
          state.members = []
          state.membersLastFetched = null
          state.lawLists = []
          state.lawListsLastFetched = null
          state.listItems = {}
          state.listItemsLastFetched = {}
        }
      }),
      
      setMembers: (members) => set((state) => {
        state.members = members
        state.membersLastFetched = Date.now()
      }),
      
      setLawLists: (lists) => set((state) => {
        state.lawLists = lists
        state.lawListsLastFetched = Date.now()
      }),
      
      setListItems: (listId, items) => set((state) => {
        state.listItems[listId] = items
        state.listItemsLastFetched[listId] = Date.now()
      }),
      
      setUserWorkspaces: (workspaces) => set((state) => {
        state.userWorkspaces = workspaces
      }),
      
      updateUserPreferences: (prefs) => set((state) => {
        state.userPreferences = { ...state.userPreferences, ...prefs }
      }),
      
      // Cache management
      shouldRefetchMembers: () => {
        const { membersLastFetched } = get()
        if (!membersLastFetched) return true
        return Date.now() - membersLastFetched > CACHE_TTL.MEMBERS
      },
      
      shouldRefetchLists: () => {
        const { lawListsLastFetched } = get()
        if (!lawListsLastFetched) return true
        return Date.now() - lawListsLastFetched > CACHE_TTL.LAW_LISTS
      },
      
      shouldRefetchListItems: (listId) => {
        const { listItemsLastFetched } = get()
        const lastFetched = listItemsLastFetched[listId]
        if (!lastFetched) return true
        return Date.now() - lastFetched > CACHE_TTL.LIST_ITEMS
      },
      
      clearWorkspaceCache: () => set((state) => {
        state.members = []
        state.membersLastFetched = null
        state.lawLists = []
        state.lawListsLastFetched = null
        state.listItems = {}
        state.listItemsLastFetched = {}
      }),
      
      // Optimistic updates for law lists
      addLawList: (list) => set((state) => {
        state.lawLists.push(list)
      }),
      
      updateLawList: (listId, updates) => set((state) => {
        const index = state.lawLists.findIndex((l: LawList) => l.id === listId)
        if (index !== -1) {
          state.lawLists[index] = { ...state.lawLists[index], ...updates }
        }
      }),
      
      deleteLawList: (listId) => set((state) => {
        state.lawLists = state.lawLists.filter((l: LawList) => l.id !== listId)
        delete state.listItems[listId]
        delete state.listItemsLastFetched[listId]
      }),
      
      addListItem: (listId, item) => set((state) => {
        if (!state.listItems[listId]) {
          state.listItems[listId] = []
        }
        state.listItems[listId].push(item)
      }),
      
      removeListItem: (listId, itemId) => set((state) => {
        if (state.listItems[listId]) {
          state.listItems[listId] = state.listItems[listId].filter(
            (item: LawListItem) => item.id !== itemId
          )
        }
      }),
      
      // Loading state setters
      setLoadingWorkspace: (loading) => set((state) => {
        state.isLoadingWorkspace = loading
      }),
      
      setLoadingMembers: (loading) => set((state) => {
        state.isLoadingMembers = loading
      }),
      
      setLoadingLists: (loading) => set((state) => {
        state.isLoadingLists = loading
      }),
    })),
    {
      name: 'workspace-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist user preferences and current workspace ID
        userPreferences: state.userPreferences,
        currentWorkspace: state.currentWorkspace ? {
          id: state.currentWorkspace.id,
          name: state.currentWorkspace.name,
          slug: state.currentWorkspace.slug,
        } : null,
      }),
    }
  )
)

// Selector hooks for common use cases
export const useCurrentWorkspace = () => 
  useWorkspaceStore((state) => state.currentWorkspace)

export const useWorkspaceMembers = () => 
  useWorkspaceStore((state) => state.members)

export const useLawLists = () => 
  useWorkspaceStore((state) => state.lawLists)

export const useUserPreferences = () => 
  useWorkspaceStore((state) => state.userPreferences)

export const useWorkspaceRole = () => 
  useWorkspaceStore((state) => state.currentRole)