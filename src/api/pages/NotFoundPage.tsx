// src/pages/NotFoundPage.tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

export default function NotFoundPage(): React.ReactElement {
  const navigate   = useNavigate()
  const dashboard  = useAuthStore((s) => s.getDashboard())
  const isLoggedIn = useAuthStore((s) => s.isAuthenticated)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="text-8xl font-bold text-primary/10 select-none">404</div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or you don&apos;t
          have permission to view it.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          ← Go back
        </button>
        <button
          onClick={() => navigate(isLoggedIn ? dashboard : '/login')}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {isLoggedIn ? 'Go to dashboard' : 'Sign in'}
        </button>
      </div>
    </div>
  )
}