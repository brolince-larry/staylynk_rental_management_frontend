// src/hooks/useFilters.ts
// Generic filter state manager — used by every list/table page.

import { useState, useCallback } from 'react'

export function useFilters<T extends Record<string, unknown>>(initial: T): {
  filters:          T
  setFilter:        <K extends keyof T>(key: K, value: T[K]) => void
  clearFilters:     () => void
  hasActiveFilters: boolean
} {
  const [filters, setFilters] = useState<T>(initial)

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const clearFilters = useCallback(() => setFilters(initial), [initial])

  const hasActiveFilters = Object.entries(filters).some(
    ([k, v]) =>
      v !== '' &&
      v !== null &&
      v !== undefined &&
      v !== (initial as Record<string, unknown>)[k]
  )

  return { filters, setFilter, clearFilters, hasActiveFilters }
}