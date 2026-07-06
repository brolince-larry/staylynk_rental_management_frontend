// src/features/admin/pages/Leases.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Download } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAdminLeases, useAdminTerminateLease } from '../hooks/useLeases'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef, type SortState } from '@/components/tables/DataTable'
import { SearchInput, FilterBar, Select, Modal, Button, FormField, Input, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge } from '@/components/ui'
import { terminateLeaseSchema, type TerminateLeaseSchema } from '@/schemas/lease.schema'
import { formatCurrency, formatDate } from '@/utils/format'
import { openSignedDocument } from '@/api/documentDownloads'

type Lease = Record<string, unknown>

export default function Leases(): React.ReactElement {
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('')
  const [terminateId, setTerminateId] = useState<number | null>(null)
  const [sort, setSort]             = useState<SortState>({ column: 'start_date', direction: 'desc' })
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const downloadLease = (id: number) => {
    void openSignedDocument(`/admin/leases/${id}/download`, {
      onPending: (message) => success(message),
    }).catch((err) => toastError(err, 'Failed to download lease'))
  }

  const { data, isLoading, isError } = useAdminLeases({
    search:    debouncedSearch || undefined,
    status:    statusFilter    || undefined,
    sort: sort.column, direction: sort.direction,
    page, per_page: perPage,
  })

  const { mutate: terminate, isPending: terminating } = useAdminTerminateLease()

  const form = useForm<TerminateLeaseSchema>({ resolver: zodResolver(terminateLeaseSchema) })

  const handleTerminate = (values: TerminateLeaseSchema) => {
    if (!terminateId) return
    terminate({ id: terminateId, ...values }, {
      onSuccess: () => { success('Lease terminated'); setTerminateId(null); form.reset() },
      onError: (err) => toastError(err, 'Failed to terminate lease'),
    })
  }

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as Lease[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<Lease>[] = [
    {
      key: 'lease_number', header: 'Lease #', width: 'w-36',
      accessor: (row) => <span className="text-xs font-mono text-muted-foreground">{row.lease_number as string}</span>,
    },
    {
      key: 'tenant', header: 'Tenant',
      accessor: (row) => {
        const t = row.tenant as Record<string, string> | null
        return t ? (
          <div>
            <p className="text-xs font-medium text-foreground">{t.name}</p>
            <p className="text-xs text-muted-foreground">{t.email}</p>
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      key: 'room', header: 'Room / Property',
      accessor: (row) => {
        const room = row.room     as Record<string, string> | null
        const prop = row.property as Record<string, string> | null
        return (
          <div>
            <p className="text-xs font-medium text-foreground">{room ? `Room ${room.room_number}` : '—'}</p>
            <p className="text-xs text-muted-foreground">{prop?.name ?? '—'}</p>
          </div>
        )
      },
    },
    {
      key: 'monthly_rent', header: 'Rent', align: 'right', sortable: true,
      accessor: (row) => <span className="text-xs font-semibold">{formatCurrency(row.monthly_rent as number)}</span>,
    },
    {
      key: 'start_date', header: 'Start', sortable: true,
      accessor: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.start_date as string)}</span>,
    },
    {
      key: 'end_date', header: 'End',
      accessor: (row) => {
        const daysLeft = row.days_remaining as number
        return (
          <div>
            <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.end_date as string)}</p>
            {daysLeft !== undefined && daysLeft <= 30 && daysLeft > 0 && (
              <p className="text-xs text-amber-600 font-medium">{daysLeft}d left</p>
            )}
          </div>
        )
      },
    },
    { key: 'status', header: 'Status', sortable: true, accessor: (row) => <StatusBadge status={row.status as string} /> },
    {
      key: 'actions', header: '', width: 'w-28',
      accessor: (row) => {
        const id = row.id as number
        const s  = row.status as string
        return (
          <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => downloadLease(id)}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted">
              <Download className="h-3.5 w-3.5" />
            </button>
            {s === 'active' && (
              <button onClick={() => setTerminateId(id)} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                Terminate
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Leases — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader title="Lease Agreements" subtitle="All tenant lease agreements." />
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tenant, room…" className="w-64" />
          <Select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }} placeholder="All statuses" className="w-36 text-xs"
            options={[{ value:'', label:'All' }, { value:'active', label:'Active' }, { value:'expired', label:'Expired' }, { value:'terminated', label:'Terminated' }]} />
        </FilterBar>
        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading}
          error={isError ? 'Failed to load leases.' : null}
          emptyTitle="No leases found"
          sort={sort} onSort={(col, dir) => { setSort({ column: col, direction: dir }); setPage(1) }}
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Leases list"
        />
      </div>

      <Modal open={!!terminateId} onClose={() => { setTerminateId(null); form.reset() }}
        title="Terminate Lease" description="This action will free the room and end the tenant's active lease."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setTerminateId(null)}>Cancel</Button>
            <Button variant="destructive" loading={terminating} onClick={form.handleSubmit(handleTerminate)}>Terminate</Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(handleTerminate)} className="space-y-4">
          <FormField label="Reason" htmlFor="term-reason" error={form.formState.errors.reason?.message} required>
            <Textarea id="term-reason" rows={3} placeholder="Reason for early termination…"
              error={!!form.formState.errors.reason} {...form.register('reason')} />
          </FormField>
          <FormField label="Termination Date" htmlFor="term-date" hint="Leave blank to use today">
            <Input id="term-date" type="date" {...form.register('termination_date')} />
          </FormField>
        </form>
      </Modal>
    </>
  )
}
