'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { Search, Clock, FileText, Scale, Landmark, X } from 'lucide-react'
import { searchAutocompleteAction } from '@/app/actions/search'
import { useDebouncedCallback } from 'use-debounce'
import { cn } from '@/lib/utils'

const CONTENT_TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; label: string; color: string }
> = {
  SFS_LAW: {
    icon: <FileText className="h-4 w-4" />,
    label: 'Lag',
    color:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  },
  COURT_CASE_AD: {
    icon: <Scale className="h-4 w-4" />,
    label: 'AD',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  COURT_CASE_HD: {
    icon: <Scale className="h-4 w-4" />,
    label: 'HD',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  COURT_CASE_HFD: {
    icon: <Scale className="h-4 w-4" />,
    label: 'HFD',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  COURT_CASE_HOVR: {
    icon: <Scale className="h-4 w-4" />,
    label: 'HovR',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  COURT_CASE_MOD: {
    icon: <Scale className="h-4 w-4" />,
    label: 'MOD',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  COURT_CASE_MIG: {
    icon: <Scale className="h-4 w-4" />,
    label: 'MIG',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  },
  EU_REGULATION: {
    icon: <Landmark className="h-4 w-4" />,
    label: 'EU-förordning',
    color:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  },
  EU_DIRECTIVE: {
    icon: <Landmark className="h-4 w-4" />,
    label: 'EU-direktiv',
    color:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  },
}

// Content type to URL path mapping
const CONTENT_TYPE_HREF: Record<string, string> = {
  SFS_LAW: '/lagar',
  COURT_CASE_AD: '/rattsfall/ad',
  COURT_CASE_HD: '/rattsfall/hd',
  COURT_CASE_HFD: '/rattsfall/hfd',
  COURT_CASE_HOVR: '/rattsfall/hovr',
  COURT_CASE_MOD: '/rattsfall/mod',
  COURT_CASE_MIG: '/rattsfall/mig',
  EU_REGULATION: '/eu/forordningar',
  EU_DIRECTIVE: '/eu/direktiv',
}

interface GlobalSearchDialogProps {
  isWorkspace?: boolean
}

export function GlobalSearchDialog({
  isWorkspace = false,
}: GlobalSearchDialogProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<
    Array<{
      title: string
      slug: string
      type: string
      category: string | null
    }>
  >([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // URL prefix for workspace mode
  const browsePrefix = isWorkspace ? '/browse' : ''

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('laglig_recent_searches')
      if (stored) {
        try {
          setRecentSearches(JSON.parse(stored).slice(0, 5))
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }, [])

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Debounced autocomplete
  const fetchSuggestions = useDebouncedCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([])
      return
    }
    setLoading(true)
    try {
      const result = await searchAutocompleteAction(searchQuery)
      setSuggestions(result.suggestions)
    } catch {
      setSuggestions([])
    }
    setLoading(false)
  }, 300)

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      fetchSuggestions(value)
    },
    [fetchSuggestions]
  )

  const saveRecentSearch = useCallback(
    (searchQuery: string) => {
      const updated = [
        searchQuery,
        ...recentSearches.filter((s) => s !== searchQuery),
      ].slice(0, 5)
      setRecentSearches(updated)
      if (typeof window !== 'undefined') {
        localStorage.setItem('laglig_recent_searches', JSON.stringify(updated))
      }
    },
    [recentSearches]
  )

  const handleSelect = useCallback(
    (slug: string | null, searchQuery?: string, contentType?: string) => {
      if (slug && contentType) {
        const basePath = CONTENT_TYPE_HREF[contentType] || '/lagar'
        router.push(`${browsePrefix}${basePath}/${slug}`)
      } else if (searchQuery) {
        saveRecentSearch(searchQuery)
        // For full search, use workspace search page if in workspace
        const searchUrl = isWorkspace
          ? `/browse/sok?q=${encodeURIComponent(searchQuery)}`
          : `/sok?q=${encodeURIComponent(searchQuery)}`
        router.push(searchUrl)
      }
      setOpen(false)
      setQuery('')
    },
    [router, saveRecentSearch, browsePrefix, isWorkspace]
  )

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem('laglig_recent_searches')
    }
  }, [])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-2 rounded-full px-4 py-2 text-sm',
          'bg-muted/50 text-muted-foreground',
          'transition-all duration-200',
          'hover:bg-muted hover:text-foreground'
        )}
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Sök...</span>
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 text-xs sm:inline-flex">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-label="Stäng sökdialog"
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-[15vh] w-full max-w-xl -translate-x-1/2 px-4">
        <Command className="overflow-hidden rounded-2xl border bg-card shadow-2xl">
          {/* Input */}
          <div className="flex items-center border-b px-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={handleQueryChange}
              placeholder="Sök lagar, rättsfall, EU-lagstiftning..."
              className="flex-1 bg-transparent py-4 pl-3 text-base outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="rounded-full p-1 hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            {loading && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                Söker...
              </div>
            )}

            {/* Recent Searches */}
            {query.length === 0 && recentSearches.length > 0 && (
              <Command.Group>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Senaste sökningar
                  </span>
                  <button
                    onClick={clearRecentSearches}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Rensa
                  </button>
                </div>
                {recentSearches.map((search) => (
                  <Command.Item
                    key={search}
                    value={search}
                    onSelect={() => handleSelect(null, search)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted"
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{search}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <Command.Group>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  Förslag
                </div>
                {suggestions.map((item) => {
                  const config = CONTENT_TYPE_CONFIG[item.type]
                  return (
                    <Command.Item
                      key={item.slug}
                      value={item.title}
                      onSelect={() =>
                        handleSelect(item.slug, undefined, item.type)
                      }
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted"
                    >
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg',
                          config?.color || 'bg-muted'
                        )}
                      >
                        {config?.icon || <FileText className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {config?.label}
                          </span>
                          {item.category && (
                            <>
                              <span className="text-xs text-muted-foreground">
                                •
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.category}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            )}

            {/* Full Search Option */}
            {query.length > 0 && (
              <Command.Item
                value={`search-all-${query}`}
                onSelect={() => handleSelect(null, query)}
                className="mt-2 flex cursor-pointer items-center gap-3 rounded-lg border-t px-3 py-3 hover:bg-muted"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Search className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm">
                  Sök alla dokument för &quot;
                  <span className="font-medium">{query}</span>&quot;
                </span>
              </Command.Item>
            )}

            {/* Empty State */}
            {query.length > 2 && suggestions.length === 0 && !loading && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Inga resultat för &quot;{query}&quot;
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Prova en annan sökterm eller kontrollera stavningen
                </p>
              </div>
            )}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1">↑</kbd>
                <kbd className="rounded border bg-muted px-1">↓</kbd>
                navigera
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1">↵</kbd>
                välj
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="rounded border bg-muted px-1">esc</kbd>
              stäng
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}
