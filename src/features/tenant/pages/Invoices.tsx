// src/features/tenant/pages/Invoices.tsx
// Tenant Bills & Payments — matches Image 4 dashboard payment section exactly.
//
// Data sources:
//   - GET /tenant/dashboard  → payment_overview, next_payment, account_balance, payment_history (last 8)
//   - GET /tenant/invoices   → full paginated invoice list
//   - POST /tenant/payments/initiate → M-Pesa STK push
//
// Sections:
//   1. Summary stat cards (Total Paid / Pending / Overdue / Outstanding)
//   2. Overdue alert banner
//   3. Next payment due card (from dashboard)
//   4. Full invoice table with pay button + receipt download + expandable breakdown
//   5. Pay modal — M-Pesa STK or Bank Transfer

import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  Download, CreditCard, CheckCircle, Clock,
  AlertCircle, ChevronDown, ChevronUp, Phone, Copy, Paperclip,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTenantInvoices, useTenantInvoice, useTenantDashboard, useInitiateMpesa, useTenantBankInfo, useSubmitBankTransfer } from '../hooks'
import { usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { FilterBar, Select, Modal, Button, FormField, Input, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge, StatCard, SectionCard } from '@/components/ui'
import { formatCurrency, formatDate, formatYearMonth } from '@/utils/format'
import { useAuthStore } from '@/store/auth.store'
import type { ApiError } from '@/types'
import type { MpesaInitiateResult } from '@/api/payments'
import { openSignedDocument } from '@/api/documentDownloads'

// ─── Types matching backend response ─────────────────────────────────────
interface DashboardPaymentHistory {
  id: number
  invoice_number: string
  invoice_month: string
  total_amount: number
  paid_amount: number
  balance: number
  status: string
  due_date: string
  paid_at: string | null
  payment_reference: string | null
  payment_date: string | null
}

interface DashboardNextPayment {
  invoice_id: number
  invoice_number: string
  amount: number
  due_date: string
  days_until_due: number
  status: string
}

interface DashboardPaymentOverview {
  total_paid: number
  total_pending: number
  total_overdue: number
  total_invoices: number
  paid_count: number
}

interface DashboardAccountBalance {
  total_outstanding: number
  is_up_to_date: boolean
}

// ─── Pay modal schema — discriminated union per method ────────────────────
const paySchema = z.discriminatedUnion('method', [
  z.object({
    method:       z.literal('mpesa'),
    phone_number: z.string().min(10, 'Enter a valid M-Pesa number').max(15),
  }),
  z.object({
    method:         z.literal('bank_transfer'),
    transaction_id: z.string().min(3, 'Enter the bank reference number').max(100),
  }),
])
type PaySchema = z.infer<typeof paySchema>

type Invoice = Record<string, unknown>

// ─── Expandable invoice breakdown ────────────────────────────────────────
function InvoiceBreakdown({ id }: { id: number }): React.ReactElement {
  const { data, isLoading } = useTenantInvoice(id)
  const inv = data as Record<string, unknown> | undefined

  if (isLoading) {
    return (
      <div className="bg-muted/30 px-6 py-3 space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-3 bg-muted rounded animate-pulse w-40" />)}
      </div>
    )
  }
  if (!inv) return <div className="bg-muted/30 px-6 py-3 text-xs text-muted-foreground">No breakdown available.</div>

  const lines: Array<{ label: string; amount: number; color?: string }> = [
    { label: 'Base Rent',        amount: inv.rent_amount as number },
    { label: 'Utilities',        amount: inv.utility_charges as number },
    { label: 'Other Charges',    amount: inv.other_charges as number },
    { label: 'Late Fee',         amount: inv.late_fee as number, color: 'text-red-500' },
    { label: 'Discount',         amount: -(inv.discount as number), color: 'text-emerald-600' },
  ].filter(l => l.amount !== 0)

  return (
    <div className="bg-muted/30 border-t border-border px-6 py-3">
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {lines.map(l => (
          <div key={l.label} className="text-xs">
            <span className="text-muted-foreground mr-1.5">{l.label}</span>
            <span className={`font-medium ${l.color ?? 'text-foreground'}`}>
              {l.amount < 0 ? '-' : ''}{formatCurrency(Math.abs(l.amount))}
            </span>
          </div>
        ))}
        {Boolean(inv.notes) && (
          <div className="text-xs w-full">
            <span className="text-muted-foreground mr-1.5">Note:</span>
            <span className="text-foreground">{inv.notes as string}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pay modal ────────────────────────────────────────────────────────────
interface PayModalProps {
  invoice: Invoice | null
  currency: string
  onClose: () => void
  onSuccess: () => void
}

function BankTransferPanel({ invoice, currency, onClose, onSuccess }: PayModalProps): React.ReactElement | null {
  const [bankReference, setBankReference] = useState('')
  const [receiptFile, setReceiptFile]     = useState<File | null>(null)
  const [notes, setNotes]                 = useState('')
  const [copied, setCopied]               = useState<string | null>(null)
  const [submitted, setSubmitted]         = useState(false)
  const { toasts, toast, error: toastError, dismiss } = useToast()
  const { data: bankInfo, isLoading: loadingBank, isError: bankError } = useTenantBankInfo()
  const { mutate: submitTransfer, isPending: submitting } = useSubmitBankTransfer()

  if (!invoice) return null
  const amount = (invoice.balance as number) > 0
    ? (invoice.balance as number)
    : (invoice.total_amount as number)
  const invoiceNumber = invoice.invoice_number as string

  const copyText = (text: string, key: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  const handleSubmit = () => {
    if (!bankReference.trim()) {
      toast({ type: 'error', title: 'Enter your bank transaction reference.' })
      return
    }
    const fd = new FormData()
    fd.append('invoice_id',    String(invoice.id as number))
    fd.append('amount',        String(amount))
    fd.append('bank_reference', bankReference.trim())
    if (receiptFile) fd.append('bank_receipt', receiptFile)
    if (notes.trim()) fd.append('notes', notes.trim())

    submitTransfer(fd, {
      onSuccess: () => setSubmitted(true),
      onError: (err) => {
        const apiErr = err as unknown as ApiError
        if (apiErr.status === 422) {
          toast({ type: 'error', title: 'Bank transfer is not configured for this property. Contact management.' })
        } else if (apiErr.status === 409) {
          toast({ type: 'error', title: 'A bank transfer for this invoice is already awaiting review.' })
        } else {
          toastError(err, 'Failed to submit bank transfer.')
        }
      },
    })
  }

  if (submitted) {
    return (
      <>
        <ToastContainer toasts={toasts} dismiss={dismiss} />
        <div className="text-center py-4 space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-foreground">Bank transfer submitted</p>
          <p className="text-xs text-muted-foreground">
            Your payment is pending review. The admin will verify your transfer and update your invoice status within 1–2 business days.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Invoice status will show <strong>Awaiting Review</strong> until confirmed.
          </div>
          <Button className="w-full" onClick={() => { onSuccess(); setSubmitted(false) }}>Done</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="space-y-4">
        {/* Amount card */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Amount Due</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(amount, currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Due Date</p>
            <p className={`text-xs font-medium ${invoice.is_overdue ? 'text-red-500' : 'text-foreground'}`}>
              {formatDate(invoice.due_date as string)}
            </p>
          </div>
        </div>

        {/* Pay To card */}
        {loadingBank ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-5 bg-muted rounded animate-pulse" />)}</div>
        ) : bankError || !bankInfo ? (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-xs text-red-700 dark:text-red-300">
            Bank transfer is not configured for this property. Please contact management or use M-Pesa.
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:border-blue-800 dark:from-blue-950/40 dark:to-indigo-950/40 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Pay To</p>
            <div className="space-y-2">
              {[
                { label: 'Bank',           value: bankInfo.bank_name,      key: 'bank' },
                { label: 'Account Name',   value: bankInfo.account_name,   key: 'name' },
                { label: 'Account No.',    value: bankInfo.account_number, key: 'num' },
                ...(bankInfo.branch    ? [{ label: 'Branch',    value: bankInfo.branch,    key: 'branch' }] : []),
                ...(bankInfo.swift_code ? [{ label: 'SWIFT',    value: bankInfo.swift_code, key: 'swift' }] : []),
                { label: 'Reference',      value: invoiceNumber,           key: 'ref' },
              ].map(({ label, value, key }) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0">{label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium font-mono text-blue-900 dark:text-blue-100">{value}</span>
                    <button
                      type="button"
                      onClick={() => copyText(value, key)}
                      className="rounded p-0.5 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
                      aria-label={`Copy ${label}`}
                    >
                      {copied === key
                        ? <CheckCircle className="h-3 w-3 text-emerald-500" />
                        : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {bankInfo.instructions && (
              <p className="mt-3 rounded-lg border border-blue-200 bg-white/50 dark:bg-white/5 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                {bankInfo.instructions}
              </p>
            )}
          </div>
        )}

        {/* Reference & receipt */}
        {bankInfo && (
          <>
            <FormField label="Bank Transaction Reference" htmlFor="bt-ref" hint="Copy from your bank SMS or app" required>
              <Input
                id="bt-ref"
                placeholder="e.g. EQT20250601123456"
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
              />
            </FormField>

            <div>
              <p className="mb-1 text-xs font-medium text-foreground">Upload Receipt <span className="text-muted-foreground">(optional)</span></p>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 hover:bg-muted/50 transition-colors">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {receiptFile ? receiptFile.name : 'Attach bank receipt (PNG, JPG, PDF)'}
                </span>
                <input
                  type="file"
                  className="sr-only"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <FormField label="Notes" htmlFor="bt-notes" hint="Optional">
              <Input id="bt-notes" placeholder="Any additional details" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </FormField>

            <Button loading={submitting} className="w-full" onClick={handleSubmit}>
              Submit Bank Transfer
            </Button>
          </>
        )}
      </div>
    </>
  )
}

function PayModal({ invoice, currency, onClose, onSuccess }: PayModalProps): React.ReactElement | null {
  const [method, setMethod] = useState<'mpesa' | 'bank_transfer'>('mpesa')
  const [stkSent, setStkSent] = useState(false)
  const [paymentResult, setPaymentResult] = useState<MpesaInitiateResult | null>(null)
  const { mutate: initiateMpesa, isPending: sending } = useInitiateMpesa()
  const { toasts, toast, error: toastError, dismiss } = useToast()

  const form = useForm<PaySchema>({
    resolver: zodResolver(paySchema),
    defaultValues: { method: 'mpesa', phone_number: '' },
  })

  if (!invoice) return null

  const amount = (invoice.balance as number) > 0
    ? (invoice.balance as number)
    : (invoice.total_amount as number)

  const switchMethod = (m: typeof method) => {
    setMethod(m)
    setStkSent(false)
    setPaymentResult(null)
    form.reset({ method: m } as PaySchema)
  }

  const onSubmit = (values: PaySchema) => {
    if (values.method === 'mpesa') {
      initiateMpesa(
        { invoiceId: invoice.id as number, phone_number: values.phone_number, amount },
        {
          onSuccess: (response) => {
            setPaymentResult(response.data)
            setStkSent(true)
          },
          onError: (err) => {
            const apiErr = err as unknown as ApiError
            const message = apiErr.message?.toLowerCase() ?? ''
            if (apiErr.status === 422 && message.includes('not configured')) {
              toast({
                type: 'error',
                title: 'This property is not configured for online rent payments. Contact management.',
              })
              return
            }
            toastError(err, 'Failed to initiate M-Pesa. Check the number and try again.')
          },
        }
      )
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <Modal
        open
        onClose={onClose}
        title="Make a Payment"
        description={`${invoice.invoice_number as string} — ${formatYearMonth(invoice.invoice_month as string)}`}
        size="sm"
        footer={
          method === 'bank_transfer'
            ? <Button variant="outline" onClick={onClose}>Close</Button>
            : stkSent ? (
              <Button className="w-full" onClick={() => { onSuccess(); setStkSent(false) }}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button loading={sending} onClick={form.handleSubmit(onSubmit)}>Send M-Pesa Prompt</Button>
              </>
            )
        }
      >
        {/* Method selector */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-foreground">Payment Method</p>
          <div className="grid grid-cols-2 gap-2">
            {(['mpesa', 'bank_transfer'] as const).map((m) => (
              <button
                key={m} type="button" onClick={() => switchMethod(m)}
                className={[
                  'flex items-center gap-2 rounded-xl border p-3 text-left transition-all',
                  method === m
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-muted-foreground/40',
                ].join(' ')}
              >
                <span className="text-lg">{m === 'mpesa' ? '📱' : '🏦'}</span>
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {m === 'mpesa' ? 'M-Pesa' : 'Bank Transfer'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m === 'mpesa' ? 'Instant' : '1–2 business days'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bank transfer panel */}
        {method === 'bank_transfer' && (
          <BankTransferPanel
            invoice={invoice}
            currency={currency}
            onClose={onClose}
            onSuccess={() => { onSuccess(); setMethod('mpesa') }}
          />
        )}

        {/* M-Pesa panel */}
        {method === 'mpesa' && (
          stkSent ? (
            <div className="text-center py-4 space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-foreground">STK push sent</p>
              <p className="text-xs text-muted-foreground">
                Check your phone for the M-Pesa prompt. The payment will stay pending until the callback confirms it.
              </p>
              {paymentResult?.payment && (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono text-foreground">{paymentResult.payment.payment_reference}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold text-foreground">{formatCurrency(paymentResult.payment.amount, currency)}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3">
                    <span className="text-muted-foreground">Status</span>
                    <span className="capitalize text-amber-700">{paymentResult.payment.status}</span>
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Final status is handled by the backend callback.
              </div>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Amount Due</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(amount, currency)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className={`text-xs font-medium ${invoice.is_overdue ? 'text-red-500' : 'text-foreground'}`}>
                    {formatDate(invoice.due_date as string)}
                  </p>
                </div>
              </div>
              <FormField
                label="M-Pesa Phone Number" htmlFor="phone"
                error={(form.formState.errors as Record<string, { message?: string }>).phone_number?.message}
                hint="e.g. 0712 345 678 or +254712345678"
                required
              >
                <Input
                  id="phone" type="tel" placeholder="0712 345 678"
                  leftIcon={<Phone className="h-3.5 w-3.5" />}
                  error={!!(form.formState.errors as Record<string, unknown>).phone_number}
                  {...form.register('phone_number' as keyof PaySchema)}
                />
              </FormField>
            </form>
          )
        )}
      </Modal>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────
export default function TenantInvoicesPage(): React.ReactElement {
  const user = useAuthStore((s) => s.user)
  const currency = user?.org?.currency ?? 'USD'

  const [statusFilter, setStatusFilter]   = useState('')
  const [expandedId,   setExpandedId]     = useState<number | null>(null)
  const [payInvoice,   setPayInvoice]     = useState<Invoice | null>(null)
  const [activeTab,    setActiveTab]      = useState<'all' | 'history'>('all')
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { toasts, info, error: toastError, dismiss } = useToast()

  const downloadInvoice = (id: number) => {
    void openSignedDocument(`/tenant/invoices/${id}/download`, {
      onPending: (message) => info(message),
    }).catch((err) => toastError(err, 'Failed to download invoice'))
  }

  // Dashboard data — payment_overview, account_balance, next_payment, payment_history
  const { data: dashRaw } = useTenantDashboard()
  const dash = dashRaw as Record<string, unknown> | undefined
  const overview  = dash?.payment_overview  as DashboardPaymentOverview | undefined
  const balance   = dash?.account_balance   as DashboardAccountBalance  | undefined
  const nextDue   = dash?.next_payment      as DashboardNextPayment | null | undefined
  const dashHistory = (dash?.payment_history ?? []) as DashboardPaymentHistory[]

  // Full paginated invoice list
  const { data, isLoading, isError, refetch } = useTenantInvoices({
    status:   statusFilter || undefined,
    page, per_page: perPage,
  })

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as Invoice[]) ?? []
  const meta = list?.meta as {
    total: number; per_page: number; current_page: number; last_page: number
  } | undefined

  // ── Table columns ─────────────────────────────────────────────────────
  const columns: ColumnDef<Invoice>[] = [
    {
      key: 'expand', header: '', width: 'w-8',
      accessor: (row) => {
        const id = row.id as number
        const open = expandedId === id
        return (
          <button
            onClick={(e) => { e.stopPropagation(); setExpandedId(open ? null : id) }}
            aria-label={open ? 'Hide breakdown' : 'Show breakdown'}
            aria-expanded={open}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {open
              ? <ChevronUp   className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )
      },
    },
    {
      key: 'invoice_number', header: 'Invoice',
      accessor: (row) => (
        <div>
          <p className="text-xs font-mono text-foreground leading-tight">{row.invoice_number as string}</p>
          <p className="text-xs text-muted-foreground">{formatYearMonth(row.invoice_month as string)}</p>
        </div>
      ),
    },
    {
      key: 'rent_amount', header: 'Rent',
      accessor: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatCurrency(row.rent_amount as number, currency)}
        </span>
      ),
    },
    {
      key: 'total_amount', header: 'Total', align: 'right',
      accessor: (row) => (
        <span className="text-xs font-semibold text-foreground">
          {formatCurrency(row.total_amount as number, currency)}
        </span>
      ),
    },
    {
      key: 'paid_amount', header: 'Paid', align: 'right',
      accessor: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatCurrency(row.paid_amount as number, currency)}
        </span>
      ),
    },
    {
      key: 'balance', header: 'Balance', align: 'right',
      accessor: (row) => {
        const bal = row.balance as number
        return (
          <span className={`text-xs font-semibold ${bal > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {bal > 0 ? formatCurrency(bal, currency) : '✓ Cleared'}
          </span>
        )
      },
    },
    {
      key: 'due_date', header: 'Due Date', sortable: true,
      accessor: (row) => (
        <div className="whitespace-nowrap">
          <p className={`text-xs ${Boolean(row.is_overdue) ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
            {formatDate(row.due_date as string)}
            {Boolean(row.is_overdue) && <span className="ml-1">⚠</span>}
          </p>
          {Boolean(row.paid_at) && (
            <p className="text-xs text-emerald-600">
              Paid {formatDate(row.paid_at as string)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', sortable: true,
      accessor: (row) => <StatusBadge status={row.status as string} />,
    },
    {
      key: 'actions', header: '', width: 'w-28',
      accessor: (row) => {
        const status  = row.status as string
        const balance = row.balance as number
        return (
          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            {['pending', 'overdue', 'partially_paid'].includes(status) && balance > 0 && (
              <button
                onClick={() => setPayInvoice(row)}
                className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <CreditCard className="h-3 w-3" /> Pay
              </button>
            )}
            {status === 'paid' && (
              <button
                type="button"
                onClick={() => downloadInvoice(Number(row.id))}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Download className="h-3 w-3" /> Receipt
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Bills & Payments — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="p-6 max-w-[1200px] space-y-5">
        <PageHeader
          title="Bills & Payments"
          subtitle="View your rent invoices, make payments, and download receipts."
        />

        {/* ── Summary stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Paid"
            value={overview ? formatCurrency(overview.total_paid, currency) : '—'}
            icon={<CheckCircle className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-100 dark:bg-emerald-950/50"
            loading={!overview}
          />
          <StatCard
            label="Pending"
            value={overview ? formatCurrency(overview.total_pending, currency) : '—'}
            icon={<Clock className="h-4 w-4 text-amber-600" />}
            iconBg="bg-amber-100 dark:bg-amber-950/50"
            loading={!overview}
          />
          <StatCard
            label="Overdue"
            value={overview ? formatCurrency(overview.total_overdue, currency) : '—'}
            icon={<AlertCircle className="h-4 w-4 text-red-500" />}
            iconBg="bg-red-100 dark:bg-red-950/50"
            loading={!overview}
          />
          <StatCard
            label="Outstanding Balance"
            value={balance ? formatCurrency(balance.total_outstanding, currency) : '—'}
            icon={<CreditCard className="h-4 w-4 text-violet-600" />}
            iconBg="bg-violet-100 dark:bg-violet-950/50"
            loading={!balance}
            footer={
              balance?.is_up_to_date
                ? <span className="text-xs text-emerald-600 font-medium">✅ All up to date</span>
                : undefined
            }
          />
        </div>

        {/* ── Overdue alert ─────────────────────────────────────────── */}
        {overview && overview.total_overdue > 0 && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                You have overdue payments totalling {formatCurrency(overview.total_overdue, currency)}
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                Late fees may be applied. Please settle your balance as soon as possible.
              </p>
            </div>
            <button
              onClick={() => { setStatusFilter('overdue'); setPage(1); setActiveTab('all') }}
              className="text-xs font-medium text-red-700 dark:text-red-300 underline hover:no-underline shrink-0"
            >
              View overdue
            </button>
          </div>
        )}

        {/* ── Next payment due card ─────────────────────────────────── */}
        {nextDue && (
          <SectionCard title="Next Payment Due">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(nextDue.amount, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {nextDue.invoice_number} — due {formatDate(nextDue.due_date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={`text-sm font-semibold ${nextDue.days_until_due <= 5 ? 'text-red-500' : nextDue.days_until_due <= 14 ? 'text-amber-600' : 'text-foreground'}`}>
                    {nextDue.days_until_due > 0
                      ? `${nextDue.days_until_due} days remaining`
                      : 'Due today!'}
                  </p>
                  <StatusBadge status={nextDue.status} />
                </div>
                <button
                  onClick={() => {
                    // Find the invoice in rows and open pay modal
                    const inv = rows.find(r => r.id === nextDue.invoice_id)
                    if (inv) setPayInvoice(inv)
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <CreditCard className="h-4 w-4" /> Pay Now
                </button>
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── Tabs: All Invoices / Recent Payment History ───────────── */}
        <div>
          <div className="flex gap-1 border-b border-border mb-4">
            {([
              ['all',     'All Invoices'],
              ['history', 'Recent Payments'],
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
                {tab === 'history' && dashHistory.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {dashHistory.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── All invoices tab ─────────────────────────────────── */}
          {activeTab === 'all' && (
            <>
              <FilterBar
                actions={
                  statusFilter ? (
                    <button onClick={() => setStatusFilter('')} className="text-xs text-muted-foreground hover:text-foreground">
                      Clear filter
                    </button>
                  ) : undefined
                }
              >
                <Select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                  placeholder="All invoices"
                  className="w-40 text-xs"
                  options={[
                    { value: '',               label: 'All invoices' },
                    { value: 'pending',        label: 'Pending' },
                    { value: 'paid',           label: 'Paid' },
                    { value: 'overdue',        label: 'Overdue' },
                    { value: 'partially_paid', label: 'Partially Paid' },
                    { value: 'void',           label: 'Void' },
                  ]}
                />
              </FilterBar>

              {/* Table with expandable rows */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full border-collapse" aria-label="Invoice list">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {columns.map(col => (
                        <th key={col.key}
                          className={[
                            'px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap',
                            col.align === 'right' ? 'text-right' : 'text-left',
                            col.width ?? '',
                          ].join(' ')}
                        >
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr>
                        <td colSpan={columns.length} className="p-4">
                          <div className="space-y-2">
                            {[1,2,3,4,5].map(i => (
                              <div key={i} className="flex gap-4">
                                {columns.map((_, j) => (
                                  <div key={j} className="h-4 flex-1 bg-muted rounded animate-pulse" />
                                ))}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}

                    {isError && (
                      <tr>
                        <td colSpan={columns.length} className="px-4 py-10 text-center">
                          <p className="text-sm text-destructive mb-1">Failed to load invoices.</p>
                          <button onClick={() => void refetch()} className="text-xs text-primary hover:underline">
                            Try again
                          </button>
                        </td>
                      </tr>
                    )}

                    {!isLoading && !isError && rows.length === 0 && (
                      <tr>
                        <td colSpan={columns.length} className="px-4 py-12 text-center">
                          <div className="text-4xl mb-2">📄</div>
                          <p className="text-sm font-medium text-foreground">No invoices yet</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Invoices will appear here once your lease is active.
                          </p>
                        </td>
                      </tr>
                    )}

                    {!isLoading && !isError && rows.map(row => {
                      const id = row.id as number
                      const open = expandedId === id
                      return (
                        <React.Fragment key={id}>
                          <tr className={`border-b border-border transition-colors hover:bg-muted/30 ${open ? 'bg-muted/20' : ''}`}>
                            {columns.map(col => (
                              <td key={col.key}
                                className={[
                                  'px-4 py-3 text-sm',
                                  col.align === 'right' ? 'text-right' : 'text-left',
                                  col.width ?? '',
                                ].join(' ')}
                              >
                                {col.accessor(row)}
                              </td>
                            ))}
                          </tr>
                          {open && (
                            <tr className="border-b border-border">
                              <td colSpan={columns.length} className="p-0">
                                <InvoiceBreakdown id={id} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {meta && meta.last_page > 1 && (
                <div className="flex items-center justify-between pt-3">
                  <p className="text-xs text-muted-foreground">
                    Showing <span className="font-medium text-foreground">
                      {(meta.current_page - 1) * meta.per_page + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)}
                    </span> of <span className="font-medium text-foreground">{meta.total}</span>
                  </p>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(meta.current_page - 1)} disabled={meta.current_page <= 1}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                      ‹ Prev
                    </button>
                    <button onClick={() => setPage(meta.current_page + 1)} disabled={meta.current_page >= meta.last_page}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                      Next ›
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Recent payment history tab (from dashboard) ───────── */}
          {activeTab === 'history' && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full border-collapse" aria-label="Recent payment history">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {['Invoice #', 'Month', 'Amount', 'Rent Component', 'Status', 'Due Date', 'Paid Date', 'Reference', 'Receipt'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dashHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        No recent payments.
                      </td>
                    </tr>
                  ) : dashHistory.map(inv => (
                    <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-foreground">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatYearMonth(inv.invoice_month)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-foreground">{formatCurrency(inv.total_amount, currency)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatCurrency(inv.paid_amount, currency)}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(inv.due_date)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {inv.paid_at ? (
                          <span className="text-emerald-600">{formatDate(inv.paid_at)}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {inv.payment_reference ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {inv.status === 'paid' ? (
                          <button type="button" onClick={() => downloadInvoice(inv.id)}
                            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <Download className="h-3 w-3" /> PDF
                          </button>
                        ) : (
                          <button onClick={() => setPayInvoice(inv as unknown as Invoice)}
                            className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                            <CreditCard className="h-3 w-3" /> Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pay modal */}
      <PayModal
        invoice={payInvoice}
        currency={currency}
        onClose={() => setPayInvoice(null)}
        onSuccess={() => { setPayInvoice(null); void refetch() }}
      />
    </>
  )
}
