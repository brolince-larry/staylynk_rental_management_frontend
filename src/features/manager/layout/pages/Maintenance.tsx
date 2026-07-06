// src/features/manager/pages/Maintenance.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useManagerMaintenance, useResolveMaintenance, useAssignMaintenance } from '../hooks'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { SearchInput, FilterBar, Select, Modal, Button, FormField, Input, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge } from '@/components/ui'
import { formatRelative } from '@/utils/format'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resolveMaintenanceSchema, type ResolveMaintenanceSchema } from '@/schemas'

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-600 bg-red-50 dark:bg-red-950/30',
  high:   'text-orange-600 bg-orange-50 dark:bg-orange-950/30',
  medium: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  low:    'text-slate-600 bg-slate-100 dark:bg-slate-800',
}

type MReq = Record<string, unknown>

export default function MaintenancePage(): React.ReactElement {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [resolveId, setResolveId] = useState<number | null>(null)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError } = useManagerMaintenance({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    page, per_page: perPage,
  })

  const { mutate: resolve, isPending: resolving } = useResolveMaintenance()
  const { mutate: assign } = useAssignMaintenance()

  const form = useForm<ResolveMaintenanceSchema>({ resolver: zodResolver(resolveMaintenanceSchema) })

  const handleResolve = (values: ResolveMaintenanceSchema) => {
    if (!resolveId) return
    resolve({ id: resolveId, ...values }, {
      onSuccess: () => { success('Request resolved'); setResolveId(null); form.reset() },
      onError: (err) => toastError(err, 'Failed to resolve'),
    })
  }

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as MReq[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<MReq>[] = [
    {
      key: 'title',
      header: 'Issue',
      accessor: (row) => (
        <div>
          <p className="text-xs font-medium text-foreground">{row.title as string}</p>
          <p className="text-xs text-muted-foreground truncate max-w-xs">{row.description as string}</p>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Location',
      accessor: (row) => {
        const room = row.room as Record<string, string> | null
        const property = row.property as Record<string, string> | null
        return (
          <div>
            <p className="text-xs font-medium text-foreground">{property?.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{room ? `Room ${room.room_number}` : '—'}</p>
          </div>
        )
      },
    },
    {
      key: 'category',
      header: 'Category',
      accessor: (row) => (
        <span className="text-xs text-muted-foreground capitalize">{String(row.category).replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      accessor: (row) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[row.priority as string] ?? ''}`}>
          {row.priority as string}
        </span>
      ),
    },
    { key: 'status', header: 'Status', sortable: true, accessor: (row) => <StatusBadge status={row.status as string} /> },
    {
      key: 'reported_at',
      header: 'Reported',
      accessor: (row) => <span className="text-xs text-muted-foreground">{formatRelative(row.created_at as string)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 'w-24',
      accessor: (row) => {
        const status = row.status as string
        if (['resolved', 'rejected'].includes(status)) return null
        return (
          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            {status === 'open' && (
              <button className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                Assign
              </button>
            )}
            {['open', 'assigned', 'in_progress'].includes(status) && (
              <button
                onClick={() => setResolveId(row.id as number)}
                className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                Resolve
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Maintenance — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader title="Maintenance Requests" subtitle="Track and resolve property maintenance issues." />
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search issue, room…" className="w-60" />
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} placeholder="All statuses" className="w-36 text-xs"
            options={[{ value: '', label: 'All statuses' }, { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' }, { value: 'resolved', label: 'Resolved' }]} />
          <Select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }} placeholder="All priorities" className="w-36 text-xs"
            options={[{ value: '', label: 'All priorities' }, { value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} />
        </FilterBar>
        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading} error={isError ? 'Failed to load.' : null}
          emptyTitle="No maintenance requests" pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Maintenance requests" />
      </div>
      <Modal open={!!resolveId} onClose={() => { setResolveId(null); form.reset() }} title="Resolve Maintenance Request" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setResolveId(null)}>Cancel</Button>
            <Button loading={resolving} onClick={form.handleSubmit(handleResolve)}>Mark Resolved</Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(handleResolve)} className="space-y-4">
          <FormField label="Resolution notes" htmlFor="notes" error={form.formState.errors.resolution_notes?.message} required>
            <Textarea id="notes" rows={3} placeholder="Describe what was done to fix the issue…" error={!!form.formState.errors.resolution_notes} {...form.register('resolution_notes')} />
          </FormField>
          <FormField label="Repair cost (optional)" htmlFor="cost">
            <Input id="cost" type="number" min={0} step="0.01" placeholder="0.00" {...form.register('repair_cost')} />
          </FormField>
        </form>
      </Modal>
    </>
  )
}