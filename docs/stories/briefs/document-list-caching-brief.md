# Story Brief: Document List Performance Optimization

## For: Scrum Master (Bob)

## From: Architect (Winston)

## Date: 2026-01-07

---

## Executive Summary

The document list functionality (Stories 4.11, 4.12, 4.13) has performance issues that create a sluggish user experience. This brief outlines **simple fixes** to the existing Zustand store that will make list interactions feel instant - without introducing new dependencies or architectural changes.

---

## Problem Statement

Users experience noticeable delays when:

1. **Switching between lists** - Full data wipe and refetch every time
2. **Adding documents** - Loading spinner, then full list reload
3. **Updating assignees** - Triggers unnecessary full refetch

These issues become more pronounced as workspace usage increases (target: 1000+ daily users).

---

## Root Cause Analysis

| Issue            | Current Code                                                      | Problem                                      |
| ---------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| Slow list switch | `setActiveList` clears `listItems`, then calls `fetchItems(true)` | User sees skeleton/loading on every switch   |
| Add item delay   | `addItem` awaits server, then calls `fetchItems(true)`            | Not optimistic - waits for server round-trip |
| Assignee refetch | `updateItem` calls `fetchItems(true)` when assignee changes       | Unnecessary - could update local state       |

**Location:** `lib/stores/document-list-store.ts`

---

## Proposed Solution

### Change 1: Per-List Item Cache in Zustand

Add a `Map<listId, items[]>` to cache items per list. When switching lists:

- If cached: Show instantly, background revalidate
- If not cached: Show loading, fetch normally

```typescript
// NEW state property
itemsByList: Map<
  string,
  {
    items: DocumentListItem[]
    fetchedAt: number
  }
>

// MODIFIED setActiveList
setActiveList: (listId: string) => {
  const cached = get().itemsByList.get(listId)

  if (cached) {
    // Instant switch from cache
    set({
      activeListId: listId,
      listItems: cached.items,
    })
    // Background refresh (non-blocking)
    get().fetchItems(true)
  } else {
    // No cache - normal loading flow
    set({
      activeListId: listId,
      listItems: [],
      isLoadingItems: true,
    })
    get().fetchItems(true)
  }
}
```

**Cache size limit:** Keep last 10 lists to prevent memory bloat.

### Change 2: True Optimistic `addItem`

Current `addItem` waits for server before showing the item. Change to:

1. Create temporary item immediately with `temp-{timestamp}` ID
2. Add to list instantly (user sees it immediately)
3. Call server in background
4. On success: Replace temp ID with real ID (or just leave it)
5. On failure: Remove temp item, show error toast

```typescript
addItem: async (listId, documentId, documentInfo, commentary?) => {
  const { listItems } = get()

  // 1. Create optimistic item
  const tempId = `temp-${Date.now()}`
  const tempItem: DocumentListItem = {
    id: tempId,
    position: listItems.length,
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    // ... other defaults
    document: documentInfo, // Must be passed from UI
  }

  // 2. Instant UI update
  set({
    listItems: [...listItems, tempItem],
    isAddingItem: false, // No loading state!
  })

  // 3. Server call (background)
  try {
    const result = await addDocumentToList({ listId, documentId, commentary })

    if (result.success) {
      // Update cache
      const updatedItems = get().listItems
      get().itemsByList.set(listId, {
        items: updatedItems,
        fetchedAt: Date.now(),
      })
      // Optionally fetch full item to replace temp
    } else {
      // Rollback
      set({
        listItems: get().listItems.filter((i) => i.id !== tempId),
        error: result.error,
      })
    }
  } catch {
    // Rollback on error
    set({
      listItems: get().listItems.filter((i) => i.id !== tempId),
      error: 'Något gick fel',
    })
  }
}
```

**Note:** The UI component calling `addItem` must pass `documentInfo` (title, documentNumber, contentType, slug) so we can create the temp item. This may require updating the add document modal.

### Change 3: Remove Unnecessary Refetch on Assignee Update

