// src/providers/AuthProvider.tsx
// Bootstraps auth on every app load:
//   1. Wires Axios client to Zustand token store
//   2. Restores session from sessionStorage on page refresh
//   3. Validates restored token with GET /auth/me
//   4. Handles global 401 → logout everywhere
//
// SECURITY: token lives in Zustand memory only.
// sessionStorage fallback clears when the tab closes — safer than localStorage.

import React, { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { configureApiClient } from '@/api/client'
import { authApi } from '@/api/auth'
import { normalizeDashboardPath } from '@/auth/routeAccess'
import { useAuthStore } from '@/store/auth.store'

const SESSION_KEY = 'hh_session'
let restoreSessionPromise: Promise<void> | null = null

// ─── Provider ────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const { setAuth, clearAuth, setInitialising, token } = useAuthStore()
  const navigate = useNavigate()
  const [sessionExpired, setSessionExpired] = useState(false)

  // Wire Axios interceptors to the auth store once on mount
  useEffect(() => {
    configureApiClient({
      getToken: () => useAuthStore.getState().token,
      onUnauthorized: () => {
        clearAuth()
        sessionStorage.removeItem(SESSION_KEY)
        navigate('/login', { replace: true })
      },
      onSessionTimeout: () => {
        clearAuth()
        sessionStorage.removeItem(SESSION_KEY)
        setSessionExpired(true)
      },
      onForbidden: () => {
        // Stay on page — component renders AccessDenied via RoleGuard
      },
    })
  }, [clearAuth, navigate])

  // Restore session from sessionStorage on page refresh. The module-level
  // promise prevents duplicate /auth/me calls during React StrictMode remounts.
  useEffect(() => {
    const restore = async (): Promise<void> => {
      const stored = sessionStorage.getItem(SESSION_KEY)

      if (!stored) {
        setInitialising(false)
        return
      }

      try {
        // Set token in store so the /me request carries the Authorization header
        useAuthStore.setState({ token: stored })
        const res = await authApi.me()

        if (res.success && res.data) {
          setAuth(stored, res.data)
        } else {
          clearAuth()
          sessionStorage.removeItem(SESSION_KEY)
        }
      } catch {
        clearAuth()
        sessionStorage.removeItem(SESSION_KEY)
      }
    }

    restoreSessionPromise ??= restore()
    void restoreSessionPromise
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount only

  // Keep sessionStorage in sync with in-memory token
  useEffect(() => {
    if (token) {
      sessionStorage.setItem(SESSION_KEY, token)
    } else {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [token])

  return (
    <>
      {children}
      {sessionExpired && (
        <SessionTimeoutModal onLogin={() => {
          setSessionExpired(false)
          navigate('/login', { replace: true })
        }} />
      )}
    </>
  )
}

function SessionTimeoutModal({ onLogin }: { onLogin: () => void }): React.ReactElement {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <span className="text-2xl" aria-hidden>⏱</span>
        </div>
        <h2 id="session-timeout-title" className="mb-1 text-lg font-semibold text-foreground">
          Session Expired
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          You&apos;ve been logged out due to inactivity. Please log in again to continue.
        </p>
        <button
          type="button"
          onClick={onLogin}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Log In
        </button>
      </div>
    </div>
  )
}

// ─── useLogin ────────────────────────────────────────────────────────────
// Calls API, stores token in memory, redirects to role dashboard.
export function useLogin() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return async (email: string, password: string): Promise<void> => {
    const res = await authApi.login({ email, password, device_name: 'web' })

    if (res.success && res.data) {
      const { token, user } = res.data
      setAuth(token, user)
      navigate(normalizeDashboardPath(user), { replace: true })
    }
  }
}

// ─── useLogout ───────────────────────────────────────────────────────────
// Calls API (best-effort), clears all local state, redirects to /login.
export function useLogout() {
  const { clearAuth } = useAuthStore()
  const navigate = useNavigate()

  return async (): Promise<void> => {
    try {
      await authApi.logout()
    } catch {
      // Proceed with local logout regardless of API error
    } finally {
      clearAuth()
      sessionStorage.removeItem(SESSION_KEY)
      navigate('/login', { replace: true })
    }
  }
}
