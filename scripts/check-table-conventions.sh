#!/usr/bin/env bash
# Epic 28 grep-gate (Story 28.12): tables are built on components/ui/data-table.
# Fails CI when
#   1. useReactTable is wired up outside the core (one whitelisted frozen
#      marketing snapshot excepted — Story 28.4), or
#   2. anything imports a table primitive deleted during Epic 28.
#
# See docs/architecture/table-conventions.md for the Tier-1/Tier-0 rules.
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0

# --- 1. No TanStack wiring outside the core -------------------------------
# Whitelist: the permanently frozen presentational copy for marketing.
offenders=$(grep -rl "useReactTable" --include="*.ts" --include="*.tsx" \
  components app lib 2>/dev/null \
  | grep -v "^components/ui/data-table/" \
  | grep -v "^components/features/landing-v3/marketing-document-table.tsx" \
  || true)
if [ -n "$offenders" ]; then
  echo "✗ useReactTable outside components/ui/data-table (use <DataTable> instead):"
  echo "$offenders" | sed 's/^/    /'
  fail=1
fi

# --- 2. No imports of primitives deleted in Epic 28 ------------------------
deleted_modules=(
  "shared/virtual-table-body"
  "document-list/document-list-card"
  "document-list/document-list-grid"
  "document-list/grouped-document-list'"
)
for mod in "${deleted_modules[@]}"; do
  hits=$(grep -rl "$mod" --include="*.ts" --include="*.tsx" \
    components app lib 2>/dev/null || true)
  if [ -n "$hits" ]; then
    echo "✗ import of Epic-28-deleted module '$mod':"
    echo "$hits" | sed 's/^/    /'
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Table conventions gate failed — see docs/architecture/table-conventions.md"
  exit 1
fi
echo "✓ table conventions gate passed"
