'use client'

/**
 * Story 6.2: Search Input Component
 * Manages its own state to prevent parent re-renders on every keystroke
 */

import { useState, useCallback, useEffect, memo } from 'react'
import { useDebounce } from 'use-debounce'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'

interface SearchInputProps {
  initialValue?: string
  onSearch: (_query: string) => void
  placeholder?: string
  debounceMs?: number
}

export const SearchInput = memo(function SearchInput({
  initialValue = '',
  onSearch,
  placeholder = 'Sök...',
  debounceMs = 300,
}: SearchInputProps) {
  const [value, setValue] = useState(initialValue)
  const [debouncedValue] = useDebounce(value, debounceMs)

  // Sync with initial value changes (e.g., from URL)
  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  // Call onSearch when debounced value changes
  useEffect(() => {
    onSearch(debouncedValue)
  }, [debouncedValue, onSearch])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
  }, [])

  const handleClear = useCallback(() => {
    setValue('')
  }, [])

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className="h-8 w-[160px] pl-8 pr-8 text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Rensa sökning</span>
        </button>
      )}
    </div>
  )
})
