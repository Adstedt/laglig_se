# Story 6.13a: Remove "Tilldelad" Column — Merge Into "Ansvarig" [BACKLOG]

## Status: BACKLOG

## Context

The law list table currently has two person-assignment columns:

- **Tilldelad** (assignee) — `assigned_to` on `LawListItem`
- **Ansvarig** (responsible person) — `responsible_user_id` on `LawListItem`

Both are hidden by default. In practice, the distinction between "who is assigned to work on this" and "who is responsible for it" is confusing and redundant for our target users. Jira, which inspired this pattern, only uses a single assignee field per issue. Individual tasks already have their own `assignee_id`, which is the right place for "who's doing this specific sub-task."

**Decision:** Keep **Ansvarig** as the single person field at the list-item level. Remove **Tilldelad** entirely.

## Scope

### Database

- [ ] Migrate any existing `assigned_to` values → `responsible_user_id` (where responsible is null)
- [ ] Remove `assigned_to` column from `law_list_items` table
- [ ] Remove `assignee` relation from Prisma schema

### Server Actions (`app/actions/document-list.ts`)

- [ ] Remove `assignee` include/select from queries
- [ ] Remove `assignedTo` from update schemas
- [ ] Remove `_resolvedAssignee` optimistic update logic

### UI Components

- [ ] Remove `assignee` column definition from `document-list-table.tsx`
- [ ] Remove `assignee` from `column-settings.tsx` COLUMN_OPTIONS
- [ ] Delete `table-cell-editors/assignee-editor.tsx`
- [ ] Remove assignee references from `bulk-action-bar.tsx`
- [ ] Remove `assignedTo` from row type definitions in table components
- [ ] Clean up any assignee references in `document-list-page-content.tsx`

### Tests

- [ ] Update `compliance-detail-table.test.tsx`
- [ ] Update `group-table-section.test.tsx`
- [ ] Update `grouped-document-list-table.test.tsx`
- [ ] Remove any assignee-specific test cases

## Migration Strategy

1. If a row has `assigned_to` set but `responsible_user_id` is null → copy assignee to responsible
2. If both are set → keep responsible (it was explicitly chosen), discard assignee
3. Drop column after migration

## Risk

Low. Both columns are hidden by default, so very few users (if any) have enabled Tilldelad.
