import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { CheckCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { tenantsApi, type TenantPayload } from '@/api/tenants'
import { roomsApi } from '@/api/rooms'
import { tenantSchema, type TenantSchema } from '@/schemas'
import { useAuthStore } from '@/store/auth.store'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef, type SortState } from '@/components/tables/DataTable'
import { Button, ConfirmDialog, FilterBar, FormField, Input, Modal, SearchInput, Select, Textarea, ToastContainer } from '@/components/forms'
import { MediaUploadField, SmartImage } from '@/components/media'
import { entityIdFromResponse, mediaService } from '@/services/media'
import { PageHeader, StatusBadge } from '@/components/ui'
import { formatRelative } from '@/utils/format'

type Tenant = Record<string, unknown>

export default function ManagerTenants(): React.ReactElement {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<SortState>({ column: 'created_at', direction: 'desc' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editTenant, setEditTenant] = useState<Tenant | null>(null)
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null)
  const [profilePhotoFiles, setProfilePhotoFiles] = useState<File[]>([])
  const [mediaProgress, setMediaProgress] = useState<number | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, warning, dismiss } = useToast()
  const qc = useQueryClient()
  const currentProperty = useAuthStore((state) => state.user?.current_property)
  const currentPropertyId = currentProperty?.uuid

  const params = {
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    page,
    per_page: perPage,
  }
  const { data, isLoading, isError } = useQuery({
    queryKey: ['manager', 'tenants', params],
    queryFn: () => tenantsApi.managerList(params).then((r) => r.data),
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  })
  const roomsQuery = useQuery({
    queryKey: ['manager', 'tenant-form', 'available-rooms', currentPropertyId],
    queryFn: () => roomsApi.managerList({ per_page: 100 }).then((r) => r.data),
    enabled: modalOpen && Boolean(currentPropertyId),
  })
  const availableRooms = roomOptions(paginatedData(roomsQuery.data), editTenant)

  const { mutate: createTenant, isPending: creating } = useMutation({
    mutationFn: tenantsApi.managerCreate,
    onSuccess: (response, values) => {
      void (async () => {
        const tenantId = entityIdFromResponse(response.data)
        try {
          setUploadingMedia(true)
          if (tenantId && profilePhotoFiles.length > 0) {
            await mediaService.uploadFilesForEntity({
              files: profilePhotoFiles,
              media_type: 'tenant_profile_photo',
              entity_type: 'tenant',
              entity_id: tenantId,
              is_public: false,
              cover_index: 0,
              alt_text: `${values.name} profile photo`,
            }, ({ progress }) => setMediaProgress(progress))
          }
          success(profilePhotoFiles.length > 0 ? 'Tenant created. Profile photo is processing.' : 'Tenant created')
          closeModal()
        } catch (err) {
          toastError(err, 'Tenant created, but profile photo upload failed')
        } finally {
          setUploadingMedia(false)
          setMediaProgress(null)
        }
      })()
      void qc.invalidateQueries({ queryKey: ['manager', 'tenants'] })
    },
    onError: (err) => toastError(err, 'Failed to create tenant'),
  })
  const { mutate: updateTenant, isPending: updating } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TenantPayload> }) => tenantsApi.managerUpdate(id, data),
    onSuccess: (_, variables) => {
      void (async () => {
        try {
          setUploadingMedia(true)
          if (profilePhotoFiles.length > 0) {
            await mediaService.uploadFilesForEntity({
              files: profilePhotoFiles,
              media_type: 'tenant_profile_photo',
              entity_type: 'tenant',
              entity_id: variables.id,
              is_public: false,
              cover_index: 0,
              alt_text: `${variables.data.name ?? 'Tenant'} profile photo`,
            }, ({ progress }) => setMediaProgress(progress))
          }
          success(profilePhotoFiles.length > 0 ? 'Tenant updated. Profile photo is processing.' : 'Tenant updated')
          closeModal()
        } catch (err) {
          toastError(err, 'Tenant updated, but profile photo upload failed')
        } finally {
          setUploadingMedia(false)
          setMediaProgress(null)
        }
      })()
      void qc.invalidateQueries({ queryKey: ['manager', 'tenants'] })
    },
    onError: (err) => toastError(err, 'Failed to update tenant'),
  })
  const { mutate: deleteTenant, isPending: deleting } = useMutation({
    mutationFn: tenantsApi.managerDelete,
    onSuccess: () => {
      success('Tenant removed')
      setDeletingTenant(null)
      void qc.invalidateQueries({ queryKey: ['manager', 'tenants'] })
      void qc.invalidateQueries({ queryKey: ['manager', 'tenant-form', 'available-rooms'] })
    },
    onError: (err) => toastError(err, 'Failed to remove tenant'),
  })
  const { mutate: verifyTenant } = useMutation({
    mutationFn: tenantsApi.managerVerify,
    onSuccess: () => {
      success('Tenant verified')
      void qc.invalidateQueries({ queryKey: ['manager', 'tenants'] })
    },
    onError: (err) => toastError(err, 'Failed to verify tenant'),
  })
  const { mutate: updateTenantStatus } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => tenantsApi.managerUpdateStatus(id, status),
    onSuccess: (_, variables) => {
      success(variables.status === 'active' ? 'Tenant activated' : 'Tenant suspended')
      void qc.invalidateQueries({ queryKey: ['manager', 'tenants'] })
    },
    onError: (err) => toastError(err, 'Failed to update tenant status'),
  })

  const form = useForm<TenantSchema>({
    resolver: zodResolver(tenantSchema),
    defaultValues: { lease_status: 'pending' },
  })
  const selectedRoomId = useWatch({ control: form.control, name: 'room_id' })

  useEffect(() => {
    if (!editTenant) return
    const profile = editTenant.profile as Record<string, unknown> | null
    const room = tenantRoom(editTenant)
    form.reset({
      name: String(editTenant.name ?? ''),
      email: String(editTenant.email ?? ''),
      phone_number: String(profile?.phone_number ?? editTenant.phone ?? ''),
      alternative_phone: String(profile?.alternative_phone ?? ''),
      room_id: room?.id || undefined,
      move_in_date: cleanString(profile?.move_in_date) ?? todayIso(),
      lease_status: leaseStatus(editTenant),
      emergency_name: String(profile?.emergency_name ?? ''),
      emergency_phone: String(profile?.emergency_phone ?? ''),
      emergency_relationship: String(profile?.emergency_relationship ?? ''),
      notes: String(editTenant.notes ?? profile?.notes ?? ''),
    })
  }, [editTenant, form])

  const openCreate = () => {
    setEditTenant(null)
    form.reset({
      move_in_date: todayIso(),
      lease_status: 'pending',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditTenant(null)
    setProfilePhotoFiles([])
    setMediaProgress(null)
    form.reset()
  }

  const saveTenant = (values: TenantSchema) => {
    if (editTenant) {
      updateTenant({ id: editTenant.id as number, data: buildTenantPayload(values, { includeProperty: false, includeLease: true }) })
      return
    }
    if (!currentPropertyId) {
      warning('Select or create a current property', 'A current property is required before creating tenants.')
      return
    }
    if (!values.room_id) {
      form.setError('room_id', { message: 'Available room is required' })
      return
    }
    createTenant(buildTenantPayload({
      ...values,
      lease_status: values.lease_status ?? 'pending',
      move_in_date: values.move_in_date || todayIso(),
    }, { includeProperty: false, includeLease: true }))
  }

  const rows = (data?.data as Tenant[] | undefined) ?? []
  const meta = data?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<Tenant>[] = [
    {
      key: 'name', header: 'Tenant', sortable: true,
      accessor: (row) => {
        const profile = row.profile as Record<string, unknown> | null
        const media = row.avatar_image ?? row.media ?? profile?.avatar_image ?? profile?.media
        const legacyPhoto = profile?.profile_photo_url ?? row.avatar_url

        return (
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
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
              {Boolean(row.is_verified) && <CheckCircle className="h-3 w-3 text-emerald-500" />}
            </div>
            <p className="text-xs text-muted-foreground">{row.email as string}</p>
          </div>
        </div>
        )
      },
    },
    {
      key: 'phone', header: 'Phone',
      accessor: (row) => {
        const profile = row.profile as Record<string, string> | null
        return <span className="text-xs text-muted-foreground">{profile?.phone_number ?? (row.phone as string) ?? '-'}</span>
      },
    },
    {
      key: 'room', header: 'Current Room',
      accessor: (row) => {
        const lease = row.active_lease as Record<string, unknown> | null
        const room = tenantRoom(row)
        const property = tenantProperty(row)
        return room ? (
          <div>
            <p className="text-xs font-medium text-foreground">Room {String(room.room_number ?? room.id)}</p>
            <p className="text-xs text-muted-foreground">{String(property?.name ?? lease?.property_name ?? '—')}</p>
          </div>
        ) : <span className="text-xs text-muted-foreground">No active lease</span>
      },
    },
    { key: 'lease_status', header: 'Lease', accessor: (row) => <StatusBadge status={leaseStatus(row)} /> },
    { key: 'profile_status', header: 'Profile', accessor: (row) => <StatusBadge status={tenantStatus(row)} /> },
    { key: 'status', header: 'Status', sortable: true, accessor: (row) => <StatusBadge status={row.status as string} /> },
    { key: 'created_at', header: 'Joined', sortable: true, accessor: (row) => <span className="text-xs text-muted-foreground">{formatRelative(row.created_at as string)}</span> },
    {
      key: 'actions', header: '', width: 'w-24',
      accessor: (row) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {!row.is_verified && (
            <button onClick={() => verifyTenant(row.id as number)} className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50">
              Verify
            </button>
          )}
          <button onClick={() => { setEditTenant(row); setModalOpen(true) }} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10">
            <Pencil className="h-3 w-3" /> Edit
          </button>
          {tenantStatus(row) === 'active' ? (
            <button onClick={() => updateTenantStatus({ id: row.id as number, status: 'inactive' })} className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50">
              Deactivate
            </button>
          ) : (
            <button onClick={() => updateTenantStatus({ id: row.id as number, status: 'active' })} className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50">
              Activate
            </button>
          )}
          <button onClick={() => setDeletingTenant(row)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <Helmet><title>Tenants - StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader title="Tenants" subtitle={`Create and update tenants for ${currentProperty?.name ?? 'the selected property'}.`} actions={<Button onClick={openCreate} disabled={!currentPropertyId}><Plus className="h-3.5 w-3.5" /> Add Tenant</Button>} />
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email..." className="w-64" />
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="w-36 text-xs"
            options={[{ value:'', label:'All statuses' }, { value:'active', label:'Active' }, { value:'inactive', label:'Inactive' }, { value:'pending', label:'Pending' }, { value:'evicted', label:'Evicted' }, { value:'blacklisted', label:'Blacklisted' }]} />
        </FilterBar>
        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading} error={isError ? 'Failed to load tenants.' : null}
          emptyTitle="No tenants found" sort={sort} onSort={(col, dir) => { setSort({ column: col, direction: dir }); setPage(1) }}
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Manager tenants" />
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editTenant ? 'Update Tenant' : 'Add Tenant'} size="lg"
        footer={<><Button variant="outline" onClick={closeModal}>Cancel</Button><Button loading={creating || updating || uploadingMedia} onClick={form.handleSubmit(saveTenant)}>{editTenant ? 'Save Changes' : 'Create Tenant'}</Button></>}
      >
        <form onSubmit={form.handleSubmit(saveTenant)} className="grid grid-cols-2 gap-4">
          <FormField label="Full Name" htmlFor="m-name" error={form.formState.errors.name?.message} required>
            <Input id="m-name" error={!!form.formState.errors.name} {...form.register('name')} />
          </FormField>
          <FormField label="Email" htmlFor="m-email" error={form.formState.errors.email?.message} required>
            <Input id="m-email" type="email" error={!!form.formState.errors.email} {...form.register('email')} />
          </FormField>
          <FormField label="Phone Number" htmlFor="m-phone" error={form.formState.errors.phone_number?.message} required>
            <Input id="m-phone" error={!!form.formState.errors.phone_number} {...form.register('phone_number')} />
          </FormField>
          {!editTenant && (
            <FormField label="Password" htmlFor="m-password" error={form.formState.errors.password?.message} hint="Leave blank to auto-generate">
              <Input id="m-password" type="password" error={!!form.formState.errors.password} {...form.register('password')} />
            </FormField>
          )}
          <FormField label={editTenant ? 'Move To Room' : 'Available Room'} htmlFor="m-room" error={form.formState.errors.room_id?.message} required={!editTenant}>
            <Select
              id="m-room"
              value={selectedRoomId ? String(selectedRoomId) : ''}
              disabled={roomsQuery.isLoading || !currentPropertyId}
              error={!!form.formState.errors.room_id}
              onChange={(event) => form.setValue('room_id', event.target.value, { shouldDirty: true, shouldValidate: true })}
              options={[
                { value: '', label: roomsQuery.isLoading ? 'Loading rooms...' : 'Select available room' },
                ...availableRooms.map((room) => ({
                  value: String(room.id),
                  label: roomLabel(room),
                })),
              ]}
            />
          </FormField>
          <FormField label="Move-In Date" htmlFor="m-move-in" error={form.formState.errors.move_in_date?.message} required={!editTenant}>
            <Input id="m-move-in" type="date" error={!!form.formState.errors.move_in_date} {...form.register('move_in_date')} />
          </FormField>
          <FormField label="Lease Status" htmlFor="m-lease-status" error={form.formState.errors.lease_status?.message}>
            <Select id="m-lease-status" error={!!form.formState.errors.lease_status} {...form.register('lease_status')}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'active', label: 'Active' },
                { value: 'expired', label: 'Expired' },
                { value: 'terminated', label: 'Terminated' },
              ]} />
          </FormField>
          <FormField label="Emergency Contact Name" htmlFor="m-emergency-name">
            <Input id="m-emergency-name" {...form.register('emergency_name')} />
          </FormField>
          <FormField label="Emergency Phone" htmlFor="m-emergency-phone">
            <Input id="m-emergency-phone" {...form.register('emergency_phone')} />
          </FormField>
          <FormField label="Notes" htmlFor="m-notes" className="col-span-2">
            <Textarea id="m-notes" rows={2} {...form.register('notes')} />
          </FormField>
          <div className="col-span-2">
            <MediaUploadField
              label="Profile Photo"
              mediaType="tenant_profile_photo"
              files={profilePhotoFiles}
              onChange={setProfilePhotoFiles}
              hint="PNG, JPG, or WebP up to 2MB."
              progress={uploadingMedia ? mediaProgress : null}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deletingTenant}
        onClose={() => setDeletingTenant(null)}
        onConfirm={() => deletingTenant && deleteTenant(deletingTenant.id as number)}
        loading={deleting}
        title="Remove Tenant"
        description={`This permanently removes ${deletingTenant?.name ?? 'this tenant'} and their tenant profile. This cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
      />
    </>
  )
}

function paginatedData(value: unknown): Tenant[] {
  const data = (value as { data?: unknown } | undefined)?.data
  return Array.isArray(data) ? data as Tenant[] : []
}

function cleanString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim()
  return text ? text : undefined
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function roomLabel(room: Tenant): string {
  const roomNumber = String(room.room_number ?? room.number ?? room.id ?? 'Room')
  const rent = room.monthly_rent ? ` · ${String(room.monthly_rent)}` : ''
  return `Room ${roomNumber}${rent}`
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

// The Deactivate/Activate action writes to the tenant profile's status
// (via PATCH .../status), not the user account's own status — so the
// toggle must read the same field it mutates, matching the "Profile" column.
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

function roomOptions(rooms: Tenant[], tenant: Tenant | null): Tenant[] {
  const current = tenant ? tenantRoom(tenant) : null
  const currentId = current?.id ?? ''
  const available = rooms.filter((room) => String(room.status ?? '').toLowerCase() === 'available' || String(room.id) === currentId)
  if (!current || available.some((room) => String(room.id) === currentId)) return available
  return [...available, current]
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
  const password = cleanString(values.password)
  const alternativePhone = cleanString(values.alternative_phone)
  const emergencyName = cleanString(values.emergency_name)
  const emergencyPhone = cleanString(values.emergency_phone)
  const emergencyRelationship = cleanString(values.emergency_relationship)
  const notes = cleanString(values.notes)

  if (options.includeProperty !== false && values.property_id) payload.property_id = values.property_id
  if (options.includeLease !== false) {
    if (values.room_id) payload.room_id = values.room_id
    if (values.move_in_date) payload.move_in_date = values.move_in_date
    payload.lease_status = values.lease_status ?? 'pending'
  }
  if (password) payload.password = password
  if (alternativePhone) payload.alternative_phone = alternativePhone
  if (emergencyName) payload.emergency_name = emergencyName
  if (emergencyPhone) payload.emergency_phone = emergencyPhone
  if (emergencyRelationship) payload.emergency_relationship = emergencyRelationship
  if (notes) payload.notes = notes

  return payload
}
