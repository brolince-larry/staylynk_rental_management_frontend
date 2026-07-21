// src/features/tenant/pages/Payments.tsx
// Shows actual payment transactions (not invoices).
// Includes: transaction list, receipt download, payment method breakdown.

import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Download, CheckCircle, CreditCard } from 'lucide-react'
import { useTenantPayments, useTenantDashboard } from '../hooks'
import { usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge, StatCard, SectionCard } from '@/components/ui'
import { formatCurrency, formatDate, formatDatetime } from '@/utils/format'
import { useAuthStore } from '@/store/auth.store'
import { openSignedDocument } from '@/api/documentDownloads'

type Payment = Record<string, unknown>

const METHOD_LABELS: Record<string, { label: string; icon: string }> = {
  mpesa:         { label: 'M-Pesa', icon: '📱' },
  bank_transfer: { label: 'Bank Transfer', icon: '🏦' },
  card:          { label: 'Card', icon: '💳' },
  cheque:        { label: 'Cheque', icon: '📝' },
  cash:          { label: 'Cash', icon: '💵' },
}

export default function TenantPaymentsPage(): React.ReactElement {
  const user = useAuthStore((s) => s.user)
  const orgCurrency = user?.org?.currency ?? 'USD'
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { toasts, info, error: toastError, dismiss } = useToast()

  const downloadReceipt = (id: number) => {
    void openSignedDocument(`/tenant/payments/${id}/receipt`, {
      onPending: (message) => info(message),
    }).catch((err) => toastError(err, 'Failed to download receipt'))
  }

  const { data, isLoading, isError } = useTenantPayments({ page, per_page: perPage })
  const { data: dashData } = useTenantDashboard()

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as Payment[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined
  const overview = (dashData as Record<string, unknown> | undefined)?.payment_overview as Record<string, number> | undefined

  const columns: ColumnDef<Payment>[] = [
    {
      key: 'reference',
      header: 'Reference',
      accessor: (row) => (
        <div>
          <p className="text-xs font-mono font-medium text-foreground">
            {(row.payment_reference as string) ?? '—'}
          </p>
          {Boolean(row.transaction_id) && (
            <p className="text-xs text-muted-foreground font-mono">
              {row.transaction_id as string}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'invoice',
      header: 'Invoice',
      accessor: (row) => {
        const inv = row.invoice as Record<string, unknown> | null
        return inv ? (
          <div>
            <p className="text-xs font-mono text-foreground">{inv.invoice_number as string}</p>
            <p className="text-xs text-muted-foreground">{inv.invoice_month as string}</p>
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      key: 'method',
      header: 'Method',
      accessor: (row) => {
        const m = row.method as string
        const info = METHOD_LABELS[m] ?? { label: m ?? '—', icon: '💰' }
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{info.icon}</span>
            <span className="text-xs text-foreground">{info.label}</span>
          </div>
        )
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      accessor: (row) => (
        <span className="text-xs font-semibold text-emerald-600">
          {formatCurrency(row.amount as number, orgCurrency)}
        </span>
      ),
    },
    {
      key: 'paid_at',
      header: 'Date',
      sortable: true,
      accessor: (row) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {row.paid_at ? formatDate(row.paid_at as string) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status as string} />,
    },
    {
      key: 'receipt',
      header: '',
      width: 'w-20',
      accessor: (row) =>
        row.has_receipt ? (
          <button
            type="button"
            onClick={() => downloadReceipt(row.id as number)}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            Receipt
          </button>
        ) : null,
    },
  ]

  // Compute method breakdown from rows
  const methodBreakdown = rows.reduce<Record<string, number>>((acc, row) => {
    const m = row.method as string
    acc[m] = (acc[m] ?? 0) + (row.amount as number)
    return acc
  }, {})

  return (
    <>
      <Helmet><title>Payment History — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="p-6 max-w-[1200px]">
        <PageHeader
          title="Payment History"
          subtitle="All your completed and pending payment transactions."
        />

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <StatCard
            label="Total Paid"
            value={overview ? formatCurrency(overview.total_paid, orgCurrency) : '—'}
            icon={<CheckCircle className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-100 dark:bg-emerald-950/50"
            loading={!overview}
          />
          <StatCard
            label="This Month"
            value={rows.length ? formatCurrency(
              rows.filter(r => {
                const d = r.paid_at as string | null
                if (!d) return false
                const now = new Date()
                const paid = new Date(d)
                return paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear()
              }).reduce((s, r) => s + (r.amount as number), 0), orgCurrency
            ) : '—'}
            icon={<CreditCard className="h-4 w-4 text-blue-600" />}
            iconBg="bg-blue-100 dark:bg-blue-950/50"
          />
          <StatCard
            label="Transactions"
            value={meta?.total ?? rows.length}
            icon={<CheckCircle className="h-4 w-4 text-violet-600" />}
            iconBg="bg-violet-100 dark:bg-violet-950/50"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
          {/* Payments table */}
          <DataTable
            columns={columns}
            data={rows}
            keyField="id"
            loading={isLoading}
            error={isError ? 'Failed to load payment history.' : null}
            emptyTitle="No payments yet"
            emptyDescription="Your payment transactions will appear here."
            pagination={meta}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
            caption="Payment history"
          />

          {/* Method breakdown sidebar */}
          <SectionCard title="Payment Methods">
            {Object.entries(methodBreakdown).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(methodBreakdown).map(([method, total]) => {
                  const info = METHOD_LABELS[method] ?? { label: method, icon: '💰' }
                  const grandTotal = Object.values(methodBreakdown).reduce((a, b) => a + b, 0)
                  const pct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0
                  return (
                    <div key={method}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{info.icon}</span>
                          <span className="text-xs text-foreground">{info.label}</span>
                        </div>
                        <span className="text-xs font-medium text-foreground">
                          {formatCurrency(total, orgCurrency)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 text-right">{pct}%</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No data yet</p>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  )
}
