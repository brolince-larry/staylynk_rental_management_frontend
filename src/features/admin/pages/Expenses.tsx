// src/features/admin/pages/Expenses.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus, TrendingUp, Wallet, ReceiptText, ChevronLeft, ChevronRight, Building2 } from 'lucide-react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiGet, apiPost, apiDelete } from '@/api/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { FilterBar, Select, Modal, Button, FormField, Input, Textarea, ConfirmDialog, ToastContainer } from '@/components/forms'
import { PageHeader } from '@/components/ui'
import { formatCurrency, formatDate } from '@/utils/format'
import { useAuthStore } from '@/store/auth.store'
import { propertiesApi } from '@/api/properties'

// ── Types ────────────────────────────────────────────────────────────────────

type Expense = Record<string, unknown>
interface OrgProperty { id: number; uuid: string; name: string }

interface ExpenseSummaryData {
  period: { month: string; year: number }
  salary_monthly: number; salary_yearly: number
  expenses_monthly: number; expenses_yearly: number
  total_monthly: number; total_yearly: number
  expense_breakdown: { category: string; total: number }[]
  per_property_breakdown: { id: string; name: string; total: number }[]
}

const CATEGORY_ICONS: Record<string, string> = {
  maintenance: '🔧', utilities: '⚡', salary: '👤', supplies: '📦',
  insurance: '🛡', tax: '📋', marketing: '📣', repair: '🔩', other: '💼',
}

const expenseSchema = z.object({
  property_id:    z.coerce.number().int().positive('Select a property'),
  title:          z.string().min(1, 'Title is required').max(255),
  category:       z.string().min(1, 'Category is required'),
  amount:         z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  expense_date:   z.string().min(1, 'Date is required'),
  payment_method: z.string().optional(),
  vendor:         z.string().optional(),
  receipt_path:   z.string().optional(),
  is_recurring:   z.boolean().optional(),
  description:    z.string().optional(),
})
type ExpenseForm = z.infer<typeof expenseSchema>

// ── Hooks ────────────────────────────────────────────────────────────────────

function useAdminExpenses(params: Record<string, unknown>) {
  const orgId = useAuthStore(s => s.user?.org?.id?.toString() ?? 'x')
  return useQuery({
    queryKey: ['admin', 'expenses', orgId, params],
    queryFn: () => apiGet<Record<string, unknown>>('/admin/expenses', params).then(r => r.data),
    staleTime: 30_000,
    placeholderData: prev => prev,
  })
}

function useCreateAdminExpense() {
  const qc    = useQueryClient()
  const orgId = useAuthStore(s => s.user?.org?.id?.toString() ?? 'x')
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost<Record<string, unknown>>('/admin/expenses', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'expenses', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'expense-summary', orgId] })
    },
  })
}

function useDeleteAdminExpense() {
  const qc    = useQueryClient()
  const orgId = useAuthStore(s => s.user?.org?.id?.toString() ?? 'x')
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/expenses/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'expenses', orgId] })
      void qc.invalidateQueries({ queryKey: ['admin', 'expense-summary', orgId] })
    },
  })
}

function useAllOrgProperties() {
  const orgId = useAuthStore(s => s.user?.org?.id?.toString() ?? 'x')
  return useQuery({
    queryKey: ['admin', 'properties', 'options', orgId],
    queryFn: () => propertiesApi.options().then(r => {
      const d = r.data as OrgProperty[] | { data: OrgProperty[] }
      return Array.isArray(d) ? d : (d as { data: OrgProperty[] }).data ?? []
    }),
    staleTime: Infinity,
  })
}

function useExpenseSummary(params: { property_id?: string; month?: string; year?: number }) {
  const orgId = useAuthStore(s => s.user?.org?.id?.toString() ?? 'x')
  return useQuery({
    queryKey: ['admin', 'expense-summary', orgId, params],
    queryFn: () => apiGet<ExpenseSummaryData>('/admin/org-users/expense-summary', params as Record<string, unknown>)
      .then(r => r.data),
    staleTime: 60_000,
  })
}

// ── Summary helpers ───────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  maintenance: 'Maintenance', utilities: 'Utilities', salary: 'Salary',
  supplies: 'Supplies', insurance: 'Insurance', tax: 'Tax',
  marketing: 'Marketing', repair: 'Repair', other: 'Other',
}

function fmtKes(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
}

