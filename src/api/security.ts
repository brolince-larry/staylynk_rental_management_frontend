// src/api/security.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './client'

export interface SecurityDashboard {
  failed_logins_today: number
  blocked_ips_active: number
  blocked_devices_active: number
  critical_events_today: number
  high_events_today: number
  brute_force_attempts: number
  injection_attempts: number
  payment_attacks: number
}

export interface SecurityEvent {
  id: number
  event_type: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  risk_score: number
  event_count: number
  endpoint?: string | null
  action?: string | null
  ip_hash?: string | null
  user_id?: number | null
  resolved: boolean
  created_at: string
}

export interface BruteForceEntry {
  ip_hash: string
  attempts: number
  last_attempt: string
}

export interface RiskyUser {
  user_id: number
  max_score: number
  total_events: number
  distinct_events: number
  last_event: string
}

export interface BlockedIP {
  id: number
  ip_address: string
  ip_hash: string
  type: 'temporary' | 'permanent'
  reason: string
  offense_count: number
  blocked_until: string | null
  blocked_by: string | null
  created_at: string
}

export interface CategoryStat {
  category: string
  count: number
}

export interface HeatmapCell {
  date: string
  event_type: string
  category: string
  count: number
}

export interface BlockIPPayload {
  ip_address: string
  reason: string
  type: 'temporary' | 'permanent'
  duration_hours?: number
}

export interface TraceEventData {
  event: SecurityEvent
  account: {
    id: number; name: string; email: string; phone?: string | null
    role?: string | null; org?: string | null; status: string
    created_at: string; last_login_at?: string | null
  } | null
  associated_emails: string[]
  raw_ip: string | null
  ip_blocked: boolean
  device_blocked: boolean
  ip_events: Array<{ id: number; event_type: string; risk_score: number; risk_level: string; endpoint?: string | null; event_count: number; created_at: string }>
  device_events: Array<{ id: number; event_type: string; risk_score: number; risk_level: string; endpoint?: string | null; created_at: string }>
  risk_summary: { total_events: number; total_event_count: number; max_score: number; unique_endpoints: number; unique_event_types: number; first_seen: string; last_seen: string; endpoints_targeted: string[] }
}

export const securityApi = {
  dashboard: () =>
    apiGet<SecurityDashboard>('/superadmin/security/dashboard').then((r) => r.data),

  events: (params?: Record<string, unknown>) =>
    apiGet<{ data: SecurityEvent[]; meta: Record<string, unknown> }>(
      '/superadmin/security/events',
      params,
    ).then((r) => r.data),

  threats: () =>
    apiGet<{ data: SecurityEvent[] }>('/superadmin/security/threats').then((r) => r.data),

  heatmap: () =>
    apiGet<{ data: HeatmapCell[] }>('/superadmin/security/heatmap').then((r) => r.data),

  bruteForce: () =>
    apiGet<{ data: BruteForceEntry[] }>('/superadmin/security/brute-force').then((r) => r.data),

  riskyUsers: () =>
    apiGet<{ data: RiskyUser[] }>('/superadmin/security/risky-users').then((r) => r.data),

  categoryStats: () =>
    apiGet<{ data: CategoryStat[] }>('/superadmin/security/stats/categories').then((r) => r.data),

  blockedIPs: (params?: Record<string, unknown>) =>
    apiGet<{ data: BlockedIP[]; meta: Record<string, unknown> }>(
      '/superadmin/security/blocked-ips',
      params,
    ).then((r) => r.data),

  blockIP: (data: BlockIPPayload) =>
    apiPost('/superadmin/security/blocked-ips', data),

  unblockIP: (ipHash: string) =>
    apiDelete(`/superadmin/security/blocked-ips/${ipHash}`),

  resolveEvent: (id: number) =>
    apiPatch(`/superadmin/security/events/${id}/resolve`, {}),

  traceEvent: (id: number) =>
    apiGet<TraceEventData>(`/superadmin/security/events/${id}/trace`).then((r) => r.data),

  suspendUser: (userId: number) =>
    apiPatch(`/superadmin/security/users/${userId}/suspend`, {}),
}
