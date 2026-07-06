// src/hooks/useDebounce.ts
// Delays updating a value until the user stops typing.
// Use on every search input to avoid triggering API calls on each keystroke.

import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}