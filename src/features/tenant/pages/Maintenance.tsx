// src/features/tenant/pages/Maintenance.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTenantMaintenanceList, useSubmitMaintenance } from '../hooks'
import { usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { FilterBar, Select, Modal, Button, FormField, Input, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge } from '@/components/ui'
import { formatRelative } from '@/utils/format'
import { tenantMaintenanceSchema, type TenantMaintenanceSchema } from '@/schemas'

const PRIORITY_COLORS: Record<string, string> = {
  high:   'text-orange-600 bg-orange-50',
  medium: 'text-amber-600 bg-amber-50',
  low:    'text-slate-600 bg-slate-100',
}

type MReq = Record<string, unknown>

export default function TenantMaintenancePage(): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const { page, setPage, setPerPage } = usePagination()
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError } = useTenantMaintenanceList({ status: statusFilter || undefined, page })
  const { mutate: submit, isPending: submitting } = useSubmitMaintenance()

  const form = useForm<TenantMaintenanceSchema>({ resolver: zodResolver(tenantMaintenanceSchema) })

  const handleSubmit = (values: TenantMaintenanceSchema) => {
    submit(values as unknown as Parameters<typeof submit>[0], {
      onSuccess: () => { success('Request submitted'); setCreateOpen(false); form.reset() },
      onError: (err) => toastError(err, 'Failed to submit request'),
    })
  }

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as MReq[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<MReq>[] = [
    {
      key: 'title',
      header: 'Issue',
      accessor: (row) => (
        <div>
          <p className="text-xs font-medium text-foreground">{row.title as string}</p>
          <p className="text-xs text-muted-foreground truncate max-w-xs">{row.description as string}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      accessor: (row) => <span className="text-xs text-muted-foreground capitalize">{String(row.category).replace(/_/g, ' ')}</span>,
    },
    {
      key: 'priority',
      header: 'Priority',
      accessor: (row) => row.priority ? (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[row.priority as string] ?? ''}`}>
          {row.priority as string}
        </span>
      ) : null,
    },
    { key: 'status', header: 'Status', accessor: (row) => <StatusBadge status={row.status as string} /> },
    {
      key: 'created_at',
      header: 'Submitted',
      accessor: (row) => <span className="text-xs text-muted-foreground">{formatRelative(row.created_at as string)}</span>,
    },
  ]

  return (
    <>
      <Helmet><title>Maintenance Requests — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader title="Maintenance Requests" subtitle="Report issues with your room or facilities."
          actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> New Request</Button>}
        />
        <FilterBar>
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} placeholder="All" className="w-36 text-xs"
            options={[{ value: '', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' }, { value: 'resolved', label: 'Resolved' }]} />
        </FilterBar>
        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading} error={isError ? 'Failed to load.' : null}
          emptyTitle="No maintenance requests" emptyDescription="Submit a request if something needs attention."
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Maintenance requests" />
      </div>
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); form.reset() }} title="Report an Issue" size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={submitting} onClick={form.handleSubmit(handleSubmit)}>Submit Request</Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField label="Issue Title" htmlFor="title" error={form.formState.errors.title?.message} required>
            <Input id="title" placeholder="e.g. AC not cooling" error={!!form.formState.errors.title} {...form.register('title')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Category" htmlFor="category" error={form.formState.errors.category?.message} required>
              <Select id="category" error={!!form.formState.errors.category} placeholder="Select category" {...form.register('category')}
                options={['electrical','plumbing','furniture','appliance','cleaning','pest_control','other'].map(v => ({ value: v, label: v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }))} />
            </FormField>
            <FormField label="Priority" htmlFor="priority">
              <Select id="priority" placeholder="Select priority" {...form.register('priority')}
                options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
            </FormField>
          </div>
          <FormField label="Description" htmlFor="description" error={form.formState.errors.description?.message} required>
            <Textarea id="description" rows={4} placeholder="Describe the issue in detail…" error={!!form.formState.errors.description} {...form.register('description')} />
          </FormField>
        </form>
      </Modal>
    </>
  )
}