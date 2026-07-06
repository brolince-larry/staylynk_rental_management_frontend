// src/hooks/useLocalStorage.ts
// Safe localStorage access with SSR guard and JSON parse error handling.
// NOTE: Never store auth tokens here — use the Zustand memory store.

import { useState, useCallback } from 'react'

export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void, () => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setValue = useCallback(
    (value: T) => {
      try {
        setStored(value)
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Quota exceeded or private mode — fail silently
      }
    },
    [key]
  )

  const removeValue = useCallback(() => {
    try {
      setStored(defaultValue)
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }, [key, defaultValue])

  return [stored, setValue, removeValue]
}
