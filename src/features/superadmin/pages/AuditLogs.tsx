// src/features/superadmin/pages/AuditLogs.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSAAuditLogs, useSAAuditSummary } from '../hooks/useUsers'
import { useDebounce, usePagination } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { SearchInput, FilterBar, Select } from '@/components/forms'
import { PageHeader } from '@/components/ui'
import { formatDatetime } from '@/utils/format'

type Log = Record<string, unknown>

// ── Severity-based badge styles ───────────────────────────────────────────
// Keyed on the FULL event string first (e.g. "payment_credential.disabled"),
// falling back to just the part after the last dot (e.g. "deleted") so
// resource-prefixed events (property.deleted, user.role_changed) still get
// a sensible label without needing an entry for every resource/action pair.
const EVENT_BADGE: Record<string, string> = {
  login_failed:                          'border border-red-300 text-red-700 bg-transparent dark:border-red-600 dark:text-red-400',
  login_rate_limited:                    'text-white bg-red-600',
  login_blocked:                         'text-white bg-red-600',
  login_org_suspended:                   'text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
  deleted:                                'text-white bg-red-600',
  updated:                                'text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
  role_changed:                          'text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-900/40',
  sessions_revoked:                      'text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
  billing_voided:                        'text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
  org_suspended:                         'text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
  user_deleted:                          'text-white bg-red-600',
  changed:                               'text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
  voided:                                'text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
  recorded:                              'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40',
  create_approved:                       'text-white bg-red-700',
  update_approved:                       'text-white bg-red-700',
  disabled:                              'text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
  bank_transfer_approved:                'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40',
  bank_transfer_rejected:                'text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
  org_deleted:                           'text-white bg-red-600',
  user_impersonated:                     'text-white bg-red-700',
  org_activated:                         'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40',
  org_ai_limit_updated:                  'text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
  billing_paid:                          'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40',
  user_created:                          'text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-900/40',
  user_updated:                          'text-amber-800 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
  behavior:                              'text-white bg-red-700',
}

const EVENT_LABELS: Record<string, string> = {
  login_failed:            'Failed Login',
  login_rate_limited:      'Rate Limited',
  login_blocked:           'Account Blocked',
  login_org_suspended:     'Org Suspended Login',
  updated:                 'Sensitive Field Changed',
  deleted:                 'Record Deleted',
  role_changed:            'Role Changed',
  org_suspended:           'Org Suspended',
  user_deleted:            'User Deleted',
  sessions_revoked:        'Sessions Revoked',
  billing_voided:          'Billing Voided',
  changed:                 'Credential Changed',
  voided:                  'Voided',
  recorded:                'Payment Recorded',
  create_approved:         'Finance Credential Created',
  update_approved:         'Finance Credential Updated',
  disabled:                'Finance Credential Disabled',
  bank_transfer_approved:  'Bank Transfer Approved',
  bank_transfer_rejected:  'Bank Transfer Rejected',
  org_deleted:             'Organisation Deleted',
  user_impersonated:       'User Impersonated',
  org_activated:           'Organisation Activated',
  org_ai_limit_updated:    'AI Limit Updated',
  billing_paid:            'Billing Paid',
  user_created:            'User Created',
  user_updated:            'User Updated',
  behavior:                'Suspicious Behavior Flagged',
}

function lastSegment(event: string): string {
  return event.includes('.') ? event.split('.').pop() ?? event : event
}

