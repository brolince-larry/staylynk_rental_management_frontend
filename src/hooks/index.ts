// src/hooks/index.ts
// Shared utility hooks used across all features.

import { useState, useEffect, useCallback, useRef } from 'react'
import { getErrorMessage } from '@/utils/errors'

// ─── useDebounce ──────────────────────────────────────────────────────────
// Delays updating a value until the user stops typing.
// Use on every search input to avoid API calls on each keystroke.
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

// ─── usePagination ────────────────────────────────────────────────────────
// Server-side pagination state. Resets to page 1 when per_page changes.
interface PaginationReturn {
  page:        number
  perPage:     number
  setPage:     (p: number) => void
  setPerPage:  (n: number) => void
  reset:       () => void
}

export function usePagination(
  initialPage    = 1,
  initialPerPage = 15
): PaginationReturn {
  const [page,    setPageRaw]    = useState(initialPage)
  const [perPage, setPerPageRaw] = useState(initialPerPage)

  const setPage = useCallback((p: number) => {
    setPageRaw(Math.max(1, p))
  }, [])

  const setPerPage = useCallback((n: number) => {
    setPerPageRaw(n)
    setPageRaw(1)
  }, [])

  const reset = useCallback(() => {
    setPageRaw(initialPage)
    setPerPageRaw(initialPerPage)
  }, [initialPage, initialPerPage])

  return { page, perPage, setPage, setPerPage, reset }
}

// ─── useFilters ───────────────────────────────────────────────────────────
// Generic filter state. Resets cleanly to initial values.
export function useFilters<T extends Record<string, unknown>>(initial: T): {
  filters:         T
  setFilter:       <K extends keyof T>(key: K, value: T[K]) => void
  clearFilters:    () => void
  hasActiveFilters: boolean
} {
  const [filters, setFilters] = useState<T>(initial)

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const clearFilters = useCallback(() => setFilters(initial), [initial])

  const hasActiveFilters = Object.entries(filters).some(([k, v]) =>
    v !== '' && v !== null && v !== undefined &&
    v !== (initial as Record<string, unknown>)[k]
  )

  return { filters, setFilter, clearFilters, hasActiveFilters }
}

// ─── useToast ─────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id:           string
  type:         ToastType
  title:        string
  description?: string
}

interface ToastReturn {
  toasts:  Toast[]
  toast:   (opts: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error:   (err: unknown, fallback?: string) => void
  warning: (title: string, description?: string) => void
  info:    (title: string, description?: string) => void
  dismiss: (id: string) => void
}

export function useToast(): ToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev.slice(-4), { ...opts, id }])
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timers.current.delete(id)
    }, 4_000)
    timers.current.set(id, timer)
  }, [])

  const success = useCallback(
    (title: string, description?: string) =>
      toast({ type: 'success', title, description }),
    [toast]
  )
  const error = useCallback(
    (err: unknown, fallback = 'Something went wrong.') =>
      {
        const message = getErrorMessage(err)
        toast({ type: 'error', title: message === 'An unexpected error occurred.' ? fallback : message })
      },
    [toast]
  )
  const warning = useCallback(
    (title: string, description?: string) =>
      toast({ type: 'warning', title, description }),
    [toast]
  )
  const info = useCallback(
    (title: string, description?: string) =>
      toast({ type: 'info', title, description }),
    [toast]
  )
  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer))
    timers.current.clear()
  }, [])

  return { toasts, toast, success, error, warning, info, dismiss }
}

// ─── useLocalStorage ──────────────────────────────────────────────────────
// Safe localStorage with JSON parse guard.
// NOTE: Never store auth tokens here — use Zustand memory store.
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setValue = useCallback((value: T) => {
    try {
      setStored(value)
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Quota exceeded or private mode — fail silently
    }
  }, [key])

  return [stored, setValue]
}

// ─── useClickOutside ──────────────────────────────────────────────────────
// Calls handler when user clicks outside the referenced element.
export function useClickOutside<T extends HTMLElement>(
  handler: () => void
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler()
      }
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [handler])

  return ref
}

// ─── useMediaQuery ────────────────────────────────────────────────────────
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches
  )

  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [query])

  return matches
}

// ─── usePrevious ──────────────────────────────────────────────────────────
// Returns the previous value of a variable — useful for detecting changes.
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => { ref.current = value }, [value])
  return ref.current
}
