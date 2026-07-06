import { QueryClient } from '@tanstack/react-query'

// Each browser session draws a random staleTime in [12 min, 18 min].
// Without jitter every user would re-fetch at exactly 15 minutes,
// creating a thundering herd. Math.random() is evaluated once at
// module load, so a single session gets one stable value.
const BASE_STALE_MS  = 1000 * 60 * 15  // 15 minutes
const JITTER_MS      = 1000 * 60 * 3   // ±3 minutes
const STALE_TIME_MS  = BASE_STALE_MS + (Math.random() * 2 - 1) * JITTER_MS
const GARBAGE_COLLECT_MS = 1000 * 60 * 60

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: GARBAGE_COLLECT_MS,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      retry: 1,
      networkMode: 'online',
    },
    mutations: {
      retry: 0,
      networkMode: 'online',
    },
  },
})
