// src/features/manager/pages/Expenses.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus } from 'lucide-react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useManagerExpenses, useCreateExpense, useDeleteExpense } from '../hooks/index'
import { usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { FilterBar, Select, Modal, Button, FormField, Input, Textarea, ConfirmDialog, ToastContainer } from '@/components/forms'
import { PageHeader } from '@/components/ui'
import { expenseSchema, type ExpenseSchema } from '@/schemas/misc.schema'
import { formatCurrency, formatDate } from '@/utils/format'
import { useAuthStore } from '@/store/auth.store'
import { isApiError } from '@/utils/errors'

type Expense = Record<string, unknown>

const CATEGORY_ICONS: Record<string, string> = {
  maintenance:'🔧', utilities:'⚡', salary:'👤', supplies:'📦',
  insurance:'🛡', tax:'📋', marketing:'📣', repair:'🔩', other:'💼',
}

const NO_ACTIVE_PROPERTY_MESSAGE = 'No active property is available for this account.'
const NO_ASSIGNED_PROPERTY_MESSAGE = 'No property is assigned to your account. Please contact admin.'

function buildExpensePayload(values: ExpenseSchema): Parameters<ReturnType<typeof useCreateExpense>['mutate']>[0] {
  return {
    title: values.title,
    description: values.description || undefined,
    category: values.category,
    amount: values.amount,
    expense_date: values.expense_date,
    payment_method: values.payment_method || undefined,
    vendor: values.vendor || undefined,
    receipt_path: values.receipt_path || undefined,
    is_recurring: values.is_recurring ?? false,
  }
}

function expenseErrorMessage(err: unknown): string | unknown {
  if (isApiError(err) && err.status === 422 && err.message === NO_ACTIVE_PROPERTY_MESSAGE) {
    return NO_ASSIGNED_PROPERTY_MESSAGE
  }
  return err
}

export default function Expenses(): React.ReactElement {
  const currency = useAuthStore((s) => s.user?.org?.currency ?? 'KES')
  const currentProperty = useAuthStore((state) => state.user?.current_property)
  const [category, setCategory]   = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId]   = useState<number | null>(null)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError } = useManagerExpenses({ category: category || undefined, page, per_page: perPage } as Record<string, unknown>)
  const { mutate: createExpense, isPending: creating } = useCreateExpense()
  const { mutate: deleteExpense, isPending: deleting } = useDeleteExpense()

  const form = useForm<ExpenseSchema>({
    resolver: zodResolver(expenseSchema) as Resolver<ExpenseSchema>,
    defaultValues: { is_recurring: false },
  })

  const handleCreate = (values: ExpenseSchema) => {
    createExpense(buildExpensePayload(values), {
      onSuccess: () => { success('Expense recorded'); setCreateOpen(false); form.reset() },
      onError: (err) => toastError(expenseErrorMessage(err), 'Failed to save expense'),
    })
  }

  const list  = data as Record<string, unknown> | undefined
  const rows  = (list?.data as Expense[]) ?? []
  const meta  = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  // Totals
  const total = rows.reduce((s, r) => s + (r.amount as number), 0)

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
      accessor: (row) => <span className="text-xs text-muted-foreground">{row.vendor as string ?? '—'}</span>,
    },
    {
      key: 'amount', header: 'Amount', align: 'right', sortable: true,
      accessor: (row) => <span className="text-xs font-semibold text-foreground">{formatCurrency(row.amount as number, currency)}</span>,
    },
    {
      key: 'expense_date', header: 'Date', sortable: true,
      accessor: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.expense_date as string)}</span>,
    },
    {
      key: 'actions', header: '', width: 'w-16',
      accessor: (row) => (
        <button onClick={e => { e.stopPropagation(); setDeleteId(row.id as number) }}
          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
          Delete
        </button>
      ),
    },
  ]

  return (
    <>
      <Helmet><title>Expenses — Manager</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader title="Expenses" subtitle={`Track running costs for ${currentProperty?.name ?? 'your assigned property'}.`}
          actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Expense</Button>}
        />

        {/* Total banner */}
        {rows.length > 0 && (
          <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Showing {rows.length} expenses</p>
            <p className="text-sm font-bold text-foreground">Total: {formatCurrency(total, currency)}</p>
          </div>
        )}

        <FilterBar>
          <Select value={category} onChange={e => { setCategory(e.target.value); setPage(1) }} placeholder="All categories" className="w-40 text-xs"
            options={[
              { value:'', label:'All categories' },
              ...Object.entries(CATEGORY_ICONS).map(([v]) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') })),
            ]}
          />
        </FilterBar>

        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading}
          error={isError ? 'Failed to load expenses.' : null}
          emptyTitle="No expenses recorded"
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Expenses" />
      </div>

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); form.reset() }}
        title="Record Expense" size="md"
        footer={<><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button loading={creating} onClick={form.handleSubmit(handleCreate)}>Save</Button></>}
      >
        <form onSubmit={form.handleSubmit(handleCreate)} className="grid grid-cols-2 gap-4">
          <FormField label="Title" htmlFor="etitle" error={form.formState.errors.title?.message} required className="col-span-2">
            <Input id="etitle" placeholder="e.g. Plumbing repair – Block A" error={!!form.formState.errors.title} {...form.register('title')} />
          </FormField>
          <FormField label="Category" htmlFor="ecat" error={form.formState.errors.category?.message} required>
            <Select id="ecat" error={!!form.formState.errors.category} placeholder="Select category" {...form.register('category')}
              options={Object.keys(CATEGORY_ICONS).map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') }))} />
          </FormField>
          <FormField label="Amount" htmlFor="eamount" error={form.formState.errors.amount?.message} required>
            <Input id="eamount" type="number" min={0} step="0.01" error={!!form.formState.errors.amount} {...form.register('amount')} />
          </FormField>
          <FormField label="Date" htmlFor="edate" error={form.formState.errors.expense_date?.message} required>
            <Input id="edate" type="date" error={!!form.formState.errors.expense_date} {...form.register('expense_date')} />
          </FormField>
          <FormField label="Vendor" htmlFor="evendor">
            <Input id="evendor" placeholder="Vendor name" {...form.register('vendor')} />
          </FormField>
          <FormField label="Payment Method" htmlFor="epaymethod">
            <Select id="epaymethod" placeholder="Select" {...form.register('payment_method')}
              options={[{ value:'cash', label:'Cash' }, { value:'bank_transfer', label:'Bank Transfer' }, { value:'card', label:'Card' }, { value:'cheque', label:'Cheque' }]} />
          </FormField>
          <FormField label="Receipt Path" htmlFor="ereceipt">
            <Input id="ereceipt" placeholder="Optional receipt path" {...form.register('receipt_path')} />
          </FormField>
          <label className="flex items-center gap-2 text-xs font-medium text-foreground">
            <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" {...form.register('is_recurring')} />
            Recurring expense
          </label>
          <FormField label="Notes" htmlFor="enotes" className="col-span-2">
            <Textarea id="enotes" rows={2} placeholder="Optional notes…" {...form.register('description')} />
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { if (!deleteId) return; deleteExpense(deleteId, { onSuccess: () => { success('Expense deleted'); setDeleteId(null) }, onError: (err) => toastError(expenseErrorMessage(err), 'Failed') }) }}
        title="Delete Expense" description="This permanently removes the expense record."
        confirmLabel="Delete" variant="destructive" loading={deleting}
      />
    </>
  )
}
