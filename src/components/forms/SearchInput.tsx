// src/components/forms/SearchInput.tsx
// Debounce-ready search input with clear button.
// Used at the top of every list/table page.

import React from 'react'
import { Search, X } from 'lucide-react'
import { clsx } from 'clsx'

interface SearchInputProps {
  value:        string
  onChange:     (value: string) => void
  placeholder?: string
  className?:   string
  autoFocus?:   boolean
  disabled?:    boolean
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  autoFocus,
  disabled,
}: SearchInputProps): React.ReactElement {
  return (
    <div className={clsx('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />

      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className={clsx(
          'w-full rounded-lg border border-border bg-background',
          'pl-8 pr-8 py-2 text-sm text-foreground',
          'placeholder:text-muted-foreground transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}