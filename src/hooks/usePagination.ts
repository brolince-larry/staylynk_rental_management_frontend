// src/hooks/usePagination.ts
// Server-side pagination state.
// Automatically resets to page 1 when perPage changes.

import { useState, useCallback } from 'react'

export interface UsePaginationReturn {
  page:       number
  perPage:    number
  setPage:    (p: number) => void
  setPerPage: (n: number) => void
  reset:      () => void
}

export function usePagination(
  initialPage    = 1,
  initialPerPage = 15
): UsePaginationReturn {
  const [page,    setPageRaw]    = useState(initialPage)
  const [perPage, setPerPageRaw] = useState(initialPerPage)

  const setPage = useCallback((p: number) => {
    setPageRaw(Math.max(1, p))
  }, [])

  const setPerPage = useCallback((n: number) => {
    setPerPageRaw(n)
    setPageRaw(1) // always reset to page 1 when page size changes
  }, [])

  const reset = useCallback(() => {
    setPageRaw(initialPage)
    setPerPageRaw(initialPerPage)
  }, [initialPage, initialPerPage])

  return { page, perPage, setPage, setPerPage, reset }
}