// src/features/manager/pages/Leases.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus, Download, AlertTriangle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useManagerLeases, useCreateLease, useTerminateLease, useRenewLease, useRecordLastPayment, useLeaseSummary, useLeasesExpiring } from '../hooks/index'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef, type SortState } from '@/components/tables/DataTable'
import { SearchInput, FilterBar, Select, Modal, Button, FormField, Input, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge, SectionCard, PermissionDeniedModal } from '@/components/ui'
import { leaseSchema, terminateLeaseSchema, type LeaseSchema, type TerminateLeaseSchema } from '@/schemas/lease.schema'
import { formatCurrency, formatDate } from '@/utils/format'
import { openSignedDocument } from '@/api/documentDownloads'
import { tenantsApi } from '@/api/tenants'
import { roomsApi } from '@/api/rooms'
import type { RecordLastPaymentResult } from '@/api/leases'
import { extractPermissionDenied, type PermissionDeniedBlock } from '@/utils/errors'
import { useAuthStore } from '@/store/auth.store'

type Lease = Record<string, unknown>

export default function ManagerLeases(): React.ReactElement {
  const currency = useAuthStore((s) => s.user?.org?.currency ?? 'KES')
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatus]     = useState('active')
  const [createOpen, setCreateOpen]   = useState(false)
  const [terminateId, setTerminateId] = useState<number | null>(null)
  const [paymentLease, setPaymentLease] = useState<Lease | null>(null)
  const [paymentResult, setPaymentResult] = useState<RecordLastPaymentResult | null>(null)
  const [permissionDenied, setPermissionDenied] = useState<PermissionDeniedBlock | null>(null)
  const [paidDate, setPaidDate]     = useState(new Date().toISOString().slice(0, 10))
  const [paidAmount, setPaidAmount] = useState('')
  const [paidNotes, setPaidNotes]   = useState('')
  const [sort, setSort]               = useState<SortState>({ column: 'start_date', direction: 'desc' })
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const handleLockedError = (err: unknown, fallback: string) => {
    const block = extractPermissionDenied(err)
    if (block) { setPermissionDenied(block); return }
    toastError(err, fallback)
  }

  const downloadLease = (id: number) => {
    void openSignedDocument(`/manager/leases/${id}/download`, {
      onPending: (message) => success(message),
    }).catch((err) => toastError(err, 'Failed to download lease'))
  }

  const { data, isLoading, isError }      = useManagerLeases({ search: debouncedSearch || undefined, status: statusFilter || undefined, sort: sort.column, direction: sort.direction, page, per_page: perPage })
  const { data: summaryData }             = useLeaseSummary()
  const { data: expiringData }            = useLeasesExpiring(30)
  const { mutate: createLease, isPending: creating }   = useCreateLease()
  const { mutate: terminate,   isPending: terminating } = useTerminateLease()
  const { mutate: recordPayment, isPending: recordingPayment } = useRecordLastPayment()

  const { data: tenantData } = useQuery({
    queryKey: ['manager', 'tenants', 'options'],
    queryFn: () => tenantsApi.managerList({ per_page: 200 }).then((r) => r.data),
    enabled: createOpen,
    staleTime: 60_000,
  })
  const { data: roomData } = useQuery({
    queryKey: ['manager', 'rooms', 'options'],
    queryFn: () => roomsApi.managerList({ per_page: 200, status: 'available' }).then((r) => r.data),
    enabled: createOpen,
    staleTime: 60_000,
  })
  const tenantOptions = ((tenantData as Record<string, unknown>)?.data as Record<string, unknown>[] ?? []).map((t) => ({
    value: String(t.id),
    label: String(t.name),
  }))
  const roomOptions = ((roomData as Record<string, unknown>)?.data as Record<string, unknown>[] ?? []).map((r) => {
    const num   = String(r.room_number ?? r.id)
    const block = r.block ? ` · Block ${r.block}` : ''
    const floor = r.floor ? ` · Fl ${r.floor}` : ''
    return { value: String(r.id), label: `Room ${num}${block}${floor}` }
  })

  const createForm    = useForm<LeaseSchema>({ resolver: zodResolver(leaseSchema), defaultValues: { lease_term_months: 12, payment_due_day: 1, payment_method: 'bank_transfer' } })
  const terminateForm = useForm<TerminateLeaseSchema>({ resolver: zodResolver(terminateLeaseSchema) })

  const summary  = summaryData  as Record<string, number> | undefined
  const expiring = expiringData as { count: number; leases: Lease[] } | undefined

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
        return t ? <div><p className="text-xs font-medium text-foreground">{t.name}</p><p className="text-xs text-muted-foreground">{t.email}</p></div> : <span className="text-xs text-muted-foreground">—</span>
      },
    },
    {
      key: 'room', header: 'Room',
      accessor: (row) => {
        const r = row.room     as Record<string, string> | null
        const p = row.property as Record<string, string> | null
        return <div><p className="text-xs font-medium text-foreground">{r ? `Room ${r.room_number}` : '—'}</p><p className="text-xs text-muted-foreground">{p?.name ?? '—'}</p></div>
      },
    },
    {
      key: 'monthly_rent', header: 'Rent', align: 'right', sortable: true,
      accessor: (row) => <span className="text-xs font-semibold">{formatCurrency(row.monthly_rent as number, currency)}</span>,
    },
    {
      key: 'end_date', header: 'Expires', sortable: true,
      accessor: (row) => {
        const days = row.days_remaining as number
        return (
          <div>
            <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.end_date as string)}</p>
            {days !== undefined && days <= 30 && days > 0 && (
              <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />{days}d
              </p>
            )}
          </div>
        )
      },
    },
    { key: 'status', header: 'Status', sortable: true, accessor: (row) => <StatusBadge status={row.status as string} /> },
    {
      key: 'actions', header: '', width: 'w-44',
      accessor: (row) => {
        const id = row.id as number
        const s  = row.status as string
        return (
          <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => downloadLease(id)} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><Download className="h-3.5 w-3.5" /></button>
            {s === 'active' && (
              <button
                type="button"
                onClick={() => {
                  setPaidDate(new Date().toISOString().slice(0, 10))
                  setPaidAmount('')
                  setPaidNotes('')
                  setPaymentResult(null)
                  setPaymentLease(row)
                }}
                className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
              >
                Record Payment
              </button>
            )}
            {s === 'active' && <button onClick={() => setTerminateId(id)} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">Terminate</button>}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Leases — Manager</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        {/* Expiring alert */}
        {expiring && expiring.count > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {expiring.count} lease{expiring.count !== 1 ? 's' : ''} expiring in the next 30 days
            </p>
          </div>
        )}

        <PageHeader
          title="Lease Agreements"
          subtitle="Manage all active tenant leases."
          actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> New Lease</Button>}
        />

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[['Total', summary.total], ['Active', summary.active], ['Expiring (30d)', summary.expiring_30], ['Terminated', summary.terminated]].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">{l as string}</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{v as number}</p>
              </div>
            ))}
          </div>
        )}

        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tenant, room…" className="w-64" />
          <Select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }} placeholder="All" className="w-36 text-xs"
            options={[{ value:'', label:'All' }, { value:'active', label:'Active' }, { value:'expired', label:'Expired' }, { value:'terminated', label:'Terminated' }]} />
        </FilterBar>

        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading}
          error={isError ? 'Failed to load leases.' : null}
          emptyTitle="No leases found"
          sort={sort} onSort={(col, dir) => { setSort({ column: col, direction: dir }); setPage(1) }}
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Leases" />
      </div>

      {/* Create lease */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); createForm.reset() }}
        title="New Lease Agreement" size="lg"
        footer={<><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button loading={creating} onClick={createForm.handleSubmit(v => { createLease(v, { onSuccess: () => { success('Lease created'); setCreateOpen(false); createForm.reset() }, onError: (err) => toastError(err, 'Failed to create lease') }) })}>Create Lease</Button></>}
      >
        <form className="grid grid-cols-2 gap-4">
          <FormField label="Tenant" htmlFor="ltenant" error={createForm.formState.errors.tenant_id?.message} required>
            <Select id="ltenant" placeholder="Select tenant…" options={tenantOptions} error={!!createForm.formState.errors.tenant_id} {...createForm.register('tenant_id')} />
          </FormField>
          <FormField label="Room" htmlFor="lroom" error={createForm.formState.errors.room_id?.message} required>
            <Select id="lroom" placeholder="Select available room…" options={roomOptions} error={!!createForm.formState.errors.room_id} {...createForm.register('room_id')} />
          </FormField>
          <FormField label="Start Date" htmlFor="lstart" error={createForm.formState.errors.start_date?.message} required>
            <Input id="lstart" type="date" error={!!createForm.formState.errors.start_date} {...createForm.register('start_date')} />
          </FormField>
          <FormField label="Term (months)" htmlFor="lterm" error={createForm.formState.errors.lease_term_months?.message} required>
            <Input id="lterm" type="number" min={1} max={60} error={!!createForm.formState.errors.lease_term_months} {...createForm.register('lease_term_months')} />
          </FormField>
          <FormField label="Monthly Rent" htmlFor="lrent" error={createForm.formState.errors.monthly_rent?.message} required>
            <Input id="lrent" type="number" min={0} step="0.01" error={!!createForm.formState.errors.monthly_rent} {...createForm.register('monthly_rent')} />
          </FormField>
          <FormField label="Security Deposit" htmlFor="ldeposit">
            <Input id="ldeposit" type="number" min={0} step="0.01" {...createForm.register('security_deposit')} />
          </FormField>
          <FormField label="Payment Due Day" htmlFor="lpaydue">
            <Input id="lpaydue" type="number" min={1} max={28} {...createForm.register('payment_due_day')} />
          </FormField>
        </form>
      </Modal>

      {/* Terminate */}
      <Modal open={!!terminateId} onClose={() => { setTerminateId(null); terminateForm.reset() }}
        title="Terminate Lease" description="This ends the lease early and frees the room." size="sm"
        footer={<><Button variant="outline" onClick={() => setTerminateId(null)}>Cancel</Button><Button variant="destructive" loading={terminating} onClick={terminateForm.handleSubmit(v => { if (terminateId) terminate({ id: terminateId, ...v }, { onSuccess: () => { success('Lease terminated'); setTerminateId(null) }, onError: (err) => toastError(err, 'Failed') }) })}>Terminate</Button></>}
      >
        <form className="space-y-4">
          <FormField label="Reason" htmlFor="treason" error={terminateForm.formState.errors.reason?.message} required>
            <Textarea id="treason" rows={3} placeholder="Reason for early termination…" error={!!terminateForm.formState.errors.reason} {...terminateForm.register('reason')} />
          </FormField>
          <FormField label="Termination Date" htmlFor="tdate" hint="Leave blank for today">
            <Input id="tdate" type="date" {...terminateForm.register('termination_date')} />
          </FormField>
        </form>
      </Modal>

      {/* Record last payment — captures arrears for tenants onboarded mid-tenancy */}
      <Modal
        open={!!paymentLease}
        onClose={() => setPaymentLease(null)}
        title="Record Last Payment"
        description="For tenants already renting before joining the system — enter when and how much they last paid so the system can calculate any arrears."
        size="sm"
        footer={
          paymentResult ? (
            <Button className="w-full" onClick={() => setPaymentLease(null)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setPaymentLease(null)}>Cancel</Button>
              <Button
                loading={recordingPayment}
                disabled={!paidAmount}
                onClick={() => {
                  if (!paymentLease) return
                  recordPayment(
                    { id: String(paymentLease.id), last_paid_date: paidDate, last_paid_amount: Number(paidAmount), notes: paidNotes || undefined },
                    {
                      onSuccess: (res) => { setPaymentResult(res.data); success('Last payment recorded') },
                      onError: (err) => handleLockedError(err, 'Failed to record payment'),
                    }
                  )
                }}
              >
                Save
              </Button>
            </>
          )
        }
      >
        {paymentResult ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Unpaid months</p>
              <p className="text-sm font-semibold text-foreground">{paymentResult.unpaid_months}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Total owed</p>
              <p className="text-sm font-semibold text-foreground">{formatCurrency(paymentResult.total_owed, currency)}</p>
            </div>
            {paymentResult.excess_applied > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Overpayment applied to arrears</p>
                <p className="text-sm font-semibold text-emerald-600">{formatCurrency(paymentResult.excess_applied, currency)}</p>
              </div>
            )}
            <div className={`rounded-lg border p-3 ${paymentResult.arrears_balance > 0 ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'}`}>
              <p className="text-xs text-muted-foreground">Arrears balance</p>
              <p className={`text-lg font-bold ${paymentResult.arrears_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(paymentResult.arrears_balance, currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {paymentResult.arrears_balance > 0
                  ? "This is due immediately and shows on the tenant's portal and dashboard now."
                  : 'Tenant is fully paid up to date.'}
              </p>
            </div>
          </div>
        ) : (
          <form className="space-y-4">
            <FormField label="Last Paid Date" htmlFor="pplast_date" required>
              <Input id="pplast_date" type="date" max={new Date().toISOString().slice(0, 10)} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </FormField>
            <FormField label="Amount Last Paid" htmlFor="pplast_amount" required>
              <Input id="pplast_amount" type="number" min={0} step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
            </FormField>
            <FormField label="Notes" htmlFor="ppnotes" hint="Optional">
              <Textarea id="ppnotes" rows={2} value={paidNotes} onChange={(e) => setPaidNotes(e.target.value)} />
            </FormField>
          </form>
        )}
      </Modal>

      <PermissionDeniedModal block={permissionDenied} onClose={() => setPermissionDenied(null)} />
    </>
  )
}
