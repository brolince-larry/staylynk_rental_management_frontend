// src/features/tenant/pages/Lease.tsx
// Full lease detail page for tenant — matches the "My Lease" sidebar item.
import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Download, FileText, AlertTriangle } from 'lucide-react'
import { useTenantLease, useTenantLeaseHistory } from '../hooks/index'
import { useAuthStore } from '@/store/auth.store'
import { PageHeader, StatusBadge, SectionCard } from '@/components/ui'
import { Button, ToastContainer } from '@/components/forms'
import { formatCurrency, formatDate, formatPercent } from '@/utils/format'
import { useToast } from '@/hooks'
import { openSignedDocument } from '@/api/documentDownloads'

export default function TenantLease(): React.ReactElement {
  const user     = useAuthStore(s => s.user)
  const currency = user?.org?.currency ?? 'USD'
  const { toasts, info, error: toastError, dismiss } = useToast()

  const downloadAgreement = () => {
    void openSignedDocument('/tenant/lease/agreement', {
      onPending: (message) => info(message),
    }).catch((err) => toastError(err, 'Failed to download lease agreement'))
  }

  const { data: leaseData, isLoading }  = useTenantLease()
  const { data: historyData }           = useTenantLeaseHistory()

  const lease   = leaseData   as Record<string, unknown> | undefined
  const history = (historyData as Record<string, unknown>[] | undefined) ?? []

  // Progress through lease term
  const progressPct = lease
    ? Math.min(100, Math.max(0,
        ((lease.lease_term_months as number) - (lease.days_remaining as number) / 30)
        / (lease.lease_term_months as number) * 100
      ))
    : 0

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="My Lease" />
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              {[1,2,3,4].map(j => <div key={j} className="h-4 bg-muted rounded animate-pulse" />)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!lease) {
    return (
      <div className="p-6">
        <PageHeader title="My Lease" />
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No active lease</p>
          <p className="text-xs text-muted-foreground mt-1">Contact your property manager to set up a lease.</p>
        </div>
      </div>
    )
  }

  const daysLeft = lease.days_remaining as number
  const isExpiringSoon = daysLeft <= 30 && daysLeft > 0

  return (
    <>
      <Helmet><title>My Lease — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6 max-w-[1000px] space-y-4">
        <PageHeader
          title="My Lease"
          subtitle="Your current lease agreement details."
          actions={
            <Button variant="outline" size="sm" onClick={downloadAgreement}>
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
          }
        />

        {/* Expiry alert */}
        {isExpiringSoon && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Lease expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                Contact your property manager to discuss renewal.
              </p>
            </div>
          </div>
        )}

        {/* Header card */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-lg font-bold text-foreground">{lease.lease_number as string}</p>
                <StatusBadge status={lease.status as string} />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(lease.start_date as string)} — {formatDate(lease.end_date as string)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">{formatCurrency(lease.monthly_rent as number, currency)}</p>
              <p className="text-xs text-muted-foreground">per month</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Lease progress</span>
              <span>{Math.round(progressPct)}% complete · {daysLeft} days remaining</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isExpiringSoon ? 'bg-amber-500' : 'bg-primary'}`}
                style={{ width: `${progressPct}%` }}
                role="progressbar" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}
              />
            </div>
          </div>
        </div>

        {/* Lease details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Lease Details">
            {[
              ['Lease ID',         lease.lease_number],
              ['Status',           <StatusBadge key="s" status={lease.status as string} />],
              ['Start Date',       formatDate(lease.start_date as string)],
              ['End Date',         formatDate(lease.end_date as string)],
              ['Term',             `${lease.lease_term_months as number} months`],
              ['Monthly Rent',     formatCurrency(lease.monthly_rent as number, currency)],
              ['Security Deposit', formatCurrency(lease.security_deposit as number ?? 0, currency)],
              ['Advance Rent',     lease.advance_rent ? formatCurrency(lease.advance_rent as number, currency) : '—'],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between py-2 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground">{label as string}</span>
                <span className="text-xs font-medium text-foreground text-right">{value as React.ReactNode}</span>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Payment Information">
            {[
              ['Payment Due Day',    `${lease.payment_due_day as number}st of each month`],
              ['Payment Method',     String(lease.payment_method ?? '—').replace(/_/g, ' ')],
              ['Days Remaining',     `${daysLeft} days`],
              ['Next Due Date',      formatDate(lease.next_due_date as string ?? '')],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between py-2 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground">{label as string}</span>
                <span className="text-xs font-medium text-foreground capitalize">{value as string}</span>
              </div>
            ))}

            {Boolean(lease.terms) && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-medium text-foreground mb-2">Terms & Conditions</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{lease.terms as string}</p>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Lease history */}
        {history.length > 0 && (
          <SectionCard title="Lease History">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Lease history">
                <thead>
                  <tr className="border-b border-border">
                    {['Lease #', 'Start', 'End', 'Rent', 'Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id as number} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{h.lease_number as string}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(h.start_date as string)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(h.end_date as string)}</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-foreground">{formatCurrency(h.monthly_rent as number, currency)}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={h.status as string} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>
    </>
  )
}
