# Unified Toolbar - Migration Examples

This document shows how to refactor existing pages to use the `UnifiedToolbar` component.

---

## Example 1: Law Lists Page (Complex Layout)

### Before (Current Implementation)

```tsx
// Current: Multiple scattered div structures
<div className="flex flex-col gap-4">
  {/* Header row with list switcher and actions */}
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <DocumentListSwitcher ... />
    <div className="flex items-center gap-2">
      <ViewToggle ... />
      <Button>Lägg till dokument</Button>
      <ExportDropdown ... />
      <Button>Grupper</Button>
      <Button size="icon"><Settings /></Button>
    </div>
  </div>

  {/* Filters row */}
  <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
    <div className="flex flex-wrap items-center gap-2">
      <ContentTypeFilter ... />
      {activeGroupFilterInfo && <GroupFilterChip ... />}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput ... />
      <ComplianceFilters ... />
      {viewMode === 'table' && <ColumnSettings ... />}
    </div>
  </div>
</div>
```

### After (With UnifiedToolbar)

```tsx
import {
  UnifiedToolbar,
  ToolbarItemCount,
} from '@/components/ui/unified-toolbar'

;<UnifiedToolbar
  layout="complex"
  // Zone A: Context
  contextSelector={
    <DocumentListSwitcher
      lists={lists}
      activeListId={activeListId}
      onSelectList={handleListChange}
      onCreateList={handleCreateList}
      isLoading={isLoadingLists}
    />
  }
  // Zone B: Filters
  filterChips={
    <ContentTypeFilter
      activeFilter={contentTypeFilter}
      onFilterChange={setContentTypeGroupFilter}
    />
  }
  activeFilters={
    activeGroupFilterInfo && (
      <GroupFilterChip
        groupName={activeGroupFilterInfo.name}
        onClear={handleClearGroupFilter}
      />
    )
  }
  search={
    <SearchInput
      initialValue={searchParams.get('q') ?? ''}
      onSearch={handleSearch}
      placeholder="Sök..."
    />
  }
  filterDropdowns={
    <ComplianceFilters
      filters={complianceFilters}
      onFiltersChange={setComplianceFilters}
      workspaceMembers={workspaceMembers}
      categories={categories}
    />
  }
  // Zone C: View Controls
  viewToggle={<ViewToggle value={viewMode} onChange={setViewMode} />}
  columnSettings={
    viewMode === 'table' && (
      <ColumnSettings
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
      />
    )
  }
  // Zone D: Actions
  primaryAction={
    <Button onClick={() => setIsAddModalOpen(true)} disabled={!activeListId}>
      <Plus className="mr-2 h-4 w-4" />
      Lägg till dokument
    </Button>
  }
  secondaryActions={
    <>
      <ExportDropdown
        listId={activeListId}
        listName={activeList?.name ?? 'lista'}
        disabled={!activeListId || listItems.length === 0}
      />
      <Button
        variant="outline"
        onClick={() => setIsGroupManagerOpen(true)}
        disabled={!activeListId}
      >
        <FolderPlus className="mr-2 h-4 w-4" />
        <span className="hidden sm:inline">Grupper</span>
      </Button>
    </>
  }
  settingsAction={
    <Button
      variant="outline"
      size="icon"
      onClick={handleEditList}
      disabled={!activeListId}
      title="Hantera lista"
    >
      <Settings className="h-4 w-4" />
    </Button>
  }
  // Between rows content
  betweenRows={
    viewMode === 'table' &&
    (groups.length === 0 || hasFiltersOrSearch || activeGroupFilter) && (
      <ToolbarItemCount
        showing={
          hasFiltersOrSearch
            ? filteredAndSearchedItems.length
            : activeGroupFilter
              ? filteredItems.length
              : listItems.length
        }
        total={total}
      />
    )
  }
/>
```

---

## Example 2: Tasks Page (Standard Layout)

### Before

```tsx
<div className="flex flex-col gap-6">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <TabNavigation currentTab={currentTab} />
    <Button size="sm" onClick={() => setCreateTaskModalOpen(true)}>
      <Plus className="h-4 w-4 mr-1" />
      Ny uppgift
    </Button>
  </div>
  {/* Tab content */}
</div>
```

