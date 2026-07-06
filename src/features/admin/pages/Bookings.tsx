// src/features/admin/pages/Bookings.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { AlertTriangle, Plus, Trash2, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  useBookings, useBookingSummary, useCreateBooking, useConfirmBooking,
  useCheckIn, useCheckOut, useCancelBooking, useRejectBooking,
  useNoShowBooking, useClearRejectedBookings,
} from '../hooks'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import {
  SearchInput, FilterBar, Select, Modal, Button,
  FormField, Input, Textarea, ToastContainer,
} from '@/components/forms'
import { PageHeader, StatusBadge } from '@/components/ui'
import { formatCurrency, formatDate } from '@/utils/format'
import { bookingSchema, type BookingSchema, cancelBookingSchema, type CancelBookingSchema } from '@/schemas'
import type { BookingConfirmResponse, BookingCheckInResponse } from '@/api/bookings'

type Booking = Record<string, unknown>
type SourceTab = 'all' | 'admin' | 'public'

// ─── Column definitions ───────────────────────────────────────────────────
function buildColumns(
  onConfirm: (id: number) => void,
  onCheckIn: (id: number) => void,
  onCheckOut: (id: number) => void,
  onCancel: (id: number) => void,
  onReject: (id: number) => void,
  onNoShow: (id: number) => void,
): ColumnDef<Booking>[] {
  return [
    {
      key: 'booking_number',
      header: 'Booking #',
      sortable: true,
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
      header: 'Tenant / Hunter',
      sortable: true,
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
        return t ? (
          <div>
            <p className="text-xs font-medium text-foreground">{t.name}</p>
            <p className="text-xs text-muted-foreground">{t.email}</p>
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      key: 'property',
      header: 'Property / Room',
      accessor: (row) => (
        <div>
          <p className="text-xs font-medium text-foreground">
            {(row.property as Record<string, string> | null)?.name ?? '—'}
          </p>
          <p className="text-xs text-muted-foreground">
            Room {(row.room as Record<string, string> | null)?.room_number ?? '—'}
          </p>
          {row.source === 'public' && row.expires_at ? (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Expires {formatDate(row.expires_at as string)}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'check_in_date',
      header: 'Check In',
      sortable: true,
      accessor: (row) => (
        <span className="whitespace-nowrap text-xs text-foreground">
          {formatDate(row.check_in_date as string)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      align: 'right',
      accessor: (row) => (
        <span className="text-xs font-medium text-foreground">
          {formatCurrency(row.amount as number)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (row) => {
        const status = row.status as string
        const rejectionReason = row.rejection_reason as string | null | undefined
        const cancellationReason = row.cancellation_reason as string | null | undefined
        return (
          <div className="space-y-1">
            <StatusBadge status={status} />
            {status === 'rejected' && rejectionReason ? (
              <p className="text-[11px] text-red-500 dark:text-red-400">{rejectionReason}</p>
            ) : null}
            {status === 'cancelled' && cancellationReason ? (
              <p className="text-[11px] text-muted-foreground">{cancellationReason}</p>
            ) : null}
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
        const status = row.status as string
        return (
          <div className="flex flex-wrap items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {status === 'pending' ? (
              <>
                <button
                  onClick={() => onConfirm(id)}
                  className="rounded px-2 py-1 text-xs text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  Confirm
                </button>
                <button
                  onClick={() => onReject(id)}
                  className="rounded px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Reject
                </button>
              </>
            ) : null}
            {status === 'confirmed' ? (
              <>
                <button
                  onClick={() => onCheckIn(id)}
                  className="rounded px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
                >
                  Check In
                </button>
                <button
                  onClick={() => onNoShow(id)}
                  className="rounded px-2 py-1 text-xs text-amber-600 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  No Show
                </button>
              </>
            ) : null}
            {status === 'checked_in' ? (
              <button
                onClick={() => onCheckOut(id)}
                className="rounded px-2 py-1 text-xs text-violet-600 transition-colors hover:bg-violet-50 dark:hover:bg-violet-950/30"
              >
                Check Out
              </button>
            ) : null}
            {['pending', 'confirmed'].includes(status) ? (
              <button
                onClick={() => onCancel(id)}
                className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
            ) : null}
          </div>
        )
      },
    },
  ]
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function BookingsPage(): React.ReactElement {
  const [sourceTab, setSourceTab] = useState<SourceTab>('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' }>({ column: 'created_at', direction: 'desc' })
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [cancelId, setCancelId] = useState<number | null>(null)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  const sourceFilter = sourceTab === 'all' ? undefined : sourceTab

  // Queries
  const { data, isLoading, isError } = useBookings({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    source: sourceFilter,
    sort: sort.column,
    direction: sort.direction,
    page,
    per_page: perPage,
  })

  const { data: summaryData } = useBookingSummary()
  const summary = summaryData as Record<string, number> | undefined

  // Mutations
  const { mutate: confirmBooking, isPending: confirming } = useConfirmBooking()
  const { mutate: checkIn } = useCheckIn()
  const { mutate: checkOut } = useCheckOut()
  const { mutate: cancelBooking, isPending: cancelling } = useCancelBooking()
  const { mutate: rejectBooking, isPending: rejecting } = useRejectBooking()
  const { mutate: noShowBooking } = useNoShowBooking()
  const { mutate: clearRejected, isPending: clearing } = useClearRejectedBookings()
  const { mutate: createBooking, isPending: creating } = useCreateBooking()

  // Forms
  const cancelForm = useForm<CancelBookingSchema>({ resolver: zodResolver(cancelBookingSchema) })
  const rejectForm = useForm<CancelBookingSchema>({ resolver: zodResolver(cancelBookingSchema) })
  const createForm = useForm<BookingSchema>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { amount: 0, deposit_paid: 0 },
  })

  // Handlers
  const handleConfirm = (id: number) => {
    confirmBooking(id, {
      onSuccess: (res) => {
        const data = res.data as BookingConfirmResponse | undefined
        const cancelled = data?.cancelled_count ?? 0
        success(
          cancelled > 0
            ? `Booking confirmed. ${cancelled} competing request${cancelled === 1 ? '' : 's'} automatically cancelled.`
            : 'Booking confirmed.'
        )
      },
      onError: (err) => toastError(err, 'Failed to confirm booking'),
    })
  }

  const handleCheckIn = (id: number) => {
    checkIn(id, {
      onSuccess: (res) => {
        const data = res.data as BookingCheckInResponse | undefined
        if (data?.tenant_created) {
          success('Checked in. Tenant account created automatically — lease and first invoice (rent + deposit) generated.')
        } else {
          success('Tenant checked in successfully.')
        }
      },
      onError: (err) => toastError(err, 'Failed to check in'),
    })
  }

  const handleCheckOut = (id: number) => {
    checkOut(id, {
      onSuccess: () => success('Tenant checked out successfully.'),
      onError: (err) => toastError(err, 'Failed to check out'),
    })
  }

  const handleNoShow = (id: number) => {
    noShowBooking(id, {
      onSuccess: () => success('Booking marked as no-show.'),
      onError: (err) => toastError(err, 'Failed to mark no-show'),
    })
  }

  const handleCancelSubmit = (values: CancelBookingSchema) => {
    if (!cancelId) return
    cancelBooking(
      { id: cancelId, reason: values.reason },
      {
        onSuccess: () => { success('Booking cancelled.'); setCancelId(null); cancelForm.reset() },
        onError: (err) => toastError(err, 'Failed to cancel booking'),
      },
    )
  }

  const handleRejectSubmit = (values: CancelBookingSchema) => {
    if (!rejectId) return
    rejectBooking(
      { id: rejectId, reason: values.reason },
      {
        onSuccess: () => { success('Booking rejected.'); setRejectId(null); rejectForm.reset() },
        onError: (err) => toastError(err, 'Failed to reject booking'),
      },
    )
  }

  const handleClearRejected = () => {
    clearRejected(undefined, {
      onSuccess: (res) => {
        const deleted = (res.data as { deleted?: number } | undefined)?.deleted ?? 0
        success(`Cleared ${deleted} rejected request${deleted === 1 ? '' : 's'}.`)
        setClearConfirmOpen(false)
      },
      onError: (err) => toastError(err, 'Failed to clear rejected requests'),
    })
  }

  const handleCreate = (values: BookingSchema) => {
    createBooking(values as unknown as Parameters<typeof createBooking>[0], {
      onSuccess: () => { success('Booking created.'); setCreateOpen(false); createForm.reset() },
      onError: (err) => toastError(err, 'Failed to create booking'),
    })
  }

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as Booking[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const hasRejectedPublic = sourceTab === 'public' && rows.some((r) => r.status === 'rejected')

  const columns = buildColumns(handleConfirm, handleCheckIn, handleCheckOut, (id) => setCancelId(id), (id) => setRejectId(id), handleNoShow)

  const summaryCards = [
    { label: 'Total', value: summary?.total ?? meta?.total ?? 0, color: 'text-foreground' },
    { label: 'Pending', value: summary?.pending ?? '—', color: 'text-amber-600' },
    { label: 'Confirmed', value: summary?.confirmed ?? '—', color: 'text-emerald-600' },
    { label: 'Checked In', value: summary?.checked_in ?? '—', color: 'text-blue-600' },
  ]

  return (
    <>
      <Helmet><title>Bookings — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="p-6">
        <PageHeader
          title="Bookings"
          subtitle="Manage all tenant bookings across your properties."
          actions={
            <div className="flex items-center gap-2">
              {hasRejectedPublic ? (
                <Button variant="outline" size="sm" onClick={() => setClearConfirmOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Rejected
                </Button>
              ) : null}
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                New Booking
              </Button>
            </div>
          }
        />

        {/* Summary cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaryCards.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`mt-1 text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

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

        {/* Filters */}
        <FilterBar
          actions={
            <Button size="sm" variant="outline" onClick={() => { setSearch(''); setStatusFilter('') }}>
              Clear
            </Button>
          }
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search tenant, room…"
            className="w-64"
          />
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            placeholder="All statuses"
            className="w-40 text-xs"
            options={[
              { value: '', label: 'All statuses' },
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

        {/* Table */}
        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          loading={isLoading}
          error={isError ? 'Failed to load bookings.' : null}
          emptyTitle={sourceTab === 'public' ? 'No hunter requests' : 'No bookings found'}
          emptyDescription={
            sourceTab === 'public'
              ? 'Public house hunters will appear here once they book.'
              : search ? 'Try a different search term.' : 'Create your first booking to get started.'
          }
          sort={sort}
          onSort={(col, dir) => { setSort({ column: col, direction: dir }); setPage(1) }}
          pagination={meta}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          caption="Bookings list"
        />
      </div>

      {/* ── Reject dialog ───────────────────────────────────────────── */}
      <Modal
        open={!!rejectId}
        onClose={() => { setRejectId(null); rejectForm.reset() }}
        title="Reject Booking Request"
        description="This will reject the hunter's booking request. Provide a reason — it may be shown to the applicant."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => { setRejectId(null); rejectForm.reset() }}>
              Keep
            </Button>
            <Button
              variant="destructive"
              loading={rejecting}
              onClick={rejectForm.handleSubmit(handleRejectSubmit)}
            >
              Reject Request
            </Button>
          </>
        }
      >
        <form onSubmit={rejectForm.handleSubmit(handleRejectSubmit)}>
          <FormField
            label="Rejection reason"
            htmlFor="reject-reason"
            error={rejectForm.formState.errors.reason?.message}
            required
          >
            <Textarea
              id="reject-reason"
              rows={3}
              placeholder="e.g. Room already taken, budget mismatch…"
              error={!!rejectForm.formState.errors.reason}
              {...rejectForm.register('reason')}
            />
          </FormField>
        </form>
      </Modal>

      {/* ── Cancel dialog ───────────────────────────────────────────── */}
      <Modal
        open={!!cancelId}
        onClose={() => { setCancelId(null); cancelForm.reset() }}
        title="Cancel Booking"
        description="This action cannot be undone. The room will be freed."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelId(null)}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              loading={cancelling}
              onClick={cancelForm.handleSubmit(handleCancelSubmit)}
            >
              Cancel Booking
            </Button>
          </>
        }
      >
        <form onSubmit={cancelForm.handleSubmit(handleCancelSubmit)}>
          <FormField
            label="Reason for cancellation"
            htmlFor="cancel-reason"
            error={cancelForm.formState.errors.reason?.message}
            required
          >
            <Textarea
              id="cancel-reason"
              rows={3}
              placeholder="Please provide a reason…"
              error={!!cancelForm.formState.errors.reason}
              {...cancelForm.register('reason')}
            />
          </FormField>
        </form>
      </Modal>

      {/* ── Clear rejected confirm ──────────────────────────────────── */}
      <Modal
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="Clear Rejected Requests"
        description="This permanently deletes all rejected hunter booking requests. This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setClearConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={clearing} onClick={handleClearRejected}>
              <AlertTriangle className="h-3.5 w-3.5" />
              Clear All Rejected
            </Button>
          </>
        }
      />

      {/* ── Create booking modal ────────────────────────────────────── */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); createForm.reset() }}
        title="New Booking"
        description="Create a new booking for a tenant."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={creating} onClick={createForm.handleSubmit(handleCreate)}>
              Create Booking
            </Button>
          </>
        }
      >
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="grid grid-cols-2 gap-4">
          <FormField label="Room ID" htmlFor="room_id" error={createForm.formState.errors.room_id?.message} required>
            <Input id="room_id" type="number" min={1} error={!!createForm.formState.errors.room_id} {...createForm.register('room_id')} />
          </FormField>
          <FormField label="Tenant ID" htmlFor="tenant_id" error={createForm.formState.errors.tenant_id?.message} required>
            <Input id="tenant_id" type="number" min={1} error={!!createForm.formState.errors.tenant_id} {...createForm.register('tenant_id')} />
          </FormField>
          <FormField label="Amount" htmlFor="amount" error={createForm.formState.errors.amount?.message} required>
            <Input id="amount" type="number" min={0} step="0.01" error={!!createForm.formState.errors.amount} {...createForm.register('amount')} />
          </FormField>
          <FormField label="Check-In Date" htmlFor="check_in_date" error={createForm.formState.errors.check_in_date?.message} required>
            <Input id="check_in_date" type="date" error={!!createForm.formState.errors.check_in_date} {...createForm.register('check_in_date')} />
          </FormField>
          <FormField label="Check-Out Date" htmlFor="check_out_date">
            <Input id="check_out_date" type="date" {...createForm.register('check_out_date')} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Notes" htmlFor="notes">
              <Textarea id="notes" rows={2} placeholder="Optional notes…" {...createForm.register('notes')} />
            </FormField>
          </div>
        </form>
      </Modal>
    </>
  )
}