// ── Resource diff cell ────────────────────────────────────────────────────
function ResourceCell({ row }: { row: Log }): React.ReactElement {
  const modelType  = row.auditable_type as string | null
  const modelId    = row.auditable_id ?? row.model_id
  const oldValues  = row.old_values as Record<string, unknown> | null
  const newValues  = row.new_values as Record<string, unknown> | null

  const modelName = modelType
    ? modelType.split('\\').pop() ?? modelType
    : (row.model as string | null)

  const changedKeys = newValues ? Object.keys(newValues) : []

  return (
    <div className="space-y-0.5">
      {modelName ? (
        <p className="text-xs font-medium text-foreground">
          {modelName}{modelId !== undefined && modelId !== null ? ` #${String(modelId)}` : ''}
        </p>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
      {changedKeys.map((key) => {
        const oldVal = oldValues?.[key]
        const newVal = newValues?.[key]
        return (
          <p key={key} className="text-[11px] font-mono text-muted-foreground">
            {key}:{' '}
            {oldVal !== undefined && (
              <span className="text-red-500 dark:text-red-400">{String(oldVal)}</span>
            )}
            {oldVal !== undefined && newVal !== undefined && ' → '}
            {newVal !== undefined && (
              <span className="text-emerald-600 dark:text-emerald-400">{String(newVal)}</span>
            )}
          </p>
        )
      })}
    </div>
  )
}

// ── Brute force summary card ──────────────────────────────────────────────
function BruteForceCard(): React.ReactElement | null {
  const { data } = useSAAuditSummary()
  const summary = data as Record<string, unknown> | undefined
  const failedIps = summary?.failed_logins as Array<Record<string, unknown>> | undefined

  if (!failedIps?.length) return null

  return (
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50/70 dark:border-red-800 dark:bg-red-950/20 p-4">
      <p className="mb-3 text-sm font-semibold text-red-700 dark:text-red-400">
        🚨 Brute Force Attempts (3+ failed logins in 30 days)
      </p>
      <div className="space-y-2">
        {failedIps.map((entry, i) => {
          const ip      = entry.ip_address as string
          const count   = entry.count as number
          const lastAt  = entry.last_attempt as string | null
          const email   = entry.email as string | null
          const name    = entry.name as string | null
          return (
            <div
              key={`${ip}-${i}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-0.5 rounded-lg border border-red-200 bg-white px-3 py-2 dark:border-red-800 dark:bg-red-950/30"
            >
              <span className="font-mono text-xs font-semibold text-foreground">{ip}</span>
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                {count} attempt{count !== 1 ? 's' : ''}
              </span>
              {lastAt && (
                <span className="text-xs text-muted-foreground">
                  Last: {formatDatetime(lastAt)}
                </span>
              )}
              {(email || name) && (
                <span className="text-[11px] text-muted-foreground">
                  {name ? `${name} · ` : ''}{email ?? ''}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AuditLogs(): React.ReactElement {
  const [search, setSearch] = useState('')
  const [event,  setEvent]  = useState('')
  const [tag,    setTag]    = useState('')
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)

  const { data, isLoading, isError } = useSAAuditLogs({
    search: debouncedSearch || undefined,
    event:  event || undefined,
    tags:   tag   || undefined,
    page,
    per_page: perPage,
  })

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as Log[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<Log>[] = [
    {
      key: 'event', header: 'Event',
      accessor: (row) => {
        const e      = row.event as string
        const suffix = lastSegment(e)
        const badge  = EVENT_BADGE[e] ?? EVENT_BADGE[suffix] ?? 'text-foreground bg-muted'
        const label  = EVENT_LABELS[e] ?? EVENT_LABELS[suffix] ?? e.replace(/[._]/g, ' ')
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
            {label}
          </span>
        )
      },
    },
    {
      key: 'user', header: 'Actor',
      accessor: (row) => {
        const u = row.user as Record<string, string> | null
        return u ? (
          <div>
            <p className="text-xs font-medium text-foreground">{u.name}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
        ) : <span className="text-xs text-muted-foreground">System</span>
      },
    },
    {
      key: 'resource', header: 'Resource / Change',
      accessor: (row) => <ResourceCell row={row} />,
    },
    {
      key: 'ip_address', header: 'IP',
      accessor: (row) => (
        <span className="text-xs font-mono text-muted-foreground">
          {(row.ip_address as string) ?? '—'}
        </span>
      ),
    },
    {
      key: 'created_at', header: 'Time', sortable: true,
      accessor: (row) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDatetime(row.created_at as string)}
        </span>
      ),
    },
  ]

  return (
    <>
      <Helmet><title>Security Audit Log — StayLynk</title></Helmet>
      <div className="p-6">
        <PageHeader
          title="Security Audit Log"
          subtitle="Suspicious and security-relevant activity only. Routine logins and normal record updates are not recorded."
        />

        <BruteForceCard />

        <FilterBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search IP, email, or name…"
            className="w-64"
          />
          <Select
            value={event}
            onChange={(e) => { setEvent(e.target.value); setPage(1) }}
            placeholder="All security events"
            className="w-52 text-xs"
            options={[
              { value: '',                    label: 'All security events' },
              { value: 'login_failed',        label: 'Failed Login' },
              { value: 'login_rate_limited',  label: 'Rate Limited' },
              { value: 'login_blocked',       label: 'Account Blocked' },
              { value: 'login_org_suspended', label: 'Org Suspended Login' },
              { value: 'updated',             label: 'Sensitive Field Changed' },
              { value: 'deleted',             label: 'Record Deleted' },
              { value: 'role_changed',        label: 'Role Changed' },
              { value: 'org_suspended',       label: 'Org Suspended' },
              { value: 'user_deleted',        label: 'User Deleted' },
              { value: 'sessions_revoked',    label: 'Sessions Revoked' },
              { value: 'billing_voided',      label: 'Billing Voided' },
            ]}
          />
          <Select
            value={tag}
            onChange={(e) => { setTag(e.target.value); setPage(1) }}
            placeholder="All tags"
            className="w-36 text-xs"
            options={[
              { value: '',        label: 'All tags' },
              { value: 'auth',    label: 'Auth' },
              { value: 'billing', label: 'Billing' },
              { value: 'admin',   label: 'Admin' },
              { value: 'general', label: 'General' },
            ]}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          loading={isLoading}
          error={isError ? 'Failed to load audit logs.' : null}
          emptyTitle="No security events"
          emptyDescription="No suspicious or security-relevant activity has been recorded."
          pagination={meta}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          caption="Security audit log"
        />
      </div>
    </>
  )
}
