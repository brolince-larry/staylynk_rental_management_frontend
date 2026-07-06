// src/features/superadmin/pages/Billing.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useBillingInvoices, useBillingOverview, useMarkBillingPaid, useVoidBillingInvoice } from '../hooks/useBilling'
import { usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { FilterBar, Select, Modal, Button, FormField, Input, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge, StatCard } from '@/components/ui'
import { formatCurrency, formatDate } from '@/utils/format'
import { DollarSign, CheckCircle, Clock, XCircle } from 'lucide-react'

type BillingInv = Record<string, unknown>

export default function Billing(): React.ReactElement {
  const [status, setStatus]   = useState('')
  const [markPaidId, setMarkPaidId] = useState<number | null>(null)
  const [voidId, setVoidId]   = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError } = useBillingInvoices({ status: status || undefined, page, per_page: perPage })
  const { data: overviewData } = useBillingOverview()
  const { mutate: markPaid,  isPending: marking } = useMarkBillingPaid()
  const { mutate: voidInv,   isPending: voiding } = useVoidBillingInvoice()

  const list     = data as Record<string, unknown> | undefined
  const rows     = (list?.data as BillingInv[]) ?? []
  const meta     = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined
  const overview = overviewData as Record<string, unknown> | undefined

  const columns: ColumnDef<BillingInv>[] = [
    {
      key: 'invoice_number', header: 'Invoice #', width: 'w-36',
      accessor: (row) => <span className="text-xs font-mono text-muted-foreground">{row.invoice_number as string}</span>,
    },
    {
      key: 'org', header: 'Organisation',
      accessor: (row) => {
        const org = row.organization as Record<string, string> | null
        return <span className="text-xs font-medium text-foreground">{org?.name ?? '—'}</span>
      },
    },
    {
      key: 'plan', header: 'Plan',
      accessor: (row) => <span className="text-xs text-muted-foreground">{row.plan_name as string ?? '—'}</span>,
    },
    {
      key: 'total', header: 'Amount', align: 'right',
      accessor: (row) => <span className="text-xs font-semibold text-foreground">{formatCurrency(row.total as number)}</span>,
    },
    {
      key: 'due_date', header: 'Due Date',
      accessor: (row) => (
        <span className={`text-xs whitespace-nowrap ${row.status === 'overdue' ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
          {formatDate(row.due_date as string)}
        </span>
      ),
    },
    {
      key: 'paid_at', header: 'Paid Date',
      accessor: (row) => <span className="text-xs text-muted-foreground">{row.paid_at ? formatDate(row.paid_at as string) : '—'}</span>,
    },
    { key: 'status', header: 'Status', sortable: true, accessor: (row) => <StatusBadge status={row.status as string} /> },
    {
      key: 'actions', header: '', width: 'w-28',
      accessor: (row) => {
        const id = row.id as number
        const s  = row.status as string
        if (s === 'paid' || s === 'void') return null
        return (
          <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
            <button onClick={() => setMarkPaidId(id)} className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">Mark Paid</button>
            <button onClick={() => setVoidId(id)}     className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">Void</button>
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Billing & Payments — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader title="Billing & Payments" subtitle="Platform-wide subscription invoices." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total Revenue" value={overview ? formatCurrency(overview.total_revenue as number) : '—'} icon={<DollarSign className="h-4 w-4 text-violet-600" />} iconBg="bg-violet-100" />
          <StatCard label="Collected" value={overview ? formatCurrency(overview.collected as number) : '—'} icon={<CheckCircle className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-100" />
          <StatCard label="Pending" value={overview ? formatCurrency(overview.pending as number) : '—'} icon={<Clock className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-100" />
          <StatCard label="Overdue" value={overview?.overdue_count as number ?? '—'} icon={<XCircle className="h-4 w-4 text-red-500" />} iconBg="bg-red-100" />
        </div>
        <FilterBar>
          <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} placeholder="All statuses" className="w-36 text-xs"
            options={[{ value:'', label:'All' }, { value:'pending', label:'Pending' }, { value:'paid', label:'Paid' }, { value:'overdue', label:'Overdue' }, { value:'void', label:'Void' }]} />
        </FilterBar>
        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading}
          error={isError ? 'Failed to load billing data.' : null}
          emptyTitle="No billing invoices" pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Billing invoices" />
      </div>

      {/* Mark paid */}
      <Modal open={!!markPaidId} onClose={() => setMarkPaidId(null)} title="Mark as Paid" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setMarkPaidId(null)}>Cancel</Button>
            <Button loading={marking} onClick={() => {
              if (!markPaidId) return
              markPaid({ id: markPaidId }, {
                onSuccess: () => { success('Marked as paid'); setMarkPaidId(null) },
                onError: (err) => toastError(err, 'Failed'),
              })
            }}>Confirm</Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Mark this invoice as paid? This will record today as the payment date.</p>
      </Modal>

      {/* Void */}
      <Modal open={!!voidId} onClose={() => { setVoidId(null); setVoidReason('') }} title="Void Invoice" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setVoidId(null)}>Cancel</Button>
            <Button variant="destructive" loading={voiding} onClick={() => {
              if (!voidId || !voidReason.trim()) return
              voidInv({ id: voidId, reason: voidReason }, {
                onSuccess: () => { success('Invoice voided'); setVoidId(null); setVoidReason('') },
                onError: (err) => toastError(err, 'Failed'),
              })
            }}>Void Invoice</Button>
          </>
        }
      >
        <FormField label="Reason" htmlFor="void-reason" required>
          <Input id="void-reason" value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Reason for voiding…" />
        </FormField>
      </Modal>
    </>
  )
}