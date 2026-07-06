// src/components/feedback/AppErrorFallback.tsx
import React from 'react'
import type { FallbackProps } from 'react-error-boundary'

export function AppErrorFallback({ error, resetErrorBoundary }: FallbackProps): React.ReactElement {
  const message = import.meta.env.DEV && error instanceof Error
    ? error.message
    : 'Please refresh the page or sign in again.'

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        {message}
      </p>
      <div className="flex gap-3">
        <button
          onClick={resetErrorBoundary}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.replace('/login')}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Go to login
        </button>
      </div>
    </div>
  )
}
