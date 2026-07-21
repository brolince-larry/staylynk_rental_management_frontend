// src/features/manager/pages/Payments.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useManagerPayments, useManagerCreatePayment, useManagerApproveBankTransfer, useManagerRejectBankTransfer } from '../hooks/index'
import { usePagination, useToast } from '@/hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { FilterBar, Select, Modal, Button, FormField, Input, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge } from '@/components/ui'
import { rentPaymentSchema, type RentPaymentSchema } from '@/schemas/invoice.schema'
import { formatCurrency, formatDate, formatDatetime, formatYearMonth } from '@/utils/format'
import { CheckCircle2, Download, Eye, XCircle } from 'lucide-react'
import { openSignedDocument } from '@/api/documentDownloads'
import { paymentsApi } from '@/api/payments'
import { useAuthStore } from '@/store/auth.store'

type Payment = Record<string, unknown>

const METHOD_ICONS: Record<string, string> = { mpesa: '📱', bank_transfer: '🏦', card: '💳', cheque: '📝', cash: '💵' }

export default function ManagerPayments(): React.ReactElement {
  const currency = useAuthStore((s) => s.user?.org?.currency ?? 'KES')
  const [activeTab, setActiveTab] = useState<'all' | 'bank_transfers'>('all')
  const [statusFilter, setStatus] = useState('')
  const [recordOpen, setRecordOpen] = useState(false)
  const [invoiceId, setInvoiceId]   = useState<number | null>(null)
  const [rejectId, setRejectId]     = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [viewReceiptId, setViewReceiptId] = useState<number | null>(null)
  const [receiptUrl, setReceiptUrl]     = useState<string | null>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(false)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { page: btPage, setPage: setBtPage } = usePagination()
  const { toasts, success, error: toastError, dismiss } = useToast()

  const downloadReceipt = (id: number) => {
    void openSignedDocument(`/manager/payments/${id}/receipt`, {
      onPending: (message) => success(message),
    }).catch((err) => toastError(err, 'Failed to download receipt'))
  }

  const openBankReceipt = (id: number) => {
    setViewReceiptId(id)
    setLoadingReceipt(true)
    void paymentsApi.managerBankReceipt(id)
      .then((r) => { setReceiptUrl(r.data.url); setLoadingReceipt(false) })
      .catch(() => { toastError(new Error(''), 'Failed to load receipt'); setLoadingReceipt(false) })
  }

  const { data, isLoading, isError } = useManagerPayments({ status: statusFilter || undefined, page, per_page: perPage })
  const { data: btData, isLoading: btLoading } = useManagerPayments({ method: 'bank_transfer', status: 'pending', page: btPage })
  const { mutate: approveTransfer, isPending: approving } = useManagerApproveBankTransfer()
  const { mutate: rejectTransfer, isPending: rejecting } = useManagerRejectBankTransfer()
  const { mutate: createPayment, isPending: recording } = useManagerCreatePayment()

  const form = useForm<RentPaymentSchema>({ resolver: zodResolver(rentPaymentSchema) })

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as Payment[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const btList = btData as Record<string, unknown> | undefined
  const btRows = (btList?.data as Payment[]) ?? []
  const btMeta = btList?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const btColumns: ColumnDef<Payment>[] = [
    {
      key: 'tenant', header: 'Tenant',
      accessor: (row) => {
        const t = row.tenant as Record<string, string> | null
        return t ? <div><p className="text-xs font-medium text-foreground">{t.name}</p><p className="text-xs text-muted-foreground">{t.email}</p></div>
          : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      key: 'invoice', header: 'Invoice',
      accessor: (row) => {
        const inv = row.invoice as Record<string, unknown> | null
        return inv
          ? <div><p className="text-xs font-mono text-foreground">{inv.invoice_number as string}</p><p className="text-xs text-muted-foreground">{formatYearMonth(inv.invoice_month as string)}</p></div>
          : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      key: 'amount', header: 'Amount', align: 'right',
      accessor: (row) => <span className="text-xs font-semibold text-foreground">{formatCurrency(row.amount as number, currency)}</span>,
    },
    {
      key: 'bank_reference', header: 'Bank Ref',
      accessor: (row) => <span className="text-xs font-mono text-muted-foreground">{(row.bank_reference as string) ?? '—'}</span>,
    },
    {
      key: 'created_at', header: 'Submitted',
      accessor: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{row.created_at ? formatDatetime(row.created_at as string) : '—'}</span>,
    },
    {
      key: 'receipt', header: '',
      accessor: (row) => (row.has_receipt || row.bank_receipt)
        ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">📎 Receipt</span>
        : null,
    },
    {
      key: 'actions', header: '', width: 'w-40',
      accessor: (row) => {
        const id = row.id as number
        return (
          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            {(row.has_receipt || row.bank_receipt) && (
              <button onClick={() => openBankReceipt(id)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                <Eye className="h-3 w-3" /> View
              </button>
            )}
            <button onClick={() => approveTransfer(id, { onSuccess: () => success('Transfer approved'), onError: (err) => toastError(err, 'Failed') })}
              disabled={approving}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
              <CheckCircle2 className="h-3 w-3" /> Approve
            </button>
            <button onClick={() => { setRejectId(id); setRejectReason('') }}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
              <XCircle className="h-3 w-3" /> Reject
            </button>
          </div>
        )
      },
    },
  ]

  const columns: ColumnDef<Payment>[] = [
    {
      key: 'reference', header: 'Reference',
      accessor: (row) => <span className="text-xs font-mono text-foreground">{row.payment_reference as string ?? '—'}</span>,
    },
    {
      key: 'tenant', header: 'Tenant',
      accessor: (row) => {
        const t = row.tenant as Record<string, string> | null
        return t ? <div><p className="text-xs font-medium text-foreground">{t.name}</p><p className="text-xs text-muted-foreground">{t.email}</p></div> : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      key: 'method', header: 'Method',
      accessor: (row) => {
        const m = row.method as string
        return <span className="text-xs text-foreground">{METHOD_ICONS[m] ?? '💰'} {m?.replace(/_/g, ' ')}</span>
      },
    },
    {
      key: 'amount', header: 'Amount', align: 'right', sortable: true,
      accessor: (row) => <span className="text-xs font-semibold text-emerald-600">{formatCurrency(row.amount as number, currency)}</span>,
    },
    {
      key: 'paid_at', header: 'Date', sortable: true,
      accessor: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{row.paid_at ? formatDate(row.paid_at as string) : '—'}</span>,
    },
    { key: 'status', header: 'Status', accessor: (row) => <StatusBadge status={row.status as string} /> },
    {
      key: 'receipt', header: '', width: 'w-16',
      accessor: (row) => row.status === 'completed' ? (
        <button type="button" onClick={() => downloadReceipt(row.id as number)}
          className="flex items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-muted">
          <Download className="h-3.5 w-3.5" />
        </button>
      ) : null,
    },
  ]

  return (
    <>
      <Helmet><title>Payments — Manager</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader title="Payments" subtitle="All rent payments received."
          actions={<Button onClick={() => setRecordOpen(true)}>Record Payment</Button>}
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-4">
          {([
            ['all',            'All Payments'],
            ['bank_transfers', '🏦 Bank Transfers'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {label}
              {tab === 'bank_transfers' && (btMeta?.total ?? 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {btMeta?.total}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'all' && (
          <>
            <FilterBar>
              <Select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }} placeholder="All" className="w-36 text-xs"
                options={[{ value:'', label:'All' }, { value:'completed', label:'Completed' }, { value:'pending', label:'Pending' }, { value:'failed', label:'Failed' }]} />
            </FilterBar>
            <DataTable columns={columns} data={rows} keyField="id" loading={isLoading}
              error={isError ? 'Failed to load payments.' : null}
              emptyTitle="No payments yet"
              pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Payments" />
          </>
        )}

        {activeTab === 'bank_transfers' && (
          <>
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3">
              <span className="text-base leading-none mt-0.5">🏦</span>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Pending bank transfer submissions. Verify the reference and receipt, then approve or reject.
              </p>
            </div>
            <DataTable
              columns={btColumns} data={btRows} keyField="id" loading={btLoading}
              emptyTitle="No pending bank transfers"
              emptyDescription="Bank transfer submissions from tenants will appear here."
              pagination={btMeta} onPageChange={setBtPage} caption="Bank transfer queue"
            />
          </>
        )}
      </div>

      {/* Record payment modal */}
      <Modal open={recordOpen} onClose={() => { setRecordOpen(false); form.reset() }}
        title="Record Payment" size="sm"
        footer={<><Button variant="outline" onClick={() => setRecordOpen(false)}>Cancel</Button><Button loading={recording} onClick={form.handleSubmit(v => { if (!invoiceId) return; createPayment({ invoice_id: invoiceId, tenant_id: 0, ...v }, { onSuccess: () => { success('Payment recorded'); setRecordOpen(false); form.reset() }, onError: (err) => toastError(err, 'Failed') }) })}>Record</Button></>}
      >
        <form className="space-y-4">
          <FormField label="Invoice ID" htmlFor="pinvoice" required>
            <Input id="pinvoice" type="number" min={1} value={invoiceId ?? ''} onChange={e => setInvoiceId(parseInt(e.target.value) || null)} placeholder="Invoice ID" />
          </FormField>
          <FormField label="Amount" htmlFor="pamount" error={form.formState.errors.amount?.message} required>
            <Input id="pamount" type="number" min={0} step="0.01" error={!!form.formState.errors.amount} {...form.register('amount')} />
          </FormField>
          <FormField label="Method" htmlFor="pmethod" error={form.formState.errors.method?.message} required>
            <Select id="pmethod" error={!!form.formState.errors.method} placeholder="Select method" {...form.register('method')}
              options={[{ value:'bank_transfer', label:'Bank Transfer' }, { value:'mpesa', label:'M-Pesa' }, { value:'card', label:'Card' }, { value:'cheque', label:'Cheque' }, { value:'cash', label:'Cash' }]} />
          </FormField>
          <FormField label="Transaction ID" htmlFor="ptxn">
            <Input id="ptxn" placeholder="Optional reference" {...form.register('transaction_id')} />
          </FormField>
        </form>
      </Modal>

      {/* Reject bank transfer modal */}
      <Modal open={!!rejectId} onClose={() => { setRejectId(null); setRejectReason('') }}
        title="Reject Bank Transfer" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="destructive" loading={rejecting} onClick={() => {
              if (!rejectId || !rejectReason.trim()) return
              rejectTransfer({ id: rejectId, reason: rejectReason }, {
                onSuccess: () => { success('Transfer rejected'); setRejectId(null); setRejectReason('') },
                onError: (err) => toastError(err, 'Failed to reject transfer'),
              })
            }}>
              Reject
            </Button>
          </>
        }
      >
        <FormField label="Reason for rejection" htmlFor="reject-reason" required>
          <Textarea id="reject-reason" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Invalid reference or amount mismatch…" />
        </FormField>
      </Modal>

      {/* Receipt viewer modal */}
      <Modal open={viewReceiptId !== null} onClose={() => { setViewReceiptId(null); setReceiptUrl(null) }}
        title="Bank Transfer Receipt" size="sm"
        footer={
          <div className="flex gap-2">
            {receiptUrl && (
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-muted">
                <Download className="h-3.5 w-3.5" /> Open in new tab
              </a>
            )}
            <Button variant="outline" onClick={() => { setViewReceiptId(null); setReceiptUrl(null) }}>Close</Button>
          </div>
        }
      >
        {loadingReceipt ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : receiptUrl ? (
          <div className="overflow-hidden rounded-lg border border-border">
            {receiptUrl.match(/\.(pdf)$/i) ? (
              <iframe src={receiptUrl} className="h-80 w-full" title="Receipt PDF" />
            ) : (
              <img src={receiptUrl} alt="Bank transfer receipt" className="max-h-80 w-full object-contain" />
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">Failed to load receipt.</p>
        )}
      </Modal>
    </>
  )
}
