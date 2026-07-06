// src/features/manager/pages/Bookings.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { bookingsApi } from '@/api/bookings'
import { DataTable, type ColumnDef, type SortState } from '@/components/tables/DataTable'
import { SearchInput, FilterBar, Select, Modal, Button, FormField, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge } from '@/components/ui'
import { cancelBookingSchema, type CancelBookingSchema } from '@/schemas/booking.schema'
import { formatCurrency, formatDate } from '@/utils/format'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { BookingConfirmResponse } from '@/api/bookings'

type Booking = Record<string, unknown>
type SourceTab = 'all' | 'admin' | 'public'

export default function ManagerBookings(): React.ReactElement {
  const [sourceTab, setSourceTab] = useState<SourceTab>('all')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [cancelId, setCancelId] = useState<number | null>(null)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [sort, setSort] = useState<SortState>({ column: 'created_at', direction: 'desc' })
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const orgId = useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
  const { toasts, success, error: toastError, dismiss } = useToast()

  const sourceFilter = sourceTab === 'all' ? undefined : sourceTab

  const { data, isLoading, isError } = useQuery({
    queryKey: ['manager', 'bookings', orgId, { search: debouncedSearch, status, source: sourceFilter, sort, page, perPage }],
    queryFn: () => bookingsApi.managerList({
      search: debouncedSearch || undefined,
      status: status || undefined,
      source: sourceFilter,
      sort: sort.column,
      direction: sort.direction,
      page,
      per_page: perPage,
    }).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })

  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['manager', 'bookings', orgId] })

  const { mutate: confirm, isPending: confirming } = useMutation({
    mutationFn: bookingsApi.managerConfirm,
    onSuccess: (res) => {
      const d = res.data as BookingConfirmResponse | undefined
      const cancelled = d?.cancelled_count ?? 0
      success(cancelled > 0
        ? `Booking confirmed. ${cancelled} competing request${cancelled === 1 ? '' : 's'} cancelled.`
        : 'Booking confirmed.')
      void invalidate()
    },
    onError: (err) => toastError(err, 'Failed to confirm'),
  })

  const { mutate: checkIn } = useMutation({
    mutationFn: bookingsApi.managerCheckIn,
    onSuccess: () => { success('Checked in.'); void invalidate() },
    onError: (err) => toastError(err, 'Failed to check in'),
  })

  const { mutate: checkOut } = useMutation({
    mutationFn: bookingsApi.managerCheckOut,
    onSuccess: () => { success('Checked out.'); void invalidate() },
    onError: (err) => toastError(err, 'Failed to check out'),
  })

  const { mutate: noShow } = useMutation({
    mutationFn: bookingsApi.managerNoShow,
    onSuccess: () => { success('Marked as no-show.'); void invalidate() },
    onError: (err) => toastError(err, 'Failed to mark no-show'),
  })

  const { mutate: cancel, isPending: cancelling } = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => bookingsApi.managerCancel(id, reason),
    onSuccess: () => { success('Booking cancelled.'); setCancelId(null); void invalidate() },
    onError: (err) => toastError(err, 'Failed to cancel'),
  })

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => bookingsApi.managerReject(id, reason),
    onSuccess: () => { success('Booking rejected.'); setRejectId(null); void invalidate() },
    onError: (err) => toastError(err, 'Failed to reject'),
  })

  const cancelForm = useForm<CancelBookingSchema>({ resolver: zodResolver(cancelBookingSchema) })
  const rejectForm = useForm<CancelBookingSchema>({ resolver: zodResolver(cancelBookingSchema) })

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as Booking[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<Booking>[] = [
    {
      key: 'booking_number',
      header: 'Booking #',
      width: 'w-36',
      accessor: (row) => (
        <div className="space-y-1">
          <span className="block text-xs font-mono text-muted-foreground">{row.booking_number as string ?? '—'}</span>
          {row.source === 'public' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              <Users className="h-2.5 w-2.5" /> Hunter
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'tenant',
      header: 'Guest / Hunter',
      accessor: (row) => {
        if (row.source === 'public') {
          const h = row.hunter as { name: string; email: string; phone?: string | null; message?: string | null } | null
          if (h) {
            return (
              <div title={h.message ?? undefined}>
                <p className="text-xs font-medium text-foreground">{h.name}</p>
                <p className="text-xs text-muted-foreground">{h.phone ?? h.email}</p>
                {h.message ? (
                  <p className="mt-0.5 line-clamp-1 text-[11px] italic text-muted-foreground">"{h.message}"</p>
                ) : null}
              </div>
            )
          }
        }
        const t = row.tenant as Record<string, string> | null
        return t
          ? (
            <div>
              <p className="text-xs font-medium text-foreground">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.phone ?? t.email}</p>
            </div>
          )
          : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      key: 'room',
      header: 'Room',
      accessor: (row) => {
        const r = row.room as Record<string, string> | null
        const p = row.property as Record<string, string> | null
        return (
          <div>
            <p className="text-xs font-medium text-foreground">{r?.room_number ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{p?.name ?? '—'}</p>
            {row.source === 'public' && row.expires_at ? (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Expires {formatDate(row.expires_at as string)}
              </p>
            ) : null}
          </div>
        )
      },
    },
    {
      key: 'check_in_date',
      header: 'Check In',
      sortable: true,
      accessor: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(row.check_in_date as string)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      accessor: (row) => <span className="text-xs font-semibold">{formatCurrency(row.amount as number)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (row) => {
        const s = row.status as string
        const rejReason = row.rejection_reason as string | null | undefined
        const cancelReason = row.cancellation_reason as string | null | undefined
        return (
          <div className="space-y-1">
            <StatusBadge status={s} />
            {s === 'rejected' && rejReason ? <p className="text-[11px] text-red-500">{rejReason}</p> : null}
            {s === 'cancelled' && cancelReason ? <p className="text-[11px] text-muted-foreground">{cancelReason}</p> : null}
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      width: 'w-44',
      accessor: (row) => {
        const id = row.id as number
        const s = row.status as string
        return (
          <div className="flex flex-wrap items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {s === 'pending' ? (
              <>
                <button onClick={() => confirm(id)} className="rounded px-2 py-1 text-xs text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30">Confirm</button>
                <button onClick={() => setRejectId(id)} className="rounded px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">Reject</button>
              </>
            ) : null}
            {s === 'confirmed' ? (
              <>
                <button onClick={() => checkIn(id)} className="rounded px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30">Check In</button>
                <button onClick={() => noShow(id)} className="rounded px-2 py-1 text-xs text-amber-600 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30">No Show</button>
              </>
            ) : null}
            {s === 'checked_in' ? (
              <button onClick={() => checkOut(id)} className="rounded px-2 py-1 text-xs text-violet-600 transition-colors hover:bg-violet-50 dark:hover:bg-violet-950/30">Check Out</button>
            ) : null}
            {['pending', 'confirmed'].includes(s) ? (
              <button onClick={() => setCancelId(id)} className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted">Cancel</button>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Bookings — Manager</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader title="Bookings" subtitle="Manage all guest bookings across your properties." />

        {/* Source tabs */}
        <div className="mb-4 flex w-fit gap-1 rounded-lg border border-border bg-muted/30 p-1">
          {(['all', 'admin', 'public'] as SourceTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => { setSourceTab(tab); setPage(1) }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                sourceTab === tab
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'admin' ? 'Admin Created' : 'Hunter Requests'}
            </button>
          ))}
        </div>

        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search guest, room…" className="w-64" />
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            placeholder="All statuses"
            className="w-36 text-xs"
            options={[
              { value: '', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'checked_in', label: 'Checked In' },
              { value: 'checked_out', label: 'Checked Out' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'no_show', label: 'No Show' },
            ]}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          loading={isLoading}
          error={isError ? 'Failed to load bookings.' : null}
          emptyTitle={sourceTab === 'public' ? 'No hunter requests' : 'No bookings'}
          sort={sort}
          onSort={(col, dir) => { setSort({ column: col, direction: dir }); setPage(1) }}
          pagination={meta}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          caption="Bookings"
        />
      </div>

      {/* Reject modal */}
      <Modal
        open={!!rejectId}
        onClose={() => { setRejectId(null); rejectForm.reset() }}
        title="Reject Booking Request"
        description="Provide a reason for rejecting this request."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => { setRejectId(null); rejectForm.reset() }}>Keep</Button>
            <Button variant="destructive" loading={rejecting} onClick={rejectForm.handleSubmit((v) => { if (rejectId) reject({ id: rejectId, reason: v.reason }) })}>
              Reject Request
            </Button>
          </>
        }
      >
        <FormField label="Rejection reason" htmlFor="mreason" error={rejectForm.formState.errors.reason?.message} required>
          <Textarea id="mreason" rows={3} placeholder="e.g. Room already taken…" error={!!rejectForm.formState.errors.reason} {...rejectForm.register('reason')} />
        </FormField>
      </Modal>

      {/* Cancel modal */}
      <Modal
        open={!!cancelId}
        onClose={() => { setCancelId(null); cancelForm.reset() }}
        title="Cancel Booking"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelId(null)}>Keep</Button>
            <Button variant="destructive" loading={cancelling} onClick={cancelForm.handleSubmit((v) => { if (cancelId) cancel({ id: cancelId, reason: v.reason }) })}>
              Cancel Booking
            </Button>
          </>
        }
      >
        <FormField label="Reason" htmlFor="creason" error={cancelForm.formState.errors.reason?.message} required>
          <Textarea id="creason" rows={3} placeholder="Reason for cancellation…" error={!!cancelForm.formState.errors.reason} {...cancelForm.register('reason')} />
        </FormField>
      </Modal>
    </>
  )
}
