// src/features/superadmin/pages/Organizations.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useOrganizations, useSuspendOrganization, useActivateOrganization } from '../hooks/useOrganizations'
import { useBodyScrollLock, useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { SearchInput, FilterBar, Select, Button, ConfirmDialog, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge } from '@/components/ui'
import { formatRelative } from '@/utils/format'
import { apiPatch } from '@/api/client'
import { getErrorMessage } from '@/utils/errors'
import { Sparkles, X } from 'lucide-react'

type Org = Record<string, unknown>

// ── AI Limit Dialog ───────────────────────────────────────────────────────────

function AILimitDialog({
  org,
  onClose,
  onSaved,
}: {
  org: Org
  onClose: () => void
  onSaved: (orgId: number, newLimit: number | null) => void
}): React.ReactElement {
  const currentOverride = (org.settings as Record<string, unknown> | undefined)?.ai_requests_per_day
  const [value, setValue] = useState<string>(
    currentOverride !== undefined && currentOverride !== null ? String(currentOverride) : ''
  )
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setLocalError(null)
    try {
      const payload: { ai_requests_per_day: number | null } = {
        ai_requests_per_day: value.trim() === '' ? null : parseInt(value, 10),
      }
      await apiPatch(`/superadmin/organizations/${org.uuid as string}/ai-limit`, payload)
      onSaved(org.id as number, payload.ai_requests_per_day)
      onClose()
    } catch (err) {
      setLocalError(getErrorMessage(err) || 'Failed to update AI limit.')
    } finally {
      setSaving(false)
    }
  }

  const planLimit = (() => {
    const sub = org.active_subscription as Record<string, unknown> | null
    return (sub?.ai_requests_per_day as number | undefined) ?? null
  })()

  useBodyScrollLock(true)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40">
            <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-300" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">AI Daily Limit</h2>
            <p className="text-xs text-muted-foreground">{org.name as string}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">
              Daily AI Requests Override
            </label>
            <input
              type="number"
              min={0}
              max={100000}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={planLimit !== null ? `Plan default: ${planLimit}` : 'Enter limit (0 = unlimited)'}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
            />
            <p className="mt-1.5 text-[0.68rem] text-muted-foreground">
              Leave blank to use the plan default.{' '}
              <strong>0</strong> = unlimited.{' '}
              {planLimit !== null && <>Plan default: <strong>{planLimit}</strong> requests/day.</>}
            </p>
          </div>

          <div className="rounded-lg border border-orange-200/60 bg-orange-50/60 px-3 py-2.5 text-xs text-orange-800 dark:border-orange-400/20 dark:bg-orange-950/30 dark:text-orange-200">
            <strong>Superadmin override:</strong> This setting supersedes the organisation's subscription plan limit and takes effect immediately.
          </div>

          {localError && (
            <p className="text-xs text-red-500">{localError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={onClose} variant="ghost" className="flex-1 text-xs">Cancel</Button>
            <Button onClick={save} loading={saving} className="flex-1 text-xs bg-violet-600 hover:bg-violet-500 text-white">
              Save Override
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Organizations(): React.ReactElement {
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [suspendId, setSuspendId] = useState<number | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [aiLimitOrg, setAiLimitOrg] = useState<Org | null>(null)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError } = useOrganizations({
    search: debouncedSearch || undefined,
    status: status || undefined,
    page, per_page: perPage,
  })

  const { mutate: suspend, isPending: suspending } = useSuspendOrganization()
  const { mutate: activate } = useActivateOrganization()

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as Org[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<Org>[] = [
    {
      key: 'name', header: 'Organisation', sortable: true,
      accessor: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {String(row.name ?? '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{row.name as string}</p>
            <p className="text-xs text-muted-foreground">{row.email as string}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'owner', header: 'Owner',
      accessor: (row) => {
        const o = row.owner as Record<string, string> | null
        return <span className="text-xs text-foreground">{o?.name ?? '—'}</span>
      },
    },
    {
      key: 'plan', header: 'Plan',
      accessor: (row) => {
        const sub = row.active_subscription as Record<string, unknown> | null
        const planColors: Record<string, string> = {
          enterprise: 'text-violet-600 font-semibold',
          professional: 'text-blue-600 font-semibold',
          standard: 'text-emerald-600 font-semibold',
          basic: 'text-amber-600 font-semibold',
        }
        const slug = sub?.plan_slug as string ?? ''
        return (
          <span className={`text-xs ${planColors[slug] ?? 'text-foreground'}`}>
            {sub?.plan_name as string ?? 'No plan'}
          </span>
        )
      },
    },
    {
      key: 'ai_limit', header: 'AI Limit',
      accessor: (row) => {
        const settings = row.settings as Record<string, unknown> | null
        const override = settings?.ai_requests_per_day
        const sub = row.active_subscription as Record<string, unknown> | null
        const planLimit = sub?.ai_requests_per_day as number | undefined

        if (override !== undefined && override !== null) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[0.65rem] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              <Sparkles className="h-2.5 w-2.5" />
              {Number(override) === 0 ? '∞' : `${Number(override).toLocaleString()}/d`}
            </span>
          )
        }

        return (
          <span className="text-[0.65rem] text-muted-foreground">
            {planLimit !== undefined ? `${planLimit.toLocaleString()}/d` : '—'}
          </span>
        )
      },
    },
    {
      key: 'properties_count', header: 'Properties', align: 'right',
      accessor: (row) => <span className="text-xs">{row.properties_count as number ?? 0}</span>,
    },
    {
      key: 'users_count', header: 'Tenants', align: 'right',
      accessor: (row) => <span className="text-xs">{(row.users_count as number ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'status', header: 'Status', sortable: true,
      accessor: (row) => <StatusBadge status={row.status as string} />,
    },
    {
      key: 'created_at', header: 'Joined',
      accessor: (row) => <span className="text-xs text-muted-foreground">{formatRelative(row.created_at as string)}</span>,
    },
    {
      key: 'actions', header: '', width: 'w-36',
      accessor: (row) => {
        const id = row.id as number
        const s  = row.status as string
        return (
          <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setAiLimitOrg(row)}
              title="Set AI limit"
              className="rounded p-1.5 text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            {s === 'active' || s === 'trial' ? (
              <button onClick={() => setSuspendId(id)}
                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                Suspend
              </button>
            ) : (
              <button
                onClick={() => activate(id, { onSuccess: () => success('Organisation activated') })}
                className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                Activate
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Organisations — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader title="Organisations" subtitle="All organisations on the StayLynk platform." />
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email…" className="w-64" />
          <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
            placeholder="All statuses" className="w-36 text-xs"
            options={[
              { value: '', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'trial', label: 'Trial' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </FilterBar>
        <DataTable columns={columns} data={rows} keyField="id"
          loading={isLoading} error={isError ? 'Failed to load organisations.' : null}
          emptyTitle="No organisations found"
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage}
          caption="Organisations list"
        />
      </div>

      <ConfirmDialog
        open={!!suspendId} onClose={() => { setSuspendId(null); setSuspendReason('') }}
        onConfirm={() => {
          if (!suspendId) return
          suspend({ id: suspendId, reason: suspendReason || 'Suspended by admin' }, {
            onSuccess: () => { success('Organisation suspended'); setSuspendId(null) },
            onError: (err) => toastError(err, 'Failed to suspend'),
          })
        }}
        title="Suspend Organisation"
        description="This will immediately lock out all users in this organisation."
        confirmLabel="Suspend" variant="destructive" loading={suspending}
      />

      {aiLimitOrg && (
        <AILimitDialog
          org={aiLimitOrg}
          onClose={() => setAiLimitOrg(null)}
          onSaved={(_id, limit) => {
            success(
              limit === null
                ? 'AI limit override removed.'
                : limit === 0
                  ? 'AI requests set to unlimited.'
                  : `AI daily limit set to ${limit.toLocaleString()} requests.`
            )
          }}
        />
      )}
    </>
  )
}
