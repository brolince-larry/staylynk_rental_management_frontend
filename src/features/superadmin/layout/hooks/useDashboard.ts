// src/features/superadmin/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/api/client'
import { useAuthStore } from '@/store/auth.store'

export interface SAStats {
  total_organizations: number
  new_organizations: number
  total_properties: number
  new_properties: number
  total_rooms: number
  new_rooms: number
  total_tenants: number
  new_tenants: number
  monthly_revenue: number
  revenue_change_pct: number
  active_subscriptions: number
}

export interface TopOrg {
  id: number
  name: string
  owner: string | null
  properties: number
  tenants: number
  plan: string | null
  status: string
  revenue: number
}

export interface SASystemHealth {
  server_status: string
  database: { status: string; latency_ms?: number }
  redis: string
  storage: { status: string; used_pct: number; free_gb?: number; total_gb?: number }
  queue: { pending: number; failed: number }
  uptime: string
  php_version?: string
  app_version?: string
  environment?: string
}

export interface AIMonitoringData {
  total_requests: number
  blocked_requests: number
  low_confidence: number
  cache_hit_rate: number | null
  avg_response_ms: number | null
  circuit_open: boolean
  circuit_open_at: string | null
}

export interface SADashboardData {
  stats: SAStats
  system_health: SASystemHealth
  system_usage: {
    api_requests: { total: number; display: string }
    storage: { used_bytes: number; used_display: string; total_bytes?: number; total_display?: string; pct: number }
    bandwidth?: { total_bytes: number; display: string }
    active_users: { now: number; total: number }
  }
  ai_monitoring: AIMonitoringData | null
  top_organizations: TopOrg[]
  revenue_trend: Array<{ period: string; revenue: number }>
  plan_distribution: Array<{ plan_name: string; active_subscribers: number; revenue_this_month: number }>
}

export function useSuperAdminDashboard() {
  const user = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['superadmin', 'dashboard'],
    queryFn: async () => {
      const res = await apiGet<SADashboardData | { data: SADashboardData }>('/superadmin/dashboard')
      const payload = (res.data as unknown as { data: SADashboardData })?.data
        ?? res.data as unknown as SADashboardData
      return payload
    },
    staleTime: Infinity,
    enabled: !!user && user.role === 'superadmin',
  })
}
