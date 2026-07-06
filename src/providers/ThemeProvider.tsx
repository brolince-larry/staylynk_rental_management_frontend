// src/providers/ThemeProvider.tsx
// Applies the user's theme preference to <html> as a 'dark' class.
// Persisted via Zustand + localStorage (ui.store.ts).

import React, { useEffect, type ReactNode } from 'react'
import { useUIStore } from '@/store/ui.store'

function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)

  root.classList.toggle('dark', isDark)
  root.style.colorScheme = isDark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }): React.ReactElement {
  const theme = useUIStore((s) => s.theme)

  useEffect(() => {
    applyTheme(theme)

    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme('system')
    media.addEventListener('change', handleChange)

    return () => media.removeEventListener('change', handleChange)
  }, [theme])

  return <>{children}</>
}
