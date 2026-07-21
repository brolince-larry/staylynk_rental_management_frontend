// src/features/admin/pages/Rent.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRentCollection, useRentSummary, useRecordRentPayment } from '../hooks'
import { usePagination, useToast } from '@/hooks'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantsApi } from '@/api/tenants'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { FilterBar, Select, Modal, Button, FormField, Input, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge, StatCard, ProgressBar } from '@/components/ui'
import { formatCurrency, formatDate } from '@/utils/format'
import { rentPaymentSchema, type RentPaymentSchema } from '@/schemas'
import { useAuthStore } from '@/store/auth.store'
import { DollarSign, CheckCircle, Clock, AlertCircle, CalendarCheck } from 'lucide-react'

type RentItem = Record<string, unknown>

type LastPaymentForm = { last_paid_date: string; last_paid_amount: number; notes?: string }

export default function RentPage(): React.ReactElement {
  const currency = useAuthStore((s) => s.user?.org?.currency ?? 'KES')
  const [statusFilter, setStatusFilter] = useState('')
  const [recordId,     setRecordId]     = useState<string | null>(null)
  const [lastPayRow,   setLastPayRow]   = useState<{ leaseId: string; tenantName: string; monthlyRent: number } | null>(null)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { toasts, success, error: toastError, dismiss } = useToast()
  const qc = useQueryClient()

  const { data, isLoading, isError } = useRentCollection({
    status: statusFilter || undefined,
    page, per_page: perPage,
  } as Record<string, unknown>)

  const { data: summary } = useRentSummary()
  const { mutate: recordPayment, isPending: recording } = useRecordRentPayment()

  const { mutate: recordLastPay, isPending: recordingLast } = useMutation({
    mutationFn: (d: LastPaymentForm & { leaseId: number }) =>
      tenantsApi.recordLastPayment(d.leaseId, { last_paid_date: d.last_paid_date, last_paid_amount: d.last_paid_amount, notes: d.notes }),
    onSuccess: () => {
      success('Last payment recorded — arrears recalculated')
      setLastPayRow(null)
      lastPayForm.reset()
      void qc.invalidateQueries({ queryKey: ['admin', 'rent'] })
    },
    onError: (err) => toastError(err, 'Failed to record payment'),
  })

  const form = useForm<RentPaymentSchema>({ resolver: zodResolver(rentPaymentSchema) })
  const lastPayForm = useForm<LastPaymentForm>()

  const handleRecord = (values: RentPaymentSchema) => {
    if (!recordId) return
    recordPayment({ invoiceId: recordId, ...values }, {
      onSuccess: () => { success('Payment recorded'); setRecordId(null); form.reset() },
      onError: (err) => toastError(err, 'Failed to record payment'),
    })
  }

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as RentItem[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined
  const sum = summary as Record<string, unknown> | undefined

  const columns: ColumnDef<RentItem>[] = [
    {
      key: 'tenant',
      header: 'Tenant',
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
      key: 'room',
      header: 'Room',
      accessor: (row) => {
        const room = row.room as Record<string, string> | null
        return <span className="text-xs text-foreground">{room?.room_number ?? '—'}</span>
      },
    },
    {
      key: 'invoice_month',
      header: 'Month',
      sortable: true,
      accessor: (row) => <span className="text-xs text-foreground">{row.invoice_month as string}</span>,
    },
    {
      key: 'total_amount',
      header: 'Amount',
      align: 'right',
      accessor: (row) => <span className="text-xs font-medium">{formatCurrency(row.total_amount as number, currency)}</span>,
    },
    {
      key: 'paid_amount',
      header: 'Paid',
      align: 'right',
      accessor: (row) => {
        const paid = row.paid_amount as number
        const total = row.total_amount as number
        const pct = total > 0 ? (paid / total) * 100 : 0
        return (
          <div className="min-w-[80px]">
            <p className="text-xs font-medium text-foreground text-right mb-1">{formatCurrency(paid, currency)}</p>
            <ProgressBar value={pct} color={pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-muted'} />
          </div>
        )
      },
    },
    {
      key: 'due_date',
      header: 'Due Date',
      accessor: (row) => (
        <span className={`text-xs whitespace-nowrap ${row.is_overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
          {formatDate(row.due_date as string)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status as string} />,
    },
    {
      key: 'actions',
      header: '',
      width: 'w-48',
      accessor: (row) => {
        const status = row.status as string
        const lease = row.lease as Record<string, unknown> | null
        const tenant = row.tenant as Record<string, unknown> | null
        return (
          <div className="flex items-center gap-1">
            {status !== 'paid' && (
              <button
                onClick={(e) => { e.stopPropagation(); setRecordId(row.id as string) }}
                className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium"
              >
                Record Payment
              </button>
            )}
            {lease && (
              <button
                onClick={(e) => { e.stopPropagation(); setLastPayRow({ leaseId: lease.id as string, tenantName: tenant?.name as string ?? 'Tenant', monthlyRent: row.total_amount as number ?? 0 }) }}
                className="rounded px-2 py-1 text-xs text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 font-medium flex items-center gap-1"
                title="Record last payment date & amount"
              >
                <CalendarCheck className="h-3 w-3" /> Last Pay
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Rent Collection — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Rent Collection"
          subtitle="Track and record rent payments from all tenants."
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard label="Expected" value={sum ? formatCurrency(sum.expected as number, currency) : '—'} icon={<DollarSign className="h-4 w-4 text-violet-600" />} iconBg="bg-violet-100" />
          <StatCard label="Collected" value={sum ? formatCurrency(sum.collected as number, currency) : '—'} change={sum?.collection_rate ? Math.round(sum.collection_rate as number) : undefined} icon={<CheckCircle className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-100" />
          <StatCard label="Pending" value={sum ? formatCurrency(sum.pending as number, currency) : '—'} icon={<Clock className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-100" />
          <StatCard label="Overdue" value={sum ? formatCurrency(sum.overdue as number, currency) : '—'} icon={<AlertCircle className="h-4 w-4 text-red-500" />} iconBg="bg-red-100" />
        </div>

        <FilterBar>
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            placeholder="All statuses"
            className="w-36 text-xs"
            options={[
              { value: '', label: 'All statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'partially_paid', label: 'Partial' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
            ]}
          />
        </FilterBar>

        <DataTable
          columns={columns} data={rows} keyField="id"
          loading={isLoading} error={isError ? 'Failed to load rent data.' : null}
          emptyTitle="No rent records" pagination={meta}
          onPageChange={setPage} onPerPageChange={setPerPage}
          caption="Rent collection"
        />
      </div>

      <Modal open={!!recordId} onClose={() => { setRecordId(null); form.reset() }}
        title="Record Rent Payment" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRecordId(null)}>Cancel</Button>
            <Button loading={recording} onClick={form.handleSubmit(handleRecord)}>Record Payment</Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(handleRecord)} className="space-y-4">
          <FormField label="Amount" htmlFor="amount" error={form.formState.errors.amount?.message} required>
            <Input id="amount" type="number" min={0} step="0.01" error={!!form.formState.errors.amount} {...form.register('amount')} />
          </FormField>
          <FormField label="Payment Method" htmlFor="method" error={form.formState.errors.method?.message} required>
            <Select id="method" error={!!form.formState.errors.method}
              placeholder="Select method" {...form.register('method')}
              options={[
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'mpesa', label: 'M-Pesa' },
                { value: 'card', label: 'Card' },
                { value: 'cheque', label: 'Cheque' },
              ]}
            />
          </FormField>
          <FormField label="Transaction ID" htmlFor="transaction_id" hint="Optional reference number">
            <Input id="transaction_id" placeholder="TXN123456" {...form.register('transaction_id')} />
          </FormField>
        </form>
      </Modal>

      {/* ── Record Last Payment modal ── */}
      <Modal
        open={!!lastPayRow}
        onClose={() => { setLastPayRow(null); lastPayForm.reset() }}
        title={`Record Last Payment — ${lastPayRow?.tenantName ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setLastPayRow(null)}>Cancel</Button>
            <Button
              loading={recordingLast}
              onClick={lastPayForm.handleSubmit((vals) =>
                lastPayRow && recordLastPay({ ...vals, leaseId: lastPayRow.leaseId })
              )}
            >
              Save Payment Record
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
            Record the last date and amount this tenant paid. The system will recalculate arrears
            (difference between total expected since lease start vs total paid) and update the
            tenant&apos;s next payment due automatically.
          </p>
          <FormField label="Last Payment Date" htmlFor="last_paid_date" required>
            <Input id="last_paid_date" type="date" {...lastPayForm.register('last_paid_date', { required: true })} />
          </FormField>
          <FormField label="Amount Paid" htmlFor="last_paid_amount" hint={`Monthly rent is ${formatCurrency(lastPayRow?.monthlyRent ?? 0, currency)}`} required>
            <Input id="last_paid_amount" type="number" min={0} step="0.01"
              placeholder={String(lastPayRow?.monthlyRent ?? '')}
              {...lastPayForm.register('last_paid_amount', { required: true, valueAsNumber: true })} />
          </FormField>
          <FormField label="Notes" htmlFor="last_pay_notes" hint="Optional">
            <Input id="last_pay_notes" placeholder="e.g. Cash payment, receipt #123" {...lastPayForm.register('notes')} />
          </FormField>
        </div>
      </Modal>
    </>
  )
}