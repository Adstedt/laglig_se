'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, X, Loader2 } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { catalogueAutocompleteAction } from '@/app/actions/browse'
import { getDocumentTheme, type DocumentTheme } from '@/lib/document-themes'
import { cn } from '@/lib/utils'

/**
 * Get the correct href for a document based on whether we're in workspace mode
 */
function getWorkspaceAwareHref(theme: DocumentTheme, basePath: string): string {
  // If basePath starts with /browse, we're in workspace mode
  if (basePath.startsWith('/browse')) {
    return `/browse${theme.href}`
  }
  return theme.href
}

interface CatalogueSearchBarProps {
  initialQuery: string
  basePath: string
  contentTypes?: string[]
}

interface Suggestion {
  title: string
  slug: string
  type: string
  documentNumber: string
}

export function CatalogueSearchBar({
  initialQuery,
  basePath,
  contentTypes,
}: CatalogueSearchBarProps) {
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Debounced search for suggestions (300ms)
  const fetchSuggestions = useDebouncedCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const result = await catalogueAutocompleteAction(
        searchQuery,
        contentTypes
      )
      setSuggestions(result.suggestions)
    } catch {
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, 300)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    setSelectedIndex(-1)
    setShowSuggestions(true)
    fetchSuggestions(newQuery)
  }

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setShowSuggestions(false)

      const params = new URLSearchParams(searchParams.toString())
      if (query.trim()) {
        params.set('q', query.trim())
      } else {
        params.delete('q')
      }
      // Reset to page 1 when searching
      params.delete('page')

      const queryString = params.toString()
      router.push(queryString ? `${basePath}?${queryString}` : basePath)
    },
    [query, router, searchParams, basePath]
  )

  const handleClear = useCallback(() => {
    setQuery('')
    setSuggestions([])
    setShowSuggestions(false)

    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    params.delete('page')

    const queryString = params.toString()
    router.push(queryString ? `${basePath}?${queryString}` : basePath)
  }, [router, searchParams, basePath])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault()
          const suggestion = suggestions[selectedIndex]
          if (suggestion) {
            const theme = getDocumentTheme(suggestion.type)
            const href = getWorkspaceAwareHref(theme, basePath)
            router.push(`${href}/${suggestion.slug}`)
            setShowSuggestions(false)
          }
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        break
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          placeholder="Sök lagar, rättsfall, EU-lagstiftning..."
          className="h-14 pl-12 pr-24 text-base"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-20 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {query && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-20 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <Button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2"
        >
          Sök
        </Button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg"
        >
          <ul className="py-1">
            {suggestions.map((suggestion, index) => {
              const theme = getDocumentTheme(suggestion.type)
              const ThemeIcon = theme.icon
              const href = getWorkspaceAwareHref(theme, basePath)

              return (
                <li key={`${suggestion.type}-${suggestion.slug}`}>
                  <Link
                    href={`${href}/${suggestion.slug}`}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 hover:bg-muted',
                      index === selectedIndex && 'bg-muted'
                    )}
                    onClick={() => setShowSuggestions(false)}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-md',
                        theme.accentLight
                      )}
                    >
                      <ThemeIcon className={cn('h-4 w-4', theme.accent)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {suggestion.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {suggestion.documentNumber} • {theme.label}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </form>
  )
}
