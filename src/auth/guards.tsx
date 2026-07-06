import React, { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { canAccessRole, normalizeDashboardPath } from '@/auth/routeAccess'
import { PageLoader } from '@/components/feedback/PageLoader'
import { useAuthStore } from '@/store/auth.store'
import type { Role } from '@/types'

function AccessDenied(): React.ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have permission to view this page.
        </p>
      </section>
    </main>
  )
}

export function AuthGuard({ children }: { children: ReactNode }): React.ReactElement {
  const location = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isInitialising = useAuthStore((state) => state.isInitialising)

  if (isInitialising) return <PageLoader />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

export function GuestGuard({ children }: { children: ReactNode }): React.ReactElement {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isInitialising = useAuthStore((state) => state.isInitialising)

  if (isInitialising) return <PageLoader />
  if (isAuthenticated && user) return <Navigate to={normalizeDashboardPath(user)} replace />

  return <>{children}</>
}

export function RouteRoleGuard({
  children,
  requiredRole,
}: {
  children: ReactNode
  requiredRole: Role
}): React.ReactElement {
  const user = useAuthStore((state) => state.user)

  if (!user) return <PageLoader />
  if (!canAccessRole(user.role, requiredRole)) return <AccessDenied />

  return <>{children}</>
}
