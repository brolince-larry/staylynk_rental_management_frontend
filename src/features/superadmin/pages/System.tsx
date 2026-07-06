// src/features/superadmin/pages/System.tsx
import React from 'react'
import { Helmet } from 'react-helmet-async'
import { apiGet, apiPost } from '@/api/client'
import { useQuery, useMutation } from '@tanstack/react-query'
import { QK } from '@/constants/queryKeys'
import { PageHeader, SectionCard, ProgressBar } from '@/components/ui'
import { Button, ToastContainer } from '@/components/forms'
import { useToast } from '@/hooks'
import { Database, HardDrive, Activity, RefreshCw, Download, Zap, ListChecks, Globe2 } from 'lucide-react'

type UsagePayload = {
  api_requests?: { total?: number; display?: string }
  storage?: { used_bytes?: number; used_display?: string; total_bytes?: number; total_display?: string; pct?: number }
  bandwidth?: { total_bytes?: number; display?: string; source?: string }
  active_users?: { last_30_days?: number; total?: number }
}

const HEALTH_ICONS = {
  database: Database,
  cache: Zap,
  redis: Zap,
  queue: ListChecks,
  storage: HardDrive,
  api: Activity,
} as const

export default function System(): React.ReactElement {
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data: healthData, isLoading: healthLoading, refetch } = useQuery({
    queryKey: QK.saSystem(),
    queryFn:  () => apiGet<Record<string, unknown>>('/superadmin/system/health').then(r => r.data),
  })

  const { data: usageData } = useQuery({
    queryKey: QK.saSystemUsage(),
    queryFn:  () => apiGet<Record<string, unknown>>('/superadmin/system/usage').then(r => r.data),
  })

  const { data: perfData } = useQuery({
    queryKey: QK.saSystemPerf(),
    queryFn:  () => apiGet<Record<string, unknown>>('/superadmin/system/performance').then(r => r.data),
  })

  const { mutate: runBackup, isPending: backing } = useMutation({
    mutationFn: () => apiPost<{ message: string }>('/superadmin/system/backup'),
    onSuccess:  () => success('Backup initiated. You will be notified when complete.'),
    onError: (err) => toastError(err, 'Failed to initiate backup'),
  })

  const health  = healthData as Record<string, unknown> | undefined
  const usage   = usageData  as UsagePayload | undefined
  const perf    = perfData   as Record<string, unknown> | undefined
  const storage = usage?.storage
  const bandwidth = usage?.bandwidth
  const storageValue = `${storage?.used_display ?? '—'} / ${storage?.total_display ?? '—'}`
  const bandwidthValue = bandwidth?.display ?? '—'

  const STATUS_COLOR: Record<string, string> = {
    healthy: 'text-emerald-600',
    warning: 'text-amber-600',
    error:   'text-red-500',
  }

  return (
    <>
      <Helmet><title>System Settings — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6 max-w-[1200px]">
        <PageHeader
          title="System Monitor"
          subtitle="Platform health, performance, and system management."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button size="sm" loading={backing} onClick={() => runBackup()}>
                <Download className="h-3.5 w-3.5" /> Backup System
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* System Health */}
          <SectionCard title="System Health">
            {healthLoading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div>
            ) : (
              <div className="space-y-0">
                {Object.entries((health?.checks as Record<string, Record<string, unknown>>) ?? {}).map(([key, check]) => {
                  const Icon = HEALTH_ICONS[key as keyof typeof HEALTH_ICONS] ?? Globe2

                  return (
                  <div key={key} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-semibold capitalize ${STATUS_COLOR[check.status as string] ?? 'text-foreground'}`}>
                        {check.status as string}
                      </span>
                      {check.latency_ms !== undefined && check.latency_ms !== null && (
                        <span className="text-xs text-muted-foreground ml-2">{Number(check.latency_ms)}ms</span>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* System Usage */}
          <SectionCard title="System Usage">
            {[
              { label: 'API Requests', value: usage?.api_requests?.display ?? '—', pct: 0 },
              { label: 'Storage Used', value: storageValue, pct: storage?.pct ?? 0 },
              { label: 'Bandwidth',    value: bandwidthValue, pct: 0 },
              { label: 'Active Users', value: (usage?.active_users?.last_30_days ?? 0).toLocaleString(), pct: 0, color: 'bg-emerald-500' },
            ].map(row => (
              <div key={row.label} className="mb-4 last:mb-0">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium text-foreground">{row.value}</span>
                </div>
                <ProgressBar value={row.pct} color={row.color} />
              </div>
            ))}
          </SectionCard>
        </div>

        {/* Queue depths */}
        {perf && (
          <SectionCard title="Queue Depths">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries((perf.queue_depths as Record<string, number>) ?? {}).map(([q, depth]) => (
                <div key={q} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1 capitalize">{q}</p>
                  <p className={`text-xl font-bold ${depth > 100 ? 'text-red-500' : depth > 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {depth}
                  </p>
                  <p className="text-xs text-muted-foreground">pending</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </>
  )
}
