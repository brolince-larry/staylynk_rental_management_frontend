// src/providers/AuthProvider.tsx
// Bootstraps auth on every app load:
//   1. Wires Axios client to Zustand token store
//   2. Restores session from sessionStorage on page refresh
//   3. Validates restored token with GET /auth/me
//   4. Handles global 401 → logout everywhere
//
// SECURITY: token lives in Zustand memory only.
// sessionStorage fallback clears when the tab closes — safer than localStorage.

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { configureApiClient } from '@/api/client'
import { authApi } from '@/api/auth'
import { normalizeDashboardPath } from '@/auth/routeAccess'
import { useAuthStore } from '@/store/auth.store'
import { useBodyScrollLock } from '@/hooks'

const SESSION_KEY = 'hh_session'
let restoreSessionPromise: Promise<void> | null = null

const IDLE_MS   = 10 * 60 * 1000  // 10 minutes → logout
const WARN_MS   =  9 * 60 * 1000  //  9 minutes → show warning
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const

// ─── Provider ────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const { setAuth, clearAuth, setInitialising, token } = useAuthStore()
  const navigate = useNavigate()
  const [sessionExpired, setSessionExpired] = useState(false)
  const [idleWarning, setIdleWarning] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const warnTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null)

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
      onSubscriptionRequired: () => {
        // Only the org owner (admin) can act on billing — managers/staff just
        // see the error message from the failed request, no forced navigation.
        const role = useAuthStore.getState().user?.role
        if (role === 'admin' && window.location.pathname !== '/admin/billing') {
          navigate('/admin/billing', { replace: false })
        }
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

  // ── Inactivity auto-logout ────────────────────────────────────────
  const clearIdleTimers = useCallback(() => {
    if (warnTimerRef.current)   clearTimeout(warnTimerRef.current)
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    if (countdownRef.current)   clearInterval(countdownRef.current)
  }, [])

  const doLogout = useCallback(() => {
    clearIdleTimers()
    setIdleWarning(false)
    clearAuth()
    sessionStorage.removeItem(SESSION_KEY)
    setSessionExpired(true)
  }, [clearAuth, clearIdleTimers])

  const resetIdleTimers = useCallback(() => {
    clearIdleTimers()
    setIdleWarning(false)

    warnTimerRef.current = setTimeout(() => {
      setIdleWarning(true)
      setCountdown(60)
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current!)
            return 0
          }
          return c - 1
        })
      }, 1_000)
      logoutTimerRef.current = setTimeout(doLogout, IDLE_MS - WARN_MS)
    }, WARN_MS)
  }, [clearIdleTimers, doLogout])

  useEffect(() => {
    if (!token) {
      clearIdleTimers()
      setIdleWarning(false)
      return
    }

    resetIdleTimers()
    const handler = () => resetIdleTimers()
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handler, { passive: true }))
    return () => {
      clearIdleTimers()
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handler))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <>
      {children}
      {idleWarning && (
        <IdleWarningModal
          countdown={countdown}
          onStayLoggedIn={() => { resetIdleTimers(); setIdleWarning(false) }}
          onLogout={doLogout}
        />
      )}
      {sessionExpired && (
        <SessionTimeoutModal onLogin={() => {
          setSessionExpired(false)
          navigate('/login', { replace: true })
        }} />
      )}
    </>
  )
}

function IdleWarningModal({
  countdown,
  onStayLoggedIn,
  onLogout,
}: {
  countdown: number
  onStayLoggedIn: () => void
  onLogout: () => void
}): React.ReactElement {
  useBodyScrollLock(true)
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
      aria-describedby="idle-warning-desc"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <span className="text-2xl" aria-hidden>⏱</span>
        </div>
        <h2 id="idle-warning-title" className="mb-1 text-lg font-semibold text-foreground">
          Still there?
        </h2>
        <p id="idle-warning-desc" className="mb-1 text-sm text-muted-foreground">
          You&apos;ll be automatically logged out due to inactivity in
        </p>
        <p className="mb-6 text-3xl font-bold tabular-nums text-amber-500">
          {String(countdown).padStart(2, '0')}s
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted"
          >
            Log out now
          </button>
          <button
            type="button"
            onClick={onStayLoggedIn}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Stay logged in
          </button>
        </div>
      </div>
    </div>
  )
}

function SessionTimeoutModal({ onLogin }: { onLogin: () => void }): React.ReactElement {
  useBodyScrollLock(true)
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
