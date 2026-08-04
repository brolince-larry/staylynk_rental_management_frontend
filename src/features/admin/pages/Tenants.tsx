// src/features/admin/pages/Tenants.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus, CheckCircle, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTenants, useCreateTenant, useUpdateTenant, useVerifyTenant, useUpdateTenantStatus } from '../hooks'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef, type SortState } from '@/components/tables/DataTable'
import { SearchInput, FilterBar, Select, Modal, Button, ConfirmDialog, FormField, Input, Textarea, ToastContainer } from '@/components/forms'
import { SmartImage } from '@/components/media'
import { PageHeader, StatusBadge } from '@/components/ui'
import { formatRelative } from '@/utils/format'
import { tenantSchema, type TenantSchema } from '@/schemas'
import { roomsApi } from '@/api/rooms'
import { tenantsApi, type TenantPayload } from '@/api/tenants'
import { useAuthStore } from '@/store/auth.store'

type Tenant = Record<string, unknown>
type OptionRecord = Record<string, unknown>

export default function TenantsPage(): React.ReactElement {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<SortState>({ column: 'created_at', direction: 'desc' })
  const [createOpen, setCreateOpen] = useState(false)
  const [editTenant, setEditTenant] = useState<Tenant | null>(null)
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null)
  const [credentialsModal, setCredentialsModal] = useState<{ name: string; email: string; password: string } | null>(null)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()
  const qc = useQueryClient()
  const currentProperty = useAuthStore((state) => state.user?.current_property)
  const currentPropertyId = currentProperty?.uuid

  const { data, isLoading, isError } = useTenants({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    property_id: currentPropertyId,
    page, per_page: perPage,
  })

  const { mutate: createTenant, isPending: creating } = useCreateTenant()
  const { mutate: updateTenant, isPending: updating } = useUpdateTenant(String(editTenant?.id ?? ""))
  const { mutate: verifyTenant } = useVerifyTenant()
  const { mutate: updateStatus } = useUpdateTenantStatus()
  const { mutate: deleteTenant, isPending: deleting } = useMutation({
    mutationFn: tenantsApi.delete,
    onSuccess: () => {
      success('Tenant deleted')
      setDeletingTenant(null)
      void qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'tenant-form', 'rooms'] })
    },
    onError: (err) => toastError(err, 'Failed to delete tenant'),
  })

  const form = useForm<TenantSchema>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { lease_status: 'pending' },
  })
  const editForm = useForm<TenantSchema>({ resolver: zodResolver(tenantSchema) })
  const roomsQuery = useQuery({
    queryKey: ['admin', 'tenant-form', 'rooms', currentPropertyId, editTenant?.id ?? 'create'],
    queryFn: () => roomsApi.list({ property_id: currentPropertyId, per_page: 100 }).then((r) => r.data),
    enabled: (createOpen || Boolean(editTenant)) && Boolean(currentPropertyId),
  })

  const availableRooms = roomOptions(paginatedData(roomsQuery.data), editTenant)

  const closeCreate = () => {
    setCreateOpen(false)
    form.reset({ property_id: currentPropertyId, lease_status: 'pending', move_in_date: todayIso() })
  }

  const openEdit = (tenant: Tenant) => {
    const profile = tenant.profile as Record<string, unknown> | null
    const room = tenantRoom(tenant)
    setEditTenant(tenant)
    editForm.reset({
      name: String(tenant.name ?? ''),
      email: String(tenant.email ?? ''),
      phone_number: String(profile?.phone_number ?? tenant.phone ?? ''),
      alternative_phone: String(profile?.alternative_phone ?? ''),
      property_id: currentPropertyId,
      room_id: room?.id || undefined,
      move_in_date: cleanString(profile?.move_in_date) ?? todayIso(),
      lease_status: leaseStatus(tenant),
      emergency_name: String(profile?.emergency_name ?? ''),
      emergency_phone: String(profile?.emergency_phone ?? ''),
      emergency_relationship: String(profile?.emergency_relationship ?? ''),
      notes: String(tenant.notes ?? profile?.notes ?? ''),
    })
  }

  const closeEdit = () => {
    setEditTenant(null)
    editForm.reset()
  }

  const handleCreate = (values: TenantSchema) => {
    if (!currentPropertyId) {
      form.setError('property_id', { message: 'Select a property first' })
      return
    }
    if (!values.room_id) {
      form.setError('room_id', { message: 'Vacant room is required' })
      return
    }
    createTenant(buildTenantPayload({
      ...values,
      property_id: currentPropertyId,
      move_in_date: values.move_in_date || todayIso(),
      lease_status: values.lease_status ?? 'pending',
    }), {
      onSuccess: (response) => {
        const data = response.data as { generated_password?: string } | undefined
        const generatedPassword = data?.generated_password
        success('Tenant created')
        closeCreate()
        if (generatedPassword) {
          setCredentialsModal({ name: values.name, email: values.email, password: generatedPassword })
        }
      },
      onError: (err) => toastError(err, 'Failed to create tenant'),
    })
  }

  const handleUpdate = (values: TenantSchema) => {
    if (!editTenant) return
    updateTenant(buildTenantPayload(values, { includeProperty: false, includeLease: true }), {
      onSuccess: () => {
        success('Tenant updated')
        closeEdit()
      },
      onError: (err) => toastError(err, 'Failed to update tenant'),
    })
  }

  const list = data as Record<string, unknown> | undefined
  const rows = (list?.data as Tenant[]) ?? []
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<Tenant>[] = [
    {
      key: 'name',
      header: 'Tenant',
      sortable: true,
      accessor: (row) => {
        const profile = row.profile as Record<string, unknown> | null
        const media = row.avatar_image ?? row.media ?? profile?.avatar_image ?? profile?.media
        const legacyPhoto = profile?.profile_photo_url ?? row.avatar_url

        return (
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
              {media || legacyPhoto ? (
                <SmartImage
                  src={(media as Record<string, unknown>) ?? (legacyPhoto as string)}
                  fallback={legacyPhoto as string | undefined}
                  alt={`${String(row.name ?? 'Tenant')} profile photo`}
                  usage="card"
                  aspectRatio="1 / 1"
                  sizes="28px"
                  wrapperClassName="h-7 w-7 rounded-full"
                  className="rounded-full object-cover"
                />
              ) : (
                String(row.name ?? '?')[0].toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-foreground">{row.name as string}</p>
                {Boolean(row.is_verified) && <CheckCircle className="h-3 w-3 text-emerald-500" aria-label="Verified" />}
              </div>
              <p className="text-xs text-muted-foreground">{row.email as string}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'phone',
      header: 'Phone',
      accessor: (row) => {
        const p = row.profile as Record<string, string> | null
        return <span className="text-xs text-muted-foreground">{p?.phone_number ?? (row.phone as string) ?? '—'}</span>
      },
    },
    {
      key: 'room',
      header: 'Current Room',
      accessor: (row) => {
        const room = tenantRoom(row)
        const property = tenantProperty(row)
        return room ? (
          <div>
            <p className="text-xs font-medium text-foreground">Room {String(room.room_number ?? room.id)}</p>
            <p className="text-xs text-muted-foreground">{String(property?.name ?? '—')}</p>
          </div>
        ) : <span className="text-xs text-muted-foreground">No active lease</span>
      },
    },
    {
      key: 'lease_status',
      header: 'Lease',
      accessor: (row) => <StatusBadge status={leaseStatus(row)} />,
    },
    {
      key: 'profile_status',
      header: 'Profile',
      accessor: (row) => <StatusBadge status={tenantStatus(row)} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      accessor: (row) => <StatusBadge status={row.status as string} />,
    },
    {
      key: 'created_at',
      header: 'Joined',
      sortable: true,
      accessor: (row) => (
        <span className="text-xs text-muted-foreground">{formatRelative(row.created_at as string)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 'w-28',
      accessor: (row) => {
        const id = row.id as number
        const status = tenantStatus(row)
        return (
          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            {!row.is_verified && (
              <button
                onClick={() => verifyTenant(id, { onSuccess: () => success('Tenant verified') })}
                className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                Verify
              </button>
            )}
            <button
              onClick={() => openEdit(row)}
              className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
            >
              Edit
            </button>
            <button
              onClick={() => setDeletingTenant(row)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
            {status === 'active' ? (
              <button
                onClick={() => updateStatus({ id, status: 'inactive' }, { onSuccess: () => success('Tenant deactivated') })}
                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => updateStatus({ id, status: 'active' }, { onSuccess: () => success('Tenant activated') })}
                className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                Activate
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Tenants — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Tenants"
          subtitle="Manage all tenant accounts across your properties."
          actions={
            <Button onClick={() => {
              form.reset({ property_id: currentPropertyId, move_in_date: todayIso(), lease_status: 'pending' })
              setCreateOpen(true)
            }} disabled={!currentPropertyId}>
              <Plus className="h-3.5 w-3.5" /> Add Tenant
            </Button>
          }
        />
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email…" className="w-64" />
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            placeholder="All statuses"
            className="w-36 text-xs"
            options={[
              { value: '', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />
        </FilterBar>
        <DataTable
          columns={columns} data={rows} keyField="id"
          loading={isLoading} error={isError ? 'Failed to load tenants.' : null}
          emptyTitle="No tenants found"
          emptyDescription="Add your first tenant to get started."
          sort={sort} onSort={(col, dir) => { setSort({ column: col, direction: dir }); setPage(1) }}
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage}
          caption="Tenants list"
        />
      </div>
      <Modal open={createOpen} onClose={closeCreate}
        title="Add New Tenant" size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeCreate}>Cancel</Button>
            <Button loading={creating} onClick={form.handleSubmit(handleCreate)}>Create Tenant</Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(handleCreate)} className="grid grid-cols-2 gap-4">
          <FormField label="Full Name" htmlFor="name" error={form.formState.errors.name?.message} required>
            <Input id="name" placeholder="John Doe" error={!!form.formState.errors.name} {...form.register('name')} />
          </FormField>
          <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message} required>
            <Input id="email" type="email" placeholder="john@example.com" error={!!form.formState.errors.email} {...form.register('email')} />
          </FormField>
          <FormField label="Phone Number" htmlFor="phone_number" error={form.formState.errors.phone_number?.message} required>
            <Input id="phone_number" placeholder="+254700000000" error={!!form.formState.errors.phone_number} {...form.register('phone_number')} />
          </FormField>
          <FormField label="Vacant Room" htmlFor="room_id" error={form.formState.errors.room_id?.message} required>
            <Select
              id="room_id"
              value={form.watch('room_id') ? String(form.watch('room_id')) : ''}
              disabled={roomsQuery.isLoading || !currentPropertyId}
              error={!!form.formState.errors.room_id}
              onChange={(event) => form.setValue('room_id', event.target.value, { shouldDirty: true, shouldValidate: true })}
              options={[
                { value: '', label: roomsQuery.isLoading ? 'Loading rooms...' : 'Select vacant room' },
                ...availableRooms.map((room) => ({
                  value: String(room.id),
                  label: roomLabel(room),
                })),
              ]}
            />
          </FormField>
          <FormField label="Move-In Date" htmlFor="move_in_date" error={form.formState.errors.move_in_date?.message} required>
            <Input id="move_in_date" type="date" error={!!form.formState.errors.move_in_date} {...form.register('move_in_date')} />
          </FormField>
          <FormField label="First Payment Due Date" htmlFor="first_payment_due_date" hint="Rent + deposit invoice. Later payments follow the standard billing cycle.">
            <Input id="first_payment_due_date" type="date" {...form.register('first_payment_due_date')} />
          </FormField>
          <FormField label="Lease Status" htmlFor="lease_status" error={form.formState.errors.lease_status?.message}>
            <Select id="lease_status" error={!!form.formState.errors.lease_status} {...form.register('lease_status')}
              options={[{ value:'pending', label:'Pending' }, { value:'active', label:'Active' }]} />
          </FormField>
          <FormField label="Emergency Contact Name" htmlFor="emergency_name">
            <Input id="emergency_name" placeholder="Jane Doe" {...form.register('emergency_name')} />
          </FormField>
          <FormField label="Emergency Phone" htmlFor="emergency_phone">
            <Input id="emergency_phone" placeholder="+254700000001" {...form.register('emergency_phone')} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Notes" htmlFor="notes">
              <Textarea id="notes" rows={2} placeholder="Optional notes…" {...form.register('notes')} />
            </FormField>
          </div>
        </form>
      </Modal>
      <Modal open={!!editTenant} onClose={closeEdit}
        title="Edit Tenant" size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeEdit}>Cancel</Button>
            <Button loading={updating} onClick={editForm.handleSubmit(handleUpdate)}>Save Changes</Button>
          </>
        }
      >
        <form onSubmit={editForm.handleSubmit(handleUpdate)} className="grid grid-cols-2 gap-4">
          <FormField label="Full Name" htmlFor="edit-name" error={editForm.formState.errors.name?.message} required>
            <Input id="edit-name" placeholder="John Doe" error={!!editForm.formState.errors.name} {...editForm.register('name')} />
          </FormField>
          <FormField label="Email" htmlFor="edit-email" error={editForm.formState.errors.email?.message} required>
            <Input id="edit-email" type="email" placeholder="john@example.com" error={!!editForm.formState.errors.email} {...editForm.register('email')} />
          </FormField>
          <FormField label="Phone Number" htmlFor="edit-phone_number" error={editForm.formState.errors.phone_number?.message} required>
            <Input id="edit-phone_number" placeholder="+254700000000" error={!!editForm.formState.errors.phone_number} {...editForm.register('phone_number')} />
          </FormField>
          <FormField
            label="Move To Room"
            htmlFor="edit-room_id"
            hint={currentRoomLabel(editTenant) ? `Current room: ${currentRoomLabel(editTenant)}` : 'Leave blank to keep current room.'}
          >
            <Select
              id="edit-room_id"
              value={editForm.watch('room_id') ? String(editForm.watch('room_id')) : ''}
              disabled={roomsQuery.isLoading || !currentPropertyId}
              onChange={(event) => editForm.setValue('room_id', event.target.value, { shouldDirty: true, shouldValidate: true })}
              options={[
                { value: '', label: roomsQuery.isLoading ? 'Loading rooms...' : 'Keep current room' },
                ...availableRooms.map((room) => ({
                  value: String(room.id),
                  label: roomLabel(room),
                })),
              ]}
            />
          </FormField>
          <FormField label="Move-In Date" htmlFor="edit-move_in_date" error={editForm.formState.errors.move_in_date?.message}>
            <Input id="edit-move_in_date" type="date" error={!!editForm.formState.errors.move_in_date} {...editForm.register('move_in_date')} />
          </FormField>
          <FormField label="Lease Status" htmlFor="edit-lease_status" error={editForm.formState.errors.lease_status?.message}>
            <Select id="edit-lease_status" error={!!editForm.formState.errors.lease_status} {...editForm.register('lease_status')}
              options={[{ value:'pending', label:'Pending' }, { value:'active', label:'Active' }, { value:'expired', label:'Expired' }, { value:'terminated', label:'Terminated' }]} />
          </FormField>
          <FormField label="Alternative Phone" htmlFor="edit-alternative_phone">
            <Input id="edit-alternative_phone" placeholder="+254700000002" {...editForm.register('alternative_phone')} />
          </FormField>
          <FormField label="Emergency Contact Name" htmlFor="edit-emergency_name">
            <Input id="edit-emergency_name" placeholder="Jane Doe" {...editForm.register('emergency_name')} />
          </FormField>
          <FormField label="Emergency Phone" htmlFor="edit-emergency_phone">
            <Input id="edit-emergency_phone" placeholder="+254700000001" {...editForm.register('emergency_phone')} />
          </FormField>
          <FormField label="Emergency Relationship" htmlFor="edit-emergency_relationship">
            <Input id="edit-emergency_relationship" placeholder="Sibling" {...editForm.register('emergency_relationship')} />
          </FormField>
          <div className="col-span-2">
            <FormField label="Notes" htmlFor="edit-notes">
              <Textarea id="edit-notes" rows={2} placeholder="Optional notes..." {...editForm.register('notes')} />
            </FormField>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deletingTenant}
        onClose={() => setDeletingTenant(null)}
        onConfirm={() => deletingTenant && deleteTenant(String(deletingTenant.id))}
        loading={deleting}
        title="Delete Tenant"
        description={`This permanently removes ${deletingTenant?.name ?? 'this tenant'} and their tenant profile. This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
      />
      <Modal
        open={!!credentialsModal}
        onClose={() => setCredentialsModal(null)}
        title="Tenant created"
        size="sm"
        footer={
          <Button onClick={() => setCredentialsModal(null)}>Done</Button>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Share these login details with <strong>{credentialsModal?.name}</strong>. They will be required to set a new
          password the first time they log in — this password will not be shown again.
        </p>
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Email</span>
            <code className="rounded bg-background px-2 py-1 font-mono text-xs">{credentialsModal?.email}</code>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Password</span>
            <code className="rounded bg-background px-2 py-1 font-mono text-xs">{credentialsModal?.password}</code>
          </div>
        </div>
      </Modal>
    </>
  )
}

function paginatedData(value: unknown): OptionRecord[] {
  const data = (value as { data?: unknown } | undefined)?.data
  return Array.isArray(data) ? data as OptionRecord[] : []
}

function cleanString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim()
  return text ? text : undefined
}

function roomLabel(room: OptionRecord): string {
  const roomNumber = String(room.room_number ?? room.number ?? room.uuid ?? room.id ?? 'Room')
  const rent = room.monthly_rent ? ` · ${room.monthly_rent}` : ''
  return `Room ${roomNumber}${rent}`
}

function currentRoomLabel(tenant: Tenant | null): string {
  const room = tenant ? tenantRoom(tenant) : null
  const property = tenant ? tenantProperty(tenant) : null
  const roomNumber = cleanString(room?.room_number)
  if (!roomNumber) return ''
  const propertyName = cleanString(property?.name)
  return propertyName ? `Room ${roomNumber}, ${propertyName}` : `Room ${roomNumber}`
}

function buildTenantPayload(
  values: TenantSchema,
  options: { includeProperty?: boolean; includeLease?: boolean } = { includeProperty: true, includeLease: true },
): TenantPayload {
  const payload: TenantPayload = {
    name: values.name,
    email: values.email,
    phone_number: values.phone_number,
  }
  const alternativePhone = cleanString(values.alternative_phone)
  const password = cleanString(values.password)
  const emergencyName = cleanString(values.emergency_name)
  const emergencyPhone = cleanString(values.emergency_phone)
  const emergencyRelationship = cleanString(values.emergency_relationship)
  const notes = cleanString(values.notes)

  if (alternativePhone) payload.alternative_phone = alternativePhone
  if (password) payload.password = password
  if (emergencyName) payload.emergency_name = emergencyName
  if (emergencyPhone) payload.emergency_phone = emergencyPhone
  if (emergencyRelationship) payload.emergency_relationship = emergencyRelationship
  if (notes) payload.notes = notes

  if (options.includeProperty !== false && values.property_id) payload.property_id = values.property_id
  if (options.includeLease !== false) {
    if (values.room_id) payload.room_id = values.room_id
    if (values.move_in_date) payload.move_in_date = values.move_in_date
    if (values.first_payment_due_date) payload.first_payment_due_date = values.first_payment_due_date
    payload.lease_status = values.lease_status ?? 'pending'
  }

  return payload
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function tenantRoom(tenant: Tenant): Record<string, unknown> | null {
  const direct = tenant.room as Record<string, unknown> | null
  const lease = tenant.active_lease as Record<string, unknown> | null
  return direct ?? (lease?.room as Record<string, unknown> | null) ?? null
}

function tenantProperty(tenant: Tenant): Record<string, unknown> | null {
  const direct = tenant.property as Record<string, unknown> | null
  const lease = tenant.active_lease as Record<string, unknown> | null
  return direct ?? (lease?.property as Record<string, unknown> | null) ?? null
}

// Deactivate/Activate writes to the tenant profile's status (via
// PATCH .../status), not the user account's own status — so the toggle
// must read the same field it mutates, matching the "Profile" column.
function tenantStatus(tenant: Tenant): string {
  const profile = tenant.profile as Record<string, unknown> | null
  return String(profile?.status ?? tenant.status ?? 'pending')
}

function leaseStatus(tenant: Tenant): TenantSchema['lease_status'] {
  const profile = tenant.profile as Record<string, unknown> | null
  const lease = tenant.active_lease as Record<string, unknown> | null
  const value = String(profile?.lease_status ?? lease?.status ?? 'pending')
  return ['pending', 'active', 'expired', 'terminated', 'cancelled'].includes(value)
    ? value as TenantSchema['lease_status']
    : 'pending'
}

function roomOptions(rooms: OptionRecord[], tenant: Tenant | null): OptionRecord[] {
  const current = tenant ? tenantRoom(tenant) : null
  const currentId = current?.id ?? ''
  const available = rooms.filter((room) => String(room.status ?? '').toLowerCase() === 'available' || String(room.id) === currentId)
  if (!current || available.some((room) => String(room.id) === currentId)) return available
  return [...available, current]
}