### After

```tsx
import { UnifiedToolbar } from '@/components/ui/unified-toolbar'

;<div className="flex flex-col gap-6">
  <UnifiedToolbar
    layout="standard"
    tabs={<TabNavigation currentTab={currentTab} />}
    primaryAction={
      <Button size="sm" onClick={() => setCreateTaskModalOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Ny uppgift
      </Button>
    }
  />
  {/* Tab content */}
</div>
```

---

## Example 3: Documents Browser (Standard Layout)

### Suggested Implementation

```tsx
import { UnifiedToolbar } from '@/components/ui/unified-toolbar'

;<UnifiedToolbar
  layout="standard"
  // Zone A: Breadcrumb navigation
  contextSelector={
    <Breadcrumb path={currentPath} onNavigate={handleNavigate} />
  }
  // Zone B: Search
  search={<SearchInput placeholder="Sök filer..." onSearch={handleSearch} />}
  // Zone C: View controls
  viewToggle={
    <ViewToggle
      value={viewMode}
      onChange={setViewMode}
      options={[
        { value: 'grid', icon: Grid },
        { value: 'list', icon: List },
      ]}
    />
  }
  sortControl={<SortDropdown value={sortBy} onChange={setSortBy} />}
  // Zone D: Actions
  primaryAction={
    <Button onClick={() => setShowUploadModal(true)}>
      <Upload className="mr-2 h-4 w-4" />
      Ladda upp
    </Button>
  }
  secondaryActions={
    <Button variant="outline" onClick={() => setShowNewFolderModal(true)}>
      <FolderPlus className="mr-2 h-4 w-4" />
      <span className="hidden sm:inline">Ny mapp</span>
    </Button>
  }
/>
```

---

## Example 4: Browse Laws (Simple Layout)

### Suggested Implementation

```tsx
import { UnifiedToolbar } from '@/components/ui/unified-toolbar'

;<UnifiedToolbar
  layout="simple"
  // Zone A: Breadcrumb
  contextSelector={
    <Breadcrumb
      items={[{ label: 'Bläddra', href: '/browse' }, { label: 'Lagar' }]}
    />
  }
  // Zone B: Search and filter
  search={<SearchInput placeholder="Sök lagar..." onSearch={handleSearch} />}
  filterChips={
    <FilterChips
      options={lawTypes}
      value={selectedTypes}
      onChange={setSelectedTypes}
    />
  }
  // Zone C: Sort
  sortControl={
    <SortDropdown value={sortBy} options={sortOptions} onChange={setSortBy} />
  }
/>
```

---

## Migration Steps

1. **Import the component:**

   ```tsx
   import {
     UnifiedToolbar,
     ToolbarItemCount,
   } from '@/components/ui/unified-toolbar'
   ```

2. **Identify your layout type:**
   - `simple` - Basic page with minimal controls
   - `standard` - Page with tabs/filters in single row
   - `complex` - Page needing two rows for filters

3. **Map existing controls to zones:**
   - Context selectors → `contextSelector` or `tabs`
   - Search/filters → `search`, `filterChips`, `filterDropdowns`, `activeFilters`
   - View toggles → `viewToggle`, `sortControl`, `columnSettings`
   - Actions → `primaryAction`, `secondaryActions`, `settingsAction`

4. **Replace the existing toolbar JSX with `<UnifiedToolbar ... />`**

5. **Test responsive behavior on mobile**

---

## Benefits

| Aspect           | Before                                 | After                               |
| ---------------- | -------------------------------------- | ----------------------------------- |
| **Consistency**  | Each page has unique toolbar structure | All pages use same zone pattern     |
| **Maintenance**  | Update styling in multiple places      | Update in one component             |
| **New pages**    | Copy-paste and modify                  | Drop in `UnifiedToolbar` with props |
| **Responsive**   | Custom responsive logic per page       | Built-in responsive behavior        |
| **Mental model** | Users learn each page separately       | Users know where to find controls   |
