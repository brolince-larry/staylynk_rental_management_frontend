// src/features/superadmin/pages/Users.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSAUsers, useSAUserStats, useDeleteSAUser, useRevokeSAUserSessions, useCreateSAAdmin } from '../hooks/useUsers'
import { useOrganizations } from '../hooks/useOrganizations'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { SearchInput, FilterBar, Select, ConfirmDialog, ToastContainer, Button, Modal, FormField, Input } from '@/components/forms'
import { PageHeader, StatusBadge, StatCard } from '@/components/ui'
import { formatRelative } from '@/utils/format'
import { Plus, Users as UsersIcon, Shield, UserCheck, Building2 } from 'lucide-react'

type SAUser = Record<string, unknown>

const createAdminSchema = z.object({
  org_id:   z.string().min(1, 'Select an organisation'),
  name:     z.string().min(2, 'Name is required').max(150),
  email:    z.string().email('Invalid email'),
  phone:    z.string().max(20).optional(),
  password: z.string().min(8, 'At least 8 characters'),
  status:   z.enum(['active', 'suspended']),
})
type CreateAdminForm = z.infer<typeof createAdminSchema>

export default function Users(): React.ReactElement {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError } = useSAUsers({
    search: debouncedSearch || undefined,
    role:   'admin',
    status: status || undefined,
    page, per_page: perPage,
  })
  const { data: statsData } = useSAUserStats()
  const { data: orgData, isLoading: orgLoading } = useOrganizations({ per_page: 100 })
  const { mutate: createAdmin, isPending: creating } = useCreateSAAdmin()
  const { mutate: deleteUser,   isPending: deleting  } = useDeleteSAUser()
  const { mutate: revokeSessions } = useRevokeSAUserSessions()
  const form = useForm<CreateAdminForm>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: { org_id: '', status: 'active' },
  })

  const list  = data as Record<string, unknown> | undefined
  const rows  = ((list?.data as SAUser[]) ?? []).filter((user) => user.role === 'admin')
  const meta  = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined
  const stats   = statsData as Record<string, unknown> | undefined
  const byRole  = stats?.by_role as Record<string, number> | undefined
  const organizations = orgRows(orgData)

  const adminCount   = byRole?.admin   ?? byRole?.Admin   ?? 0
  const managerCount = byRole?.manager ?? byRole?.Manager ?? 0
  const tenantCount  = byRole?.tenant  ?? byRole?.Tenant  ?? 0

  const ROLE_COLORS: Record<string, string> = {
    admin:      'text-blue-600 bg-blue-50',
  }

  const closeCreate = () => {
    setCreateOpen(false)
    form.reset({ org_id: '', status: 'active' })
  }

  const handleCreate = (values: CreateAdminForm) => {
    createAdmin({ ...values, role: 'admin' }, {
      onSuccess: () => { success('Admin created'); closeCreate() },
      onError: (err) => toastError(err, 'Failed to create admin'),
    })
  }

  const columns: ColumnDef<SAUser>[] = [
    {
      key: 'name', header: 'Admin',
      accessor: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {String(row.name ?? '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">{row.name as string}</p>
            <p className="text-xs text-muted-foreground">{row.email as string}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone', header: 'Phone',
      accessor: (row) => (
        <span className="text-xs text-muted-foreground">{(row.phone as string) || '—'}</span>
      ),
    },
    {
      key: 'role', header: 'Role',
      accessor: (row) => {
        const r = row.role as string
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[r] ?? 'text-foreground bg-muted'}`}>
            {r}
          </span>
        )
      },
    },
    {
      key: 'organisation', header: 'Organisation',
      accessor: (row) => {
        const org = (row.organisation ?? row.org) as Record<string, string> | null
        return <span className="text-xs text-muted-foreground">{org?.name ?? '—'}</span>
      },
    },
    {
      key: 'status', header: 'Status',
      accessor: (row) => <StatusBadge status={row.status as string} />,
    },
    {
      key: 'last_login_at', header: 'Last Login',
      accessor: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.last_login_at ? formatRelative(row.last_login_at as string) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions', header: '', width: 'w-36',
      accessor: (row) => {
        const id = row.id as string
        return (
          <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => revokeSessions(id, { onSuccess: () => success('Sessions revoked') })}
              className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            >
              Revoke
            </button>
            <button
              onClick={() => setDeleteId(id)}
              className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              Delete
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Organization Admins — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Organization Admins"
          subtitle="Admin accounts for each organisation."
          actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Admin</Button>}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard label="All Platform Users" value={stats?.total as number ?? '—'} icon={<UsersIcon className="h-4 w-4 text-violet-600" />} iconBg="bg-violet-100" />
          <StatCard label="Admins / Owners"    value={adminCount}                    icon={<Shield className="h-4 w-4 text-blue-600" />}       iconBg="bg-blue-100" />
          <StatCard label="Managers"           value={managerCount}                  icon={<Building2 className="h-4 w-4 text-amber-600" />}   iconBg="bg-amber-100" />
          <StatCard label="Tenants"            value={tenantCount}                   icon={<UserCheck className="h-4 w-4 text-emerald-600" />}  iconBg="bg-emerald-100" />
        </div>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email…" className="w-64" />
          <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} placeholder="All statuses" className="w-32 text-xs"
            options={[{ value:'', label:'All statuses' }, { value:'active', label:'Active' }, { value:'suspended', label:'Suspended' }]} />
        </FilterBar>
        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading}
          error={isError ? 'Failed to load admins.' : null}
          emptyTitle="No admins found"
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Organization admins list" />
      </div>
      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Add Organization Admin"
        footer={
          <>
            <Button variant="outline" onClick={closeCreate}>Cancel</Button>
            <Button loading={creating} onClick={form.handleSubmit(handleCreate)}>Create Admin</Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(handleCreate)} className="grid grid-cols-2 gap-4">
          <FormField label="Organisation" htmlFor="sa-org" error={form.formState.errors.org_id?.message} required className="col-span-2">
            <Select
              id="sa-org"
              error={!!form.formState.errors.org_id}
              disabled={orgLoading}
              {...form.register('org_id')}
              options={[
                { value: '', label: orgLoading ? 'Loading organisations...' : 'Select organisation' },
                ...organizations.map((org) => ({ value: String(org.id), label: String(org.name ?? `#${org.id}`) })),
              ]}
            />
          </FormField>
          <FormField label="Full Name" htmlFor="sa-name" error={form.formState.errors.name?.message} required>
            <Input id="sa-name" placeholder="Owner Admin" error={!!form.formState.errors.name} {...form.register('name')} />
          </FormField>
          <FormField label="Email" htmlFor="sa-email" error={form.formState.errors.email?.message} required>
            <Input id="sa-email" type="email" placeholder="owner@example.com" error={!!form.formState.errors.email} {...form.register('email')} />
          </FormField>
          <FormField label="Phone" htmlFor="sa-phone" error={form.formState.errors.phone?.message}>
            <Input id="sa-phone" placeholder="+254700000000" {...form.register('phone')} />
          </FormField>
          <FormField label="Password" htmlFor="sa-password" error={form.formState.errors.password?.message} required>
            <Input id="sa-password" type="password" placeholder="Password1" error={!!form.formState.errors.password} {...form.register('password')} />
          </FormField>
          <FormField label="Status" htmlFor="sa-status" error={form.formState.errors.status?.message} required>
            <Select id="sa-status" error={!!form.formState.errors.status} {...form.register('status')}
              options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} />
          </FormField>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return
          deleteUser(deleteId, {
            onSuccess: () => { success('Admin deleted'); setDeleteId(null) },
            onError: (err) => toastError(err, 'Failed to delete admin'),
          })
        }}
        title="Delete Admin"
        description="This permanently deletes the admin account. This cannot be undone."
        confirmLabel="Delete" variant="destructive" loading={deleting}
      />
    </>
  )
}

function orgRows(value: unknown): Array<Record<string, unknown>> {
  const data = (value as { data?: unknown } | undefined)?.data
  return Array.isArray(data) ? data as Array<Record<string, unknown>> : []
}