function SummaryCard({ icon, label, monthly, yearly, accent }: {
  icon: React.ReactNode; label: string; monthly: number; yearly: number; accent: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>{icon}</span>
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
      <p className="text-base font-black text-foreground">{fmtKes(monthly)}<span className="ml-1 text-xs font-normal text-muted-foreground">/mo</span></p>
      <p className="text-xs text-muted-foreground">{fmtKes(yearly)}<span className="ml-1 opacity-70">/yr</span></p>
    </div>
  )
}

function ExpenseSummaryPanel({ summary, loading, month, filterPropId, onPrevMonth, onNextMonth, isCurrentMonth }: {
  summary: ExpenseSummaryData | null
  loading: boolean
  month: string
  filterPropId: string
  onPrevMonth: () => void
  onNextMonth: () => void
  isCurrentMonth: boolean
}) {
  return (
    <div className="mb-5 rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Expense Overview</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {summary?.period.year ?? month.slice(0, 4)}
          </span>
          {filterPropId && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">filtered by property</span>
          )}
        </div>
        {/* Month navigator */}
        <div className="flex items-center gap-1">
          <button onClick={onPrevMonth} className="rounded-lg border border-border p-1 hover:bg-muted transition-colors">
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <span className="min-w-[110px] text-center text-xs font-semibold text-foreground">{monthLabel(month)}</span>
          <button onClick={onNextMonth} disabled={isCurrentMonth}
            className="rounded-lg border border-border p-1 hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={<Wallet className="h-3.5 w-3.5 text-blue-600" />}
              label="Staff Salaries"
              monthly={summary?.salary_monthly ?? 0}
              yearly={summary?.salary_yearly ?? 0}
              accent="bg-blue-100 dark:bg-blue-950/40"
            />
            <SummaryCard
              icon={<ReceiptText className="h-3.5 w-3.5 text-amber-600" />}
              label="Recorded Expenses"
              monthly={summary?.expenses_monthly ?? 0}
              yearly={summary?.expenses_yearly ?? 0}
              accent="bg-amber-100 dark:bg-amber-950/40"
            />
            <div className="col-span-2 sm:col-span-1 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </span>
                <span className="text-xs font-semibold text-muted-foreground">Total Expenses</span>
              </div>
              <p className="text-base font-black text-primary">{fmtKes(summary?.total_monthly ?? 0)}<span className="ml-1 text-xs font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground">{fmtKes(summary?.total_yearly ?? 0)}<span className="ml-1 opacity-70">/yr</span></p>
            </div>
          </div>

          {(summary?.expense_breakdown?.length ?? 0) > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Breakdown — {monthLabel(month)}</p>
              <div className="flex flex-wrap gap-2">
                {summary!.expense_breakdown.map(row => (
                  <span key={row.category} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
                    <span className="font-medium text-foreground">{CATEGORY_LABELS[row.category] ?? row.category}</span>
                    <span className="text-muted-foreground">{fmtKes(row.total)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {(summary?.per_property_breakdown?.length ?? 0) > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">By property — {monthLabel(month)}</p>
              <div className="flex flex-wrap gap-2">
                {summary!.per_property_breakdown.map(row => (
                  <span key={row.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-foreground">{row.name}</span>
                    <span className="text-muted-foreground">{fmtKes(row.total)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminExpenses(): React.ReactElement {
  const currency = useAuthStore((s) => s.user?.org?.currency ?? 'KES')
  const [filterProp, setFilterProp]     = useState('')
  const [filterCat,  setFilterCat]      = useState('')
  const [from,       setFrom]           = useState('')
  const [to,         setTo]             = useState('')
  const [createOpen, setCreateOpen]     = useState(false)
  const [deleteId,   setDeleteId]       = useState<string | null>(null)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { toasts, success, error: toastError, dismiss } = useToast()

  // ── Expense summary period ───────────────────────────────────────────────
  const today = new Date()
  const [summaryMonth, setSummaryMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const summaryYear = parseInt(summaryMonth.slice(0, 4), 10)
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const { data: expSummary, isLoading: summaryLoading } = useExpenseSummary({
    property_id: filterProp || undefined,
    month: summaryMonth,
    year: summaryYear,
  })

  const { data: propertiesData = [] } = useAllOrgProperties()
  const allProperties = propertiesData as OrgProperty[]

  const params: Record<string, unknown> = { page, per_page: perPage }
  if (filterProp) params.property_id = filterProp
  if (filterCat)  params.category    = filterCat
  if (from)       params.from        = from
  if (to)         params.to          = to

  const { data, isLoading, isError } = useAdminExpenses(params)
  const { mutate: createExpense, isPending: creating } = useCreateAdminExpense()
  const { mutate: deleteExpense, isPending: deleting } = useDeleteAdminExpense()

  const form = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema) as Resolver<ExpenseForm>,
    defaultValues: { is_recurring: false },
  })

  const handleCreate = (values: ExpenseForm) => {
    createExpense(
      { ...values, amount: Number(values.amount) },
      {
        onSuccess: () => { success('Expense recorded'); setCreateOpen(false); form.reset({ is_recurring: false }) },
        onError:   (err) => toastError(err, 'Failed to save expense'),
      },
    )
  }

  const list  = data as Record<string, unknown> | undefined
  const rows  = (list?.data as Expense[]) ?? []
  const meta  = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined
  const pageTotal = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0)

  const columns: ColumnDef<Expense>[] = [
    {
      key: 'title', header: 'Expense',
      accessor: (row) => {
        const cat = row.category as string
        return (
          <div className="flex items-center gap-2">
            <span className="text-base">{CATEGORY_ICONS[cat] ?? '💼'}</span>
            <div>
              <p className="text-xs font-medium text-foreground">{row.title as string}</p>
              <p className="text-xs text-muted-foreground capitalize">{cat?.replace(/_/g, ' ')}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'property', header: 'Property',
      accessor: (row) => {
        const p = row.property as Record<string, string> | null
        return <span className="text-xs text-muted-foreground">{p?.name ?? '—'}</span>
      },
    },
    {
      key: 'vendor', header: 'Vendor',
      accessor: (row) => <span className="text-xs text-muted-foreground">{(row.vendor as string) || '—'}</span>,
    },
    {
      key: 'amount', header: 'Amount', align: 'right',
      accessor: (row) => <span className="text-xs font-semibold text-foreground">{formatCurrency(row.amount as number, currency)}</span>,
    },
    {
      key: 'expense_date', header: 'Date',
      accessor: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.expense_date as string)}</span>,
    },
    {
      key: 'created_by', header: 'Recorded By',
      accessor: (row) => {
        const by = row.created_by as Record<string, string> | null
        return <span className="text-xs text-muted-foreground">{by?.name ?? '—'}</span>
      },
    },
    {
      key: 'actions', header: '', width: 'w-16',
      accessor: (row) => (
        <button
          onClick={e => { e.stopPropagation(); setDeleteId(row.uuid as string) }}
          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          Delete
        </button>
      ),
    },
  ]

  const propOptions = [
    { value: '', label: 'All properties' },
    ...allProperties.map(p => ({ value: String(p.id), label: p.name })),
  ]

  return (
    <>
      <Helmet><title>Expenses — Admin</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Expenses"
          subtitle="Record and track costs across all your properties — maintenance, utilities, salaries, and more."
          actions={
            <Button onClick={() => { form.reset({ is_recurring: false }); setCreateOpen(true) }}>
              <Plus className="h-3.5 w-3.5" /> Record Expense
            </Button>
          }
        />

        {/* ── Expense Overview Summary ── */}
        <ExpenseSummaryPanel
          summary={expSummary ?? null}
          loading={summaryLoading}
          month={summaryMonth}
          filterPropId={filterProp}
          onPrevMonth={() => {
            const d = new Date(summaryMonth + '-01')
            d.setMonth(d.getMonth() - 1)
            setSummaryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
          }}
          onNextMonth={() => {
            const d = new Date(summaryMonth + '-01')
            d.setMonth(d.getMonth() + 1)
            if (d <= today) setSummaryMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
          }}
          isCurrentMonth={summaryMonth === currentMonthStr}
        />

        {rows.length > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {meta?.total ?? rows.length} expense{(meta?.total ?? rows.length) !== 1 ? 's' : ''} found
            </p>
            <p className="text-sm font-bold text-foreground">
              Page total: {formatCurrency(pageTotal, currency)}
            </p>
          </div>
        )}

        <FilterBar>
          <Select
            value={filterProp}
            onChange={e => { setFilterProp(e.target.value); setPage(1) }}
            className="w-44 text-xs"
            options={propOptions}
          />
          <Select
            value={filterCat}
            onChange={e => { setFilterCat(e.target.value); setPage(1) }}
            placeholder="All categories"
            className="w-40 text-xs"
            options={[
              { value: '', label: 'All categories' },
              ...Object.keys(CATEGORY_ICONS).map(v => ({
                value: v,
                label: v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' '),
              })),
            ]}
          />
          <Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} className="h-9 w-36 text-xs" />
          <Input type="date" value={to}   onChange={e => { setTo(e.target.value);   setPage(1) }} className="h-9 w-36 text-xs" />
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          loading={isLoading}
          error={isError ? 'Failed to load expenses.' : null}
          emptyTitle="No expenses recorded"
          emptyDescription="Use the Record Expense button to log your first cost."
          pagination={meta}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          caption="Expenses"
        />
      </div>

      {/* ── Record Expense Modal ── */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); form.reset({ is_recurring: false }) }}
        title="Record Expense"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => { setCreateOpen(false); form.reset({ is_recurring: false }) }}>
              Cancel
            </Button>
            <Button loading={creating} onClick={form.handleSubmit(handleCreate)}>
              Save Expense
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(handleCreate)} className="grid grid-cols-2 gap-4">
          {/* Property selector */}
          <FormField
            label="Property"
            htmlFor="e-prop"
            error={form.formState.errors.property_id?.message}
            required
            className="col-span-2"
          >
            <Select
              id="e-prop"
              error={!!form.formState.errors.property_id}
              placeholder="Select property"
              {...form.register('property_id')}
              options={[
                { value: 0, label: 'Select property…' },
                ...allProperties.map(p => ({ value: p.id, label: p.name })),
              ]}
            />
          </FormField>

          <FormField label="Title" htmlFor="e-title" error={form.formState.errors.title?.message} required className="col-span-2">
            <Input id="e-title" placeholder="e.g. Plumbing repair – Block A" error={!!form.formState.errors.title} {...form.register('title')} />
          </FormField>

          <FormField label="Category" htmlFor="e-cat" error={form.formState.errors.category?.message} required>
            <Select
              id="e-cat"
              error={!!form.formState.errors.category}
              placeholder="Select category"
              {...form.register('category')}
              options={Object.keys(CATEGORY_ICONS).map(v => ({
                value: v,
                label: v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' '),
              }))}
            />
          </FormField>

          <FormField label="Amount (KES)" htmlFor="e-amount" error={form.formState.errors.amount?.message} required>
            <Input id="e-amount" type="number" min={0} step="0.01" placeholder="0.00" error={!!form.formState.errors.amount} {...form.register('amount')} />
          </FormField>

          <FormField label="Date" htmlFor="e-date" error={form.formState.errors.expense_date?.message} required>
            <Input id="e-date" type="date" error={!!form.formState.errors.expense_date} {...form.register('expense_date')} />
          </FormField>

          <FormField label="Vendor / Supplier" htmlFor="e-vendor">
            <Input id="e-vendor" placeholder="e.g. Nairobi Plumbers Ltd" {...form.register('vendor')} />
          </FormField>

          <FormField label="Payment Method" htmlFor="e-pay">
            <Select
              id="e-pay"
              placeholder="Select"
              {...form.register('payment_method')}
              options={[
                { value: 'cash',          label: 'Cash' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'card',          label: 'Card' },
                { value: 'cheque',        label: 'Cheque' },
              ]}
            />
          </FormField>

          <FormField label="Receipt / Reference" htmlFor="e-receipt" className="col-span-2">
            <Input id="e-receipt" placeholder="Optional receipt number" {...form.register('receipt_path')} />
          </FormField>

          <label className="flex items-center gap-2 text-xs font-medium text-foreground">
            <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" {...form.register('is_recurring')} />
            Recurring monthly expense
          </label>
          <div />

          <FormField label="Notes" htmlFor="e-notes" className="col-span-2">
            <Textarea id="e-notes" rows={2} placeholder="Optional notes…" {...form.register('description')} />
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return
          deleteExpense(deleteId, {
            onSuccess: () => { success('Expense deleted'); setDeleteId(null) },
            onError:   (err) => toastError(err, 'Failed to delete'),
          })
        }}
        title="Delete Expense"
        description="This permanently removes the expense record. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />
    </>
  )
}
