// src/features/admin/pages/Invoices.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus, Download, CheckCircle2, XCircle as XCircleIcon, Eye } from 'lucide-react'
import { useInvoices, useVoidInvoice, useSendInvoice, useGenerateMonthlyInvoices, useInvoiceSummary, usePayments, useApproveBankTransfer, useRejectBankTransfer } from '../hooks'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef, type SortState } from '@/components/tables/DataTable'
import { SearchInput, FilterBar, Select, Modal, Button, FormField, Input, Textarea, ConfirmDialog, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge, StatCard } from '@/components/ui'
import { formatCurrency, formatDate, formatYearMonth, formatDatetime } from '@/utils/format'
import { FileText, DollarSign, Clock, XCircle } from 'lucide-react'
import { openSignedDocument } from '@/api/documentDownloads'
import { paymentsApi } from '@/api/payments'
import { useAuthStore } from '@/store/auth.store'

type Invoice = Record<string, unknown>
type Payment = Record<string, unknown>

export default function InvoicesPage(): React.ReactElement {
  const currency = useAuthStore((s) => s.user?.org?.currency ?? 'KES')
  const [activeTab, setActiveTab] = useState<'invoices' | 'bank_transfers'>('invoices')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<SortState>({ column: 'created_at', direction: 'desc' })
  const [voidId, setVoidId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [genMonth, setGenMonth] = useState('')
  const [genOpen, setGenOpen] = useState(false)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [viewReceiptId, setViewReceiptId] = useState<number | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(false)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { page: btPage, setPage: setBtPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const downloadInvoice = (id: string) => {
    void openSignedDocument(`/admin/invoices/${id}/download`, {
      onPending: (message) => success(message),
    }).catch((err) => toastError(err, 'Failed to download invoice'))
  }

  const { data, isLoading, isError } = useInvoices({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    page, per_page: perPage,
  })

  const { data: btData, isLoading: btLoading } = usePayments({ method: 'bank_transfer', status: 'pending', page: btPage })
  const { data: reviewedData, isLoading: reviewedLoading } = usePayments({ method: 'bank_transfer', status: 'completed', per_page: 5 })
  const { mutate: approveTransfer, isPending: approving } = useApproveBankTransfer()
  const { mutate: rejectTransfer, isPending: rejecting } = useRejectBankTransfer()

  const { data: summary } = useInvoiceSummary()
  const { mutate: voidInvoice, isPending: voiding } = useVoidInvoice()
  const { mutate: sendInvoice } = useSendInvoice()
  const { mutate: generateMonthly, isPending: generating } = useGenerateMonthlyInvoices()

  const btList = btData as Record<string, unknown> | undefined
  const btRows = (btList?.data as Payment[]) ?? []
  const btMeta = btList?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const openReceipt = (id: number) => {
    setViewReceiptId(id)
    setLoadingReceipt(true)
    void paymentsApi.adminBankReceipt(id)
      .then((r) => { setReceiptUrl(r.data.url); setLoadingReceipt(false) })
      .catch(() => { toastError(new Error('Failed to load receipt'), 'Failed to load receipt'); setLoadingReceipt(false) })
  }

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
      accessor: (row) => (
        <span className="text-xs font-mono text-muted-foreground">{(row.bank_reference as string) ?? '—'}</span>
      ),
    },
    {
      key: 'created_at', header: 'Submitted',
      accessor: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{row.created_at ? formatDatetime(row.created_at as string) : '—'}</span>,
    },
    {
      key: 'receipt', header: '',
      accessor: (row) => row.has_receipt || row.bank_receipt
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
              <button onClick={() => openReceipt(id)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                <Eye className="h-3 w-3" /> View
              </button>
            )}
            <button onClick={() => approveTransfer(id, { onSuccess: () => success('Payment approved'), onError: (err) => toastError(err, 'Failed') })}
              disabled={approving}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
              <CheckCircle2 className="h-3 w-3" /> Approve
            </button>
            <button onClick={() => { setRejectId(id); setRejectReason('') }}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
              <XCircleIcon className="h-3 w-3" /> Reject
            </button>
          </div>
        )
      },
    },
  ]

  const reviewedColumns: ColumnDef<Payment>[] = [
    {
      key: 'tenant', header: 'Tenant',
      accessor: (row) => {
        const t = row.tenant as Record<string, string> | null
        return t ? <div><p className="text-xs font-medium text-foreground">{t.name}</p></div>
          : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      key: 'amount', header: 'Amount', align: 'right',
      accessor: (row) => <span className="text-xs font-semibold text-foreground">{formatCurrency(row.amount as number, currency)}</span>,
    },
    {
      key: 'payment_reference', header: 'Reference',
      accessor: (row) => <span className="text-xs font-mono text-muted-foreground">{row.payment_reference as string}</span>,
    },
    {
      key: 'approved_by', header: 'Approved By',
      accessor: (row) => {
        const by = row.received_by as Record<string, string> | null
        return by ? (
          <div>
            <p className="text-xs font-medium text-foreground">{by.name}</p>
            <p className="text-xs capitalize text-muted-foreground">{by.role ?? '—'}</p>
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      key: 'paid_at', header: 'Approved',
      accessor: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{row.paid_at ? formatDatetime(row.paid_at as string) : '—'}</span>,
    },
  ]

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as Invoice[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined
  const sum = summary as Record<string, unknown> | undefined
  const reviewedRows = ((reviewedData as Record<string, unknown> | undefined)?.data as Payment[]) ?? []

  const columns: ColumnDef<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      sortable: true,
      width: 'w-36',
      accessor: (row) => (
        <span className="text-xs font-mono text-muted-foreground">{row.invoice_number as string}</span>
      ),
    },
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
      key: 'invoice_month',
      header: 'Month',
      sortable: true,
      accessor: (row) => (
        <span className="text-xs text-foreground">{formatYearMonth(row.invoice_month as string)}</span>
      ),
    },
    {
      key: 'total_amount',
      header: 'Total',
      sortable: true,
      align: 'right',
      accessor: (row) => (
        <span className="text-xs font-medium text-foreground">{formatCurrency(row.total_amount as number, currency)}</span>
      ),
    },
    {
      key: 'paid_amount',
      header: 'Paid',
      align: 'right',
      accessor: (row) => (
        <span className={`text-xs font-medium ${(row.paid_amount as number) >= (row.total_amount as number) ? 'text-emerald-600' : 'text-muted-foreground'}`}>
          {formatCurrency(row.paid_amount as number, currency)}
        </span>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      accessor: (row) => (
        <span className={`text-xs whitespace-nowrap ${Boolean(row.is_overdue) ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
          {formatDate(row.due_date as string)}
          {Boolean(row.is_overdue) && ' ⚠'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (row) => <StatusBadge status={row.status as string} />,
    },
    {
      key: 'actions',
      header: '',
      width: 'w-32',
      accessor: (row) => {
        const id = row.id as string
        const status = row.status as string
        return (
          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            {status !== 'void' && status !== 'paid' && (
              <>
                <button onClick={() => sendInvoice(id, { onSuccess: () => success('Invoice sent') })}
                  className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                  Send
                </button>
                <button onClick={() => setVoidId(id)}
                  className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                  Void
                </button>
              </>
            )}
            <button type="button" onClick={() => downloadInvoice(id)}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
              <Download className="h-3 w-3" />
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Invoices — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Invoices"
          subtitle="Track rent invoices and collection across all tenants."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setGenOpen(true)}>
                ⚡ Generate Monthly
              </Button>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5" /> New Invoice
              </Button>
            </div>
          }
        />

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total Invoices" value={typeof sum?.total_invoices === 'number' ? sum.total_invoices : '—'} icon={<FileText className="h-4 w-4 text-violet-600" />} iconBg="bg-violet-100" />
          <StatCard label="Total Amount" value={typeof sum?.total_expected === 'number' ? formatCurrency(sum.total_expected, currency) : '—'} icon={<DollarSign className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-100" />
          <StatCard label="Pending" value={typeof sum?.total_pending === 'number' ? formatCurrency(sum.total_pending, currency) : '—'} icon={<Clock className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-100" />
          <StatCard label="Overdue" value={typeof (sum?.by_status as { overdue?: number } | undefined)?.overdue === 'number' ? (sum!.by_status as { overdue: number }).overdue : '—'} icon={<XCircle className="h-4 w-4 text-red-500" />} iconBg="bg-red-100" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-4">
          {([
            ['invoices',       'Invoices'],
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

        {/* Invoices tab */}
        {activeTab === 'invoices' && (
          <>
            <FilterBar>
              <SearchInput value={search} onChange={setSearch} placeholder="Search tenant, invoice #…" className="w-64" />
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                placeholder="All statuses"
                className="w-36 text-xs"
                options={[
                  { value: '', label: 'All statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'overdue', label: 'Overdue' },
                  { value: 'partially_paid', label: 'Partial' },
                  { value: 'void', label: 'Void' },
                ]}
              />
            </FilterBar>
            <DataTable
              columns={columns} data={rows} keyField="id"
              loading={isLoading} error={isError ? 'Failed to load invoices.' : null}
              emptyTitle="No invoices found"
              sort={sort} onSort={(col, dir) => { setSort({ column: col, direction: dir }); setPage(1) }}
              pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage}
              caption="Invoices list"
            />
          </>
        )}

        {/* Bank Transfers tab */}
        {activeTab === 'bank_transfers' && (
          <>
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3">
              <span className="text-base leading-none mt-0.5">🏦</span>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Pending bank transfers submitted by tenants. Review the bank reference and receipt, then approve or reject each payment.
              </p>
            </div>
            <DataTable
              columns={btColumns} data={btRows} keyField="id"
              loading={btLoading}
              emptyTitle="No pending bank transfers"
              emptyDescription="Tenant bank transfer submissions will appear here for review."
              pagination={btMeta} onPageChange={setBtPage}
              caption="Bank transfer review queue"
            />

            <div className="mt-8">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Recently Approved</h3>
              <DataTable
                columns={reviewedColumns} data={reviewedRows} keyField="id"
                loading={reviewedLoading}
                emptyTitle="No approved transfers yet"
                caption="Recently approved bank transfers"
              />
            </div>
          </>
        )}
      </div>

      {/* Void modal */}
      <Modal open={!!voidId} onClose={() => { setVoidId(null); setVoidReason('') }}
        title="Void Invoice" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setVoidId(null)}>Cancel</Button>
            <Button variant="destructive" loading={voiding} onClick={() => {
              if (!voidId || !voidReason.trim()) return
              voidInvoice({ id: voidId, reason: voidReason }, {
                onSuccess: () => { success('Invoice voided'); setVoidId(null); setVoidReason('') },
                onError: (err) => toastError(err, 'Failed to void invoice'),
              })
            }}>
              Void Invoice
            </Button>
          </>
        }
      >
        <FormField label="Reason for voiding" htmlFor="void-reason" required>
          <Textarea id="void-reason" rows={3} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Please provide a reason…" />
        </FormField>
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
          <Textarea id="reject-reason" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Invalid reference number or amount mismatch…" />
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

      {/* Generate monthly */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)}
        title="Generate Monthly Invoices" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button loading={generating} onClick={() => {
              if (!genMonth) return
              generateMonthly({ invoice_month: genMonth }, {
                onSuccess: (res) => {
                  const d = res as { data?: { generated?: number } } | undefined
                  success(`Generated ${d?.data?.generated ?? 0} invoices`)
                  setGenOpen(false)
                },
                onError: (err) => toastError(err, 'Failed to generate invoices'),
              })
            }}>
              Generate
            </Button>
          </>
        }
      >
        <FormField label="Invoice Month (YYYY-MM)" htmlFor="gen-month" hint="e.g. 2025-06" required>
          <Input id="gen-month" type="month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} />
        </FormField>
      </Modal>
    </>
  )
}
