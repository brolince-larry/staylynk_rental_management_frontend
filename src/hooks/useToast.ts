// src/hooks/useToast.ts
// Lightweight in-component toast queue.
// Toasts auto-dismiss after 4 seconds. Max 5 visible at once.

import { useState, useCallback, useEffect, useRef } from 'react'
import { getErrorMessage } from '@/utils/errors'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id:           string
  type:         ToastType
  title:        string
  description?: string
}

export interface UseToastReturn {
  toasts:  Toast[]
  toast:   (opts: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error:   (err: unknown, fallback?: string) => void
  warning: (title: string, description?: string) => void
  info:    (title: string, description?: string) => void
  dismiss: (id: string) => void
}

export function useToast(): UseToastReturn {
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
    (title: string, description?: string) => toast({ type: 'success', title, description }),
    [toast]
  )
  const error = useCallback(
    (err: unknown, fallback = 'Something went wrong.') => {
      const message = getErrorMessage(err)
      toast({ type: 'error', title: message === 'An unexpected error occurred.' ? fallback : message })
    },
    [toast]
  )
  const warning = useCallback(
    (title: string, description?: string) => toast({ type: 'warning', title, description }),
    [toast]
  )
  const info = useCallback(
    (title: string, description?: string) => toast({ type: 'info', title, description }),
    [toast]
  )
  const dismiss = useCallback(
    (id: string) => {
      const timer = timers.current.get(id)
      if (timer) clearTimeout(timer)
      timers.current.delete(id)
      setToasts(prev => prev.filter(t => t.id !== id))
    },
    []
  )

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer))
    timers.current.clear()
  }, [])

  return { toasts, toast, success, error, warning, info, dismiss }
}
