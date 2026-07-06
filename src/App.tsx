import type React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from 'sonner'
import { AppErrorFallback } from '@/components/feedback/AppErrorFallback'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { AppRouter } from '@/routes/AppRouter'
import { queryClient } from '@/lib/queryClient'

function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <ThemeProvider>
          <ErrorBoundary FallbackComponent={AppErrorFallback}>
            <AppRouter />
            <Toaster richColors closeButton position="top-right" />
          </ErrorBoundary>
        </ThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  )
}

export default App