Current `updateItem` has this logic:

```typescript
// Current - PROBLEMATIC
if (updates.assignedTo !== undefined) {
  await get().fetchItems(true) // Full refetch!
}
```

Change to update local state directly. The assignee data can be fetched separately or included in the update response.

```typescript
// Fixed
if (result.success && result.data?.assignee) {
  // Update just that item's assignee locally
  set((state) => ({
    listItems: state.listItems.map((item) =>
      item.id === itemId ? { ...item, assignee: result.data.assignee } : item
    ),
  }))
}
// No fetchItems(true) call
```

### Change 4: Update Cache After Mutations

Every mutation should update the `itemsByList` cache:

```typescript
// After any successful mutation
const updateCache = () => {
  const { activeListId, listItems } = get()
  if (activeListId) {
    const cache = new Map(get().itemsByList)
    cache.set(activeListId, {
      items: listItems,
      fetchedAt: Date.now(),
    })
    set({ itemsByList: cache })
  }
}
```

---

## Acceptance Criteria

1. **Instant list switching (cached):**
   - Switch to a previously viewed list shows items immediately (<50ms)
   - Background refresh occurs without loading state
   - First visit to a list shows loading state (acceptable)

2. **Instant document addition:**
   - Clicking "Add" shows the document in the list immediately
   - No loading spinner visible
   - Failure shows error toast and removes the item

3. **No unnecessary refetches:**
   - Updating status/priority/assignee does NOT trigger full list reload
   - Only the affected item updates in the UI

4. **Cache management:**
   - Cache limited to last 10 lists
   - Cache updates after every mutation
   - Cache persists during session (not across page reload - that's fine)

---

## Files to Modify

| File                                                       | Changes                                                                                   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `lib/stores/document-list-store.ts`                        | Add `itemsByList` Map, modify `setActiveList`, `addItem`, `updateItem`, add cache helpers |
| `components/features/document-list/add-document-modal.tsx` | Pass document info to `addItem` for optimistic creation                                   |

**Estimated scope:** ~100-150 lines changed

---

## Testing Requirements

### Unit Tests

- Test `setActiveList` returns cached data when available
- Test `setActiveList` fetches when cache miss
- Test `addItem` creates optimistic item before server response
- Test `addItem` rollback on server error
- Test cache size limit (evicts oldest when >10)

### E2E Tests

- Switch between 3 lists rapidly - no loading spinners after first visit
- Add document - appears instantly in list
- Add document with server error - disappears with error toast
- Update assignee - no full list flash/reload

---

## Out of Scope (Future Phase)

These are documented in `docs/architecture/21-caching-and-data-fetching-strategy.md` for future implementation:

- SWR integration for data fetching
- Redis caching for user-scoped data
- Supabase Realtime for multi-user sync
- Prefetch on hover
- Unified caching hooks

---

## Dependencies

None. This uses existing Zustand patterns.

---

## Risk Assessment

| Risk                                 | Likelihood | Mitigation                                    |
| ------------------------------------ | ---------- | --------------------------------------------- |
| Stale cache shown to user            | Low        | Background refresh after cache hit            |
| Memory bloat from cache              | Low        | Cache size limit (10 lists)                   |
| Race condition on rapid switches     | Medium     | Use AbortController or ignore stale responses |
| Optimistic item doesn't match server | Low        | Fetch full item on success if needed          |

---

## Questions for Product Owner

1. Is 10 lists a reasonable cache limit? (Users with 20+ lists would still see loading on some switches)
2. Should the optimistic item show a subtle "saving..." indicator while server call is in progress?
3. How should we handle the case where a user adds a document that a colleague just removed? (Conflict resolution)

---

## Suggested Story Title

**"Story 4.14: Document List Performance - Instant Switching and Optimistic Updates"**

---

## Reference

- Architecture decision: `docs/architecture/21-caching-and-data-fetching-strategy.md`
- Current implementation: `lib/stores/document-list-store.ts`
- Related stories: 4.11, 4.12, 4.13
