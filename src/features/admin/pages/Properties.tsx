// src/features/admin/pages/Properties.tsx
import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import { Building2, CheckCircle, Eye, Loader2, MapPin, MoreVertical, Navigation, Pencil, Plus, Trash2, Wrench, X } from 'lucide-react'
import { useForm, type Resolver, type UseFormReturn, type Path } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { isApiError } from '@/utils/errors'
import { useProperties, useCreateProperty, useUpdateProperty, useDeleteProperty, useUpdatePropertyStatus } from '../hooks/useProperties'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef, type SortState } from '@/components/tables/DataTable'
import { SearchInput, FilterBar, Select, Modal, Button, FormField, Input, Textarea, ConfirmDialog, ToastContainer } from '@/components/forms'
import { MediaManager, MediaUploadField, SmartImage } from '@/components/media'
import { mediaService, type MediaItem } from '@/services/media'
import { PageHeader, StatusBadge, ProgressBar } from '@/components/ui'
import { propertySchema, type PropertySchema } from '@/schemas/property.schema'
import { HOUSE_TYPE_OPTIONS } from '@/api/listings'
import { propertiesApi, type Property, type PropertyInput } from '@/api/properties'
import { formatDate } from '@/utils/format'
import { PropertyVideoManager } from '../components/PropertyVideoManager'

function applyApiErrors(err: unknown, setError: UseFormReturn<PropertySchema>['setError']): void {
  if (!isApiError(err) || !err.errors || Array.isArray(err.errors)) return
  for (const [path, messages] of Object.entries(err.errors)) {
    const message = Array.isArray(messages) ? messages[0] : String(messages)
    if (message) setError(path as Path<PropertySchema>, { message, type: 'server' })
  }
}

const AMENITY_OPTIONS = [
  'WiFi',
  'Parking',
  'Security',
  'Water Available',
  'Furnished',
  'Generator',
  'CCTV',
  'Gym',
  'Swimming Pool',
]

const propertyFormDefaults: Partial<PropertySchema> = {
  status: 'active',
  country: 'KE',
  total_floors: 1,
  listing: {
    house_type: 'apartment',
    amenities: [],
    water_available: false,
    internet_available: false,
    parking_available: false,
    security_level: 'standard',
    is_available: true,
  },
}

export default function Properties(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [createOpen, setCreateOpen] = useState(() => searchParams.get('create') === '1')
  const [viewProperty, setViewProperty] = useState<Property | null>(null)
  const [editProperty, setEditProperty] = useState<Property | null>(null)
  const [deleteProperty, setDeleteProperty] = useState<Property | null>(null)
  const [statusAction, setStatusAction] = useState<{ property: Property; status: string } | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ id: string; row: Property; top: number; right: number } | null>(null)
  const [propertyMedia, setPropertyMedia] = useState<MediaItem[]>([])
  const [coverFiles, setCoverFiles] = useState<File[]>([])
  const [galleryFiles, setGalleryFiles] = useState<File[]>([])
  const [mediaProgress, setMediaProgress] = useState<number | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [sort, setSort]       = useState<SortState>({ column: 'name', direction: 'asc' })
  const [bankOverride, setBankOverride] = useState({ bank_name: '', account_name: '', account_number: '', branch: '', swift_code: '', instructions: '' })
  const [savingBankOverride, setSavingBankOverride] = useState(false)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError, refetch } = useProperties({
    search:    debouncedSearch || undefined,
    status:    status || undefined,
    sort:      sort.column,
    direction: sort.direction,
    page, per_page: perPage,
  })

  const { mutate: create, isPending: creating } = useCreateProperty()
  const { mutate: updateProperty, isPending: updating } = useUpdateProperty(editProperty?.id ?? '')
  const { mutate: deletePropertyMutation, isPending: deleting } = useDeleteProperty()
  const { mutate: updateStatus, isPending: changingStatus } = useUpdatePropertyStatus(statusAction?.property.id ?? '')

  const form = useForm<PropertySchema>({
    resolver: zodResolver(propertySchema) as Resolver<PropertySchema>,
    defaultValues: propertyFormDefaults,
  })
  const editForm = useForm<PropertySchema>({
    resolver: zodResolver(propertySchema) as Resolver<PropertySchema>,
    defaultValues: propertyFormDefaults,
  })

  useEffect(() => {
    if (searchParams.get('create') !== '1') return
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!menuAnchor) return
    const close = () => setMenuAnchor(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('mousedown', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('mousedown', close)
    }
  }, [menuAnchor])

  useEffect(() => {
    if (!editProperty) return
    const listing = editProperty.listing
    editForm.reset({
      name: String(editProperty.name ?? ''),
      address: String(editProperty.address ?? ''),
      city: String(editProperty.city ?? ''),
      county: String(editProperty.county ?? ''),
      state: String(editProperty.state ?? ''),
      country: String(editProperty.country ?? 'KE'),
      phone: String(editProperty.phone ?? ''),
      email: String(editProperty.email ?? ''),
      description: String(editProperty.description ?? ''),
      total_floors: Number(editProperty.total_floors ?? 1),
      status: (editProperty.status as PropertySchema['status']) ?? 'active',
      latitude: (editProperty as { latitude?: number | null }).latitude ?? undefined,
      longitude: (editProperty as { longitude?: number | null }).longitude ?? undefined,
      listing: {
        house_type: listing?.house_type ?? 'apartment',
        rent_min: listing?.rent_min ?? undefined,
        rent_max: listing?.rent_max ?? undefined,
        bedrooms_min: listing?.bedrooms_min ?? undefined,
        bedrooms_max: listing?.bedrooms_max ?? undefined,
        bathrooms_min: listing?.bathrooms_min ?? undefined,
        bathrooms_max: listing?.bathrooms_max ?? undefined,
        neighbourhood: listing?.neighbourhood ?? '',
        amenities: listing?.amenities ?? [],
        water_available: listing?.water_available ?? false,
        internet_available: listing?.internet_available ?? false,
        parking_available: listing?.parking_available ?? false,
        security_level: listing?.security_level ?? 'standard',
        is_available: listing?.is_available ?? true,
      },
    })

    // Populate bank override from property settings
    const ba = (editProperty.settings as Record<string, unknown> | null | undefined)?.bank_account as Record<string, string> | null | undefined
    setBankOverride({
      bank_name:      ba?.bank_name      ?? '',
      account_name:   ba?.account_name   ?? '',
      account_number: ba?.account_number ?? '',
      branch:         ba?.branch         ?? '',
      swift_code:     ba?.swift_code     ?? '',
      instructions:   ba?.instructions   ?? '',
    })
  }, [editForm, editProperty])

  const resetCreateForm = () => {
    setCreateOpen(false)
    setCoverFiles([])
    setGalleryFiles([])
    setPropertyMedia([])
    setMediaProgress(null)
    form.reset(propertyFormDefaults)
  }

  const resetEditForm = () => {
    setEditProperty(null)
    setCoverFiles([])
    setGalleryFiles([])
    setMediaProgress(null)
    editForm.reset(propertyFormDefaults)
  }

  const uploadPropertyMedia = async (values: PropertySchema) => {
    if (coverFiles.length > 0) {
      await mediaService.uploadFilesForEntity({
        files: coverFiles,
        media_type: 'property_image',
        entity_type: 'property',
        entity_id: 'current',
        is_public: true,
        cover_index: 0,
        alt_text: `${values.name} cover image`,
      }, ({ progress }) => setMediaProgress(progress))
    }

    if (galleryFiles.length > 0) {
      await mediaService.uploadFilesForEntity({
        files: galleryFiles,
        media_type: 'property_image',
        entity_type: 'property',
        entity_id: 'current',
        is_public: true,
        cover_index: coverFiles.length > 0 ? undefined : 0,
        alt_text: values.name,
      }, ({ progress }) => setMediaProgress(progress))
    }
  }

  const handleCreate = (values: PropertySchema) => {
    const payload = buildPropertyPayload(values)
    create(payload, {
      onSuccess: () => {
        void (async () => {
          try {
            setUploadingMedia(true)
            await uploadPropertyMedia(values)
            success(galleryFiles.length || coverFiles.length ? 'Property created. Images are processing.' : 'Property created')
            resetCreateForm()
          } catch (err) {
            toastError(err, 'Property created, but media upload failed')
          } finally {
            setUploadingMedia(false)
            setMediaProgress(null)
          }
        })()
      },
      onError: (err) => {
        applyApiErrors(err, form.setError)
        toastError(err, 'Failed to create property')
      },
    })
  }

  const handleUpdate = (values: PropertySchema) => {
    if (!editProperty) return

    const payload = buildPropertyPayload(values)
    updateProperty(payload, {
      onSuccess: () => {
        void (async () => {
          try {
            setUploadingMedia(true)
            await uploadPropertyMedia(values)
            success(galleryFiles.length || coverFiles.length ? 'Property updated. Images are processing.' : 'Property updated')
            resetEditForm()
          } catch (err) {
            toastError(err, 'Property updated, but media upload failed')
          } finally {
            setUploadingMedia(false)
            setMediaProgress(null)
          }
        })()
      },
      onError: (err) => {
        applyApiErrors(err, editForm.setError)
        toastError(err, 'Failed to update property')
      },
    })
  }

  const handleSaveBankOverride = () => {
    const id = editProperty?.id
    if (!id) return
    setSavingBankOverride(true)
    void import('@/api/client').then(({ apiPatch }) =>
      apiPatch(`/admin/properties/${id}`, { settings: { bank_account: bankOverride } })
        .then(() => success('Bank account override saved'))
        .catch((err) => toastError(err, 'Failed to save bank override'))
        .finally(() => setSavingBankOverride(false))
    )
  }

  const refreshEditedProperty = async () => {
    if (!editProperty?.id) {
      void refetch()
      return
    }

    try {
      const response = await propertiesApi.get(editProperty.id)
      setEditProperty(response.data)
      setPropertyMedia(extractMediaItems(response.data))
    } finally {
      void refetch()
    }
  }

  const rows = data?.data ?? []
  const meta = data?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<Property>[] = [
    {
      key: 'name', header: 'Property', sortable: true,
      accessor: (row) => (
        <div className="flex items-center gap-3">
          <SmartImage
            src={getPropertyImage(row)}
            alt={String(row.name ?? 'Property')}
            usage="card"
            aspectRatio="1 / 1"
            sizes="48px"
            wrapperClassName="h-12 w-12 shrink-0 overflow-hidden rounded-md"
            className="object-cover"
          />
          <div>
            <p className="text-xs font-semibold text-foreground">{row.name as string}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{row.city as string}{row.state ? `, ${row.state as string}` : ''}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'total_rooms', header: 'Rooms', align: 'right',
      accessor: (row) => <span className="text-xs font-medium">{row.total_rooms as number ?? 0}</span>,
    },
    {
      key: 'occupancy_rate', header: 'Occupancy',
      accessor: (row) => {
        const rate = row.occupancy_rate as number ?? 0
        return (
          <div className="min-w-[80px]">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{row.occupied_rooms as number ?? 0}/{row.total_rooms as number ?? 0}</span>
              <span className="font-medium">{rate.toFixed(0)}%</span>
            </div>
            <ProgressBar value={rate}
              color={rate >= 90 ? 'bg-emerald-500' : rate >= 70 ? 'bg-primary' : rate >= 50 ? 'bg-amber-500' : 'bg-red-400'}
            />
          </div>
        )
      },
    },
    {
      key: 'active_leases', header: 'Active Leases', align: 'right',
      accessor: (row) => <span className="text-xs">{row.active_leases as number ?? 0}</span>,
    },
    { key: 'status', header: 'Status', sortable: true, accessor: (row) => <StatusBadge status={row.status as string} /> },
    {
      key: 'created_at', header: 'Added',
      accessor: (row) => <span className="text-xs text-muted-foreground">{formatDate(row.created_at as string)}</span>,
    },
    {
      key: 'actions', header: 'Actions', width: 'w-24', align: 'right',
      accessor: (row) => {
        const id = String(row.id)
        const isOpen = menuAnchor?.id === id
        return (
          <div className="inline-flex justify-end" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                if (isOpen) { setMenuAnchor(null); return }
                const rect = e.currentTarget.getBoundingClientRect()
                // Flyout beside the row (to the left of the button, level with it) instead
                // of dropping below — keeps it anchored to the row that was clicked and
                // clear of whatever sits underneath. Clamped so it never runs off-screen.
                const MENU_WIDTH = 192
                const MENU_EST_HEIGHT = 190
                const right = Math.min(
                  window.innerWidth - rect.left + 8,
                  window.innerWidth - MENU_WIDTH - 8,
                )
                const top = Math.min(
                  Math.max(rect.top - 4, 8),
                  window.innerHeight - MENU_EST_HEIGHT - 8,
                )
                setMenuAnchor({ id, row, top, right })
              }}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-border transition-colors ${isOpen ? 'bg-muted text-foreground' : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              aria-label={`Actions for ${String(row.name ?? 'property')}`}
              aria-haspopup="menu"
              aria-expanded={isOpen}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Properties — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {/* Fixed-position action dropdown — escapes table overflow clipping */}
      {menuAnchor && (() => {
        const row = menuAnchor.row
        const s = row.status as string
        const close = () => setMenuAnchor(null)
        return (
          <div
            role="menu"
            style={{ position: 'fixed', top: menuAnchor.top, right: menuAnchor.right, zIndex: 200 }}
            className="min-w-48 overflow-hidden rounded-xl border border-border bg-popover py-1 text-left shadow-2xl ring-1 ring-black/5"
            onMouseDown={e => e.stopPropagation()}
          >
            <button type="button" role="menuitem" onClick={() => { close(); setViewProperty(row) }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-foreground transition-colors hover:bg-muted">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" /> View details
            </button>
            <button type="button" role="menuitem" onClick={() => { close(); setPropertyMedia(extractMediaItems(row)); setEditProperty(row) }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-foreground transition-colors hover:bg-muted">
              <Pencil className="h-3.5 w-3.5 text-primary" /> Edit property
            </button>
            <div className="my-1 h-px bg-border" />
            {s === 'active' ? (
              <button type="button" role="menuitem" onClick={() => { close(); setStatusAction({ property: row, status: 'maintenance' }) }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-amber-700 transition-colors hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30">
                <Wrench className="h-3.5 w-3.5" /> Set to maintenance
              </button>
            ) : (
              <button type="button" role="menuitem" onClick={() => { close(); setStatusAction({ property: row, status: 'active' }) }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30">
                <CheckCircle className="h-3.5 w-3.5" /> Activate property
              </button>
            )}
            <div className="my-1 h-px bg-border" />
            <button type="button" role="menuitem" onClick={() => { close(); setDeleteProperty(row) }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
              <Trash2 className="h-3.5 w-3.5" /> Delete property
            </button>
          </div>
        )
      })()}
      <div className="p-6">
        <PageHeader
          title="Properties"
          subtitle="All properties across your organisation."
          actions={<Button onClick={() => { form.reset(propertyFormDefaults); setCreateOpen(true) }}><Plus className="h-3.5 w-3.5" /> Add Property</Button>}
        />
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, city…" className="w-64" />
          <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} placeholder="All statuses" className="w-36 text-xs"
            options={[{ value:'', label:'All' }, { value:'active', label:'Active' }, { value:'inactive', label:'Inactive' }, { value:'maintenance', label:'Maintenance' }]} />
        </FilterBar>
        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading}
          error={isError ? 'Failed to load properties.' : null}
          emptyTitle="No properties yet" emptyDescription="Add your first property to get started."
          sort={sort} onSort={(col, dir) => { setSort({ column: col, direction: dir }); setPage(1) }}
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Properties list"
        />
      </div>

      <Modal open={createOpen} onClose={resetCreateForm}
        title="Add New Property" size="drawer"
        footer={
          <>
            <Button variant="outline" onClick={resetCreateForm}>Cancel</Button>
            <Button loading={creating || uploadingMedia} onClick={form.handleSubmit(handleCreate)}>Create Property</Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(handleCreate)} className="grid grid-cols-2 gap-4">
          <FormField label="Property Name" htmlFor="pname" error={form.formState.errors.name?.message} required className="col-span-2">
            <Input id="pname" placeholder="Green View Hostel" error={!!form.formState.errors.name} {...form.register('name')} />
            <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-400/90">
              <svg className="mt-px h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              Use the <strong className="font-bold text-amber-300">exact name your property is registered under on Google Maps</strong> (e.g. "Orient Palace Hostel"). This name is used in all map searches, directions, and nearby place links shown to house hunters.
            </p>
          </FormField>
          <FormField label="Address" htmlFor="paddress" error={form.formState.errors.address?.message} required className="col-span-2">
            <Input id="paddress" placeholder="123 Main St" error={!!form.formState.errors.address} {...form.register('address')} />
          </FormField>
          <FormField label="County" htmlFor="pcounty" hint="e.g. Nairobi, Kirinyaga">
            <Input id="pcounty" placeholder="Nairobi" {...form.register('county')} />
          </FormField>
          <FormField label="City / Town" htmlFor="pcity" error={form.formState.errors.city?.message} required>
            <Input id="pcity" placeholder="Nairobi" error={!!form.formState.errors.city} {...form.register('city')} />
          </FormField>
          <FormField label="Country Code" htmlFor="pcountry" hint="2-letter code e.g. KE">
            <Input id="pcountry" placeholder="KE" maxLength={2} {...form.register('country')} />
          </FormField>
          <FormField label="Phone" htmlFor="pphone">
            <Input id="pphone" placeholder="+254700000000" {...form.register('phone')} />
          </FormField>
          <FormField label="Email" htmlFor="pemail" error={form.formState.errors.email?.message}>
            <Input id="pemail" type="email" placeholder="info@property.com" error={!!form.formState.errors.email} {...form.register('email')} />
          </FormField>
          <FormField label="Status" htmlFor="pstatus">
            <Select id="pstatus" {...form.register('status')}
              options={[{ value:'active', label:'Active' }, { value:'inactive', label:'Inactive' }, { value:'maintenance', label:'Maintenance' }]} />
          </FormField>
          <FormField label="Total Floors" htmlFor="pfloors">
            <Input id="pfloors" type="number" min={1} {...form.register('total_floors')} />
          </FormField>
          <FormField label="Description" htmlFor="pdescription" className="col-span-2">
            <Textarea id="pdescription" rows={3} placeholder="Short property description" {...form.register('description')} />
          </FormField>
          <MapLocationPicker form={form} idPrefix="p" />
          <ListingFields form={form} idPrefix="p" />
          <div className="col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MediaUploadField
              label="Cover Image"
              mediaType="property_image"
              files={coverFiles}
              onChange={setCoverFiles}
              hint="PNG, JPG, or WebP up to 5MB."
              progress={uploadingMedia && coverFiles.length > 0 ? mediaProgress : null}
            />
            <MediaUploadField
              label="Property Images"
              mediaType="property_image"
              files={galleryFiles}
              onChange={setGalleryFiles}
              multiple
              hint="Upload up to 25 images. First image becomes the cover."
              progress={uploadingMedia && galleryFiles.length > 0 ? mediaProgress : null}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={!!viewProperty}
        onClose={() => setViewProperty(null)}
        title="Property Information"
        size="md"
        footer={<Button variant="outline" onClick={() => setViewProperty(null)}>Close</Button>}
      >
        {viewProperty && (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold text-foreground">{String(viewProperty.name ?? 'Property')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {[viewProperty.address, viewProperty.city, viewProperty.county, viewProperty.state, viewProperty.country].filter(Boolean).join(', ')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['Status', viewProperty.status, 'bg-gradient-to-br from-violet-50 to-purple-100/60 dark:from-violet-950/30 dark:to-purple-950/20 border-violet-200/60 dark:border-violet-800/30'],
                ['Rooms', viewProperty.total_rooms ?? 0, 'bg-gradient-to-br from-blue-50 to-sky-100/60 dark:from-blue-950/30 dark:to-sky-950/20 border-blue-200/60 dark:border-blue-800/30'],
                ['Occupied', viewProperty.occupied_rooms ?? 0, 'bg-gradient-to-br from-amber-50 to-orange-100/60 dark:from-amber-950/30 dark:to-orange-950/20 border-amber-200/60 dark:border-amber-800/30'],
                ['Active Leases', viewProperty.active_leases ?? 0, 'bg-gradient-to-br from-emerald-50 to-teal-100/60 dark:from-emerald-950/30 dark:to-teal-950/20 border-emerald-200/60 dark:border-emerald-800/30'],
                ['Occupancy', `${Number(viewProperty.occupancy_rate ?? 0).toFixed(0)}%`, 'bg-gradient-to-br from-rose-50 to-pink-100/60 dark:from-rose-950/30 dark:to-pink-950/20 border-rose-200/60 dark:border-rose-800/30'],
                ['Added', viewProperty.created_at ? formatDate(String(viewProperty.created_at)) : '—', 'bg-gradient-to-br from-slate-50 to-gray-100/60 dark:from-slate-900/60 dark:to-gray-900/40 border-slate-200/60 dark:border-slate-700/30'],
                ['Phone', viewProperty.phone ?? '—', 'bg-gradient-to-br from-cyan-50 to-teal-100/60 dark:from-cyan-950/30 dark:to-teal-950/20 border-cyan-200/60 dark:border-cyan-800/30'],
                ['Email', viewProperty.email ?? '—', 'bg-gradient-to-br from-indigo-50 to-violet-100/60 dark:from-indigo-950/30 dark:to-violet-950/20 border-indigo-200/60 dark:border-indigo-800/30'],
              ] as [string, unknown, string][]).map(([label, value, cls]) => (
                <div key={String(label)} className={`rounded-xl border p-3 ${cls}`}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{String(label)}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{String(value ?? '—')}</p>
                </div>
              ))}
            </div>
            {viewProperty.description ? (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="mt-1 text-sm text-foreground">{String(viewProperty.description)}</p>
              </div>
            ) : null}
            {viewProperty.listing ? (
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Listing</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{viewProperty.listing.title || viewProperty.name}</p>
                  </div>
                  <StatusBadge status={viewProperty.listing.is_published ? 'published' : 'unpublished'} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {([
                    ['Type', houseTypeLabel(viewProperty.listing.house_type), 'bg-gradient-to-br from-violet-50/80 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/10'],
                    ['Rent', formatRentRange(viewProperty.listing), 'bg-gradient-to-br from-emerald-50/80 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/10'],
                    ['Bedrooms', formatRange(viewProperty.listing.bedrooms_min, viewProperty.listing.bedrooms_max), 'bg-gradient-to-br from-blue-50/80 to-sky-50/50 dark:from-blue-950/20 dark:to-sky-950/10'],
                    ['Bathrooms', formatRange(viewProperty.listing.bathrooms_min, viewProperty.listing.bathrooms_max), 'bg-gradient-to-br from-cyan-50/80 to-teal-50/50 dark:from-cyan-950/20 dark:to-teal-950/10'],
                    ['Neighbourhood', viewProperty.listing.neighbourhood ?? '—', 'bg-gradient-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10'],
                    ['Verification', viewProperty.listing.verification_status, 'bg-gradient-to-br from-rose-50/80 to-pink-50/50 dark:from-rose-950/20 dark:to-pink-950/10'],
                    ['Available', viewProperty.listing.is_available ? 'Yes' : 'No', 'bg-gradient-to-br from-indigo-50/80 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/10'],
                    ['Water', viewProperty.listing.water_available ? 'Yes' : 'No', 'bg-gradient-to-br from-slate-50/80 to-gray-50/50 dark:from-slate-900/40 dark:to-gray-900/20'],
                  ] as [string, unknown, string][]).map(([label, value, cls]) => (
                    <div key={String(label)} className={`rounded-lg p-2 ${cls}`}>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{String(label)}</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{String(value ?? '—')}</p>
                    </div>
                  ))}
                </div>
                {viewProperty.listing.amenities.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {viewProperty.listing.amenities.map((amenity) => (
                      <span key={amenity} className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{amenity}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <Modal open={!!editProperty} onClose={resetEditForm}
        title="Update Property" size="drawer"
        footer={
          <>
            <Button variant="outline" onClick={resetEditForm}>Cancel</Button>
            <Button loading={updating || uploadingMedia} onClick={editForm.handleSubmit(handleUpdate)}>Save Changes</Button>
          </>
        }
      >
        <form onSubmit={editForm.handleSubmit(handleUpdate)} className="grid grid-cols-2 gap-4">
          <FormField label="Property Name" htmlFor="epname" error={editForm.formState.errors.name?.message} required className="col-span-2">
            <Input id="epname" placeholder="Green View Hostel" error={!!editForm.formState.errors.name} {...editForm.register('name')} />
            <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-400/90">
              <svg className="mt-px h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              Use the <strong className="font-bold text-amber-300">exact name your property is registered under on Google Maps</strong> (e.g. "Orient Palace Hostel"). This name is used in all map searches, directions, and nearby place links shown to house hunters.
            </p>
          </FormField>
          <FormField label="Address" htmlFor="epaddress" error={editForm.formState.errors.address?.message} required className="col-span-2">
            <Input id="epaddress" placeholder="123 Main St" error={!!editForm.formState.errors.address} {...editForm.register('address')} />
          </FormField>
          <FormField label="County" htmlFor="epcounty" hint="e.g. Nairobi, Kirinyaga">
            <Input id="epcounty" placeholder="Nairobi" {...editForm.register('county')} />
          </FormField>
          <FormField label="City / Town" htmlFor="epcity" error={editForm.formState.errors.city?.message} required>
            <Input id="epcity" placeholder="Nairobi" error={!!editForm.formState.errors.city} {...editForm.register('city')} />
          </FormField>
          <FormField label="Country Code" htmlFor="epcountry" hint="2-letter code e.g. KE">
            <Input id="epcountry" placeholder="KE" maxLength={2} {...editForm.register('country')} />
          </FormField>
          <FormField label="Phone" htmlFor="epphone">
            <Input id="epphone" placeholder="+254700000000" {...editForm.register('phone')} />
          </FormField>
          <FormField label="Email" htmlFor="epemail" error={editForm.formState.errors.email?.message}>
            <Input id="epemail" type="email" placeholder="info@property.com" error={!!editForm.formState.errors.email} {...editForm.register('email')} />
          </FormField>
          <FormField label="Status" htmlFor="epstatus">
            <Select id="epstatus" {...editForm.register('status')}
              options={[{ value:'active', label:'Active' }, { value:'inactive', label:'Inactive' }, { value:'maintenance', label:'Maintenance' }]} />
          </FormField>
          <FormField label="Total Floors" htmlFor="epfloors">
            <Input id="epfloors" type="number" min={1} {...editForm.register('total_floors')} />
          </FormField>
          <FormField label="Description" htmlFor="epdescription" className="col-span-2">
            <Textarea id="epdescription" rows={3} placeholder="Short property description" {...editForm.register('description')} />
          </FormField>
          <MapLocationPicker form={editForm} idPrefix="e" />
          <ListingFields form={editForm} idPrefix="e" />
          <div className="col-span-2">
            <p className="mb-2 text-xs font-medium text-foreground">Current Images</p>
            <MediaManager
              items={propertyMedia}
              mediaType="property_image"
              onChange={setPropertyMedia}
              onRefresh={() => void refreshEditedProperty()}
              emptyLabel="No property images returned for this property."
            />
          </div>
          <div className="col-span-2">
            {editProperty?.id ? <PropertyVideoManager propertyId={editProperty.id} /> : null}
          </div>
          <div className="col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MediaUploadField
              label="New Cover Image"
              mediaType="property_image"
              files={coverFiles}
              onChange={setCoverFiles}
              hint="Optional. Replaces the cover image after upload."
              progress={uploadingMedia && coverFiles.length > 0 ? mediaProgress : null}
            />
            <MediaUploadField
              label="Add Property Images"
              mediaType="property_image"
              files={galleryFiles}
              onChange={setGalleryFiles}
              multiple
              hint="Upload up to 25 more images."
              progress={uploadingMedia && galleryFiles.length > 0 ? mediaProgress : null}
            />
          </div>
          {/* Bank Account Override */}
          <div className="col-span-2 mt-2 rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Bank Account Override</p>
                <p className="text-xs text-muted-foreground">Overrides the organisation-level bank account for this property.</p>
              </div>
              <Button size="sm" variant="outline" loading={savingBankOverride} onClick={handleSaveBankOverride}>
                Save Override
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Bank Name',       key: 'bank_name',       placeholder: 'e.g. Equity Bank Kenya' },
                { label: 'Account Name',    key: 'account_name',    placeholder: 'e.g. Green View Properties' },
                { label: 'Account Number',  key: 'account_number',  placeholder: 'e.g. 0123456789' },
                { label: 'Branch',          key: 'branch',          placeholder: 'e.g. Westlands' },
                { label: 'SWIFT / BIC',     key: 'swift_code',      placeholder: 'e.g. EQBLKENAXXX' },
              ].map(({ label, key, placeholder }) => (
                <FormField key={key} label={label} htmlFor={`bo-${key}`}>
                  <Input
                    id={`bo-${key}`}
                    placeholder={placeholder}
                    value={bankOverride[key as keyof typeof bankOverride]}
                    onChange={(e) => setBankOverride((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </FormField>
              ))}
              <FormField label="Transfer Instructions" htmlFor="bo-instructions" className="col-span-2">
                <Textarea
                  id="bo-instructions"
                  rows={2}
                  placeholder="Shown to tenants when paying this property via bank transfer."
                  value={bankOverride.instructions}
                  onChange={(e) => setBankOverride((prev) => ({ ...prev, instructions: e.target.value }))}
                />
              </FormField>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!statusAction}
        onClose={() => setStatusAction(null)}
        onConfirm={() => {
          if (!statusAction) return
          updateStatus(statusAction.status, {
            onSuccess: () => {
              success(statusAction.status === 'maintenance' ? 'Property set to maintenance' : 'Property activated')
              setStatusAction(null)
            },
            onError: (err) => toastError(err, 'Failed to update property status'),
          })
        }}
        title="Update Property Status"
        description={`Set ${String(statusAction?.property.name ?? 'this property')} to ${statusAction?.status ?? 'new status'}?`}
        confirmLabel={statusAction?.status === 'maintenance' ? 'Set Maintenance' : 'Activate'}
        loading={changingStatus}
      />

      <ConfirmDialog
        open={!!deleteProperty}
        onClose={() => setDeleteProperty(null)}
        onConfirm={() => {
          const id = deleteProperty?.id
          if (!id) return
          deletePropertyMutation(id, {
            onSuccess: () => {
              success('Property deleted')
              setDeleteProperty(null)
            },
            onError: (err) => toastError(err, 'Failed to delete property'),
          })
        }}
        title="Delete Property"
        description={`Delete ${String(deleteProperty?.name ?? 'this property')}? Active leases or occupied rooms will block deletion.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />
    </>
  )
}

// Nominatim geocoding — called from browser, no API key needed
async function nominatimGeocode(name: string, address: string, city: string, county: string, country: string): Promise<{ lat: number; lng: number; display_name: string } | null> {
  const COUNTRY_NAMES: Record<string, string> = { KE: 'Kenya', UG: 'Uganda', TZ: 'Tanzania', RW: 'Rwanda', ET: 'Ethiopia' }
  const countryName = COUNTRY_NAMES[country.toUpperCase()] ?? country
  const BASE = 'https://nominatim.openstreetmap.org/search'
  const headers = { 'Accept-Language': 'en', 'User-Agent': 'RockyRent/1.0' }
  const countyPart = county ? `, ${county}` : ''

  const queries = [
    `${name}, ${address}, ${city}${countyPart}, ${countryName}`,
    `${name}, ${city}${countyPart}, ${countryName}`,
    `${address}, ${city}${countyPart}, ${countryName}`,
    `${city}${countyPart}, ${countryName}`,
  ]

  for (const q of queries) {
    try {
      const url = `${BASE}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=${country.toLowerCase()}`
      const res = await fetch(url, { headers })
      if (!res.ok) continue
      const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>
      if (data.length > 0 && data[0].lat) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name }
      }
    } catch { /* try next query */ }
  }
  return null
}

function MapLocationPicker({ form, idPrefix }: { form: UseFormReturn<PropertySchema>; idPrefix: string }): React.ReactElement {
  const [locating, setLocating]     = useState(false)
  const [locError, setLocError]     = useState<string | null>(null)
  const [embedUrl, setEmbedUrl]     = useState<string | null>(null)
  const [mapsUrl, setMapsUrl]       = useState<string | null>(null)
  const [foundPlace, setFoundPlace] = useState<{ name: string; sub: string } | null>(null)

  const lat = form.watch('latitude' as never) as number | undefined | null
  const lng = form.watch('longitude' as never) as number | undefined | null

  // Show name-based embed on mount if property already has a name
  React.useEffect(() => {
    const name = form.getValues('name')
    if (name) {
      setEmbedUrl(`https://maps.google.com/maps?q=${encodeURIComponent(name)}&z=17&output=embed`)
      setMapsUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const findOnMap = async () => {
    const name    = form.getValues('name')
    const address = form.getValues('address')
    const city    = form.getValues('city')
    const county  = form.getValues('county') ?? ''
    const country = form.getValues('country') ?? 'KE'

    if (!name && !city) {
      setLocError('Enter a property name or city first.')
      return
    }

    setLocating(true)
    setLocError(null)

    const COUNTRY_DISPLAY: Record<string, string> = { KE: 'Kenya', UG: 'Uganda', TZ: 'Tanzania', RW: 'Rwanda', ET: 'Ethiopia' }
    const countryDisplay = COUNTRY_DISPLAY[country.toUpperCase()] ?? country
    const searchParts = [name, address, city, county, countryDisplay].filter(Boolean)
    const searchQuery = searchParts.join(', ')

    // Always search by property name — this is what house hunters see on the public site
    const nameQuery = name || searchQuery
    setEmbedUrl(`https://maps.google.com/maps?q=${encodeURIComponent(nameQuery)}&z=17&output=embed`)
    setMapsUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nameQuery)}`)
    setFoundPlace({ name: name || city || 'Property', sub: [address, city, county].filter(Boolean).join(', ') })

    // Geocode to store coordinates in DB (used for distance calculations)
    try {
      const result = await nominatimGeocode(name, address, city, county, country)
      if (result) {
        form.setValue('latitude' as never, result.lat as never, { shouldDirty: true })
        form.setValue('longitude' as never, result.lng as never, { shouldDirty: true })
      } else {
        setLocError('Could not find exact coordinates for distance calculations — map preview uses property name search.')
      }
    } catch { setLocError('Geocoding failed. Map preview uses property name search.') }

    setLocating(false)
  }

  return (
    <div className="col-span-2 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Map Location</p>
        <button
          type="button"
          onClick={() => { void findOnMap() }}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {locating
            ? <><Loader2 className="h-3 w-3 animate-spin" /> Finding…</>
            : <><MapPin className="h-3 w-3" /> Find on Map</>}
        </button>
      </div>

      {locError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{locError}</p>
      )}

      {embedUrl ? (
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">
          {/* Map iframe — larger for better visibility */}
          <div className="relative">
            <iframe
              key={embedUrl}
              src={embedUrl}
              width="100%"
              height="340"
              className="border-0 block"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Property location preview"
            />

            {/* Floating property card — Google Maps style bottom sheet */}
            {foundPlace && (
              <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-[260px] rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-sm">
                <div className="flex items-start gap-3 p-3">
                  {/* Building icon */}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                    <Building2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-foreground leading-tight">{foundPlace.name}</p>
                    {foundPlace.sub && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{foundPlace.sub}</p>
                    )}
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        Open in Google Maps <Navigation className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  {/* Close button */}
                  <button
                    type="button"
                    onClick={() => setFoundPlace(null)}
                    className="ml-1 shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              {lat && lng ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : 'Location preview'}
            </p>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                Open in Maps <Navigation className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
          <div className="text-center">
            <MapPin className="mx-auto mb-1 h-5 w-5 opacity-30" />
            Enter the property name, address and city, then click <strong>Find on Map</strong>
          </div>
        </div>
      )}

      {/* Hidden lat/lng inputs */}
      <input type="hidden" {...form.register('latitude' as never)} />
      <input type="hidden" {...form.register('longitude' as never)} />
    </div>
  )
}

function ListingFields({ form, idPrefix }: { form: UseFormReturn<PropertySchema>; idPrefix: string }): React.ReactElement {
  const selectedAmenities = form.watch('listing.amenities') ?? []
  const le = form.formState.errors.listing

  return (
    <div className="col-span-2 grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/20 p-4">
      <FormField label="House Type" htmlFor={`${idPrefix}house-type`} error={le?.house_type?.message}>
        <Select
          id={`${idPrefix}house-type`}
          error={!!le?.house_type}
          {...form.register('listing.house_type')}
          options={HOUSE_TYPE_OPTIONS}
        />
      </FormField>
      <FormField label="Neighbourhood" htmlFor={`${idPrefix}neighbourhood`} error={le?.neighbourhood?.message}>
        <Input id={`${idPrefix}neighbourhood`} placeholder="Kilimani" error={!!le?.neighbourhood} {...form.register('listing.neighbourhood')} />
      </FormField>
      <FormField label="Rent Min" htmlFor={`${idPrefix}rent-min`} error={le?.rent_min?.message}>
        <Input id={`${idPrefix}rent-min`} type="number" min={0} placeholder="15000" error={!!le?.rent_min} {...form.register('listing.rent_min')} />
      </FormField>
      <FormField label="Rent Max" htmlFor={`${idPrefix}rent-max`} error={le?.rent_max?.message}>
        <Input id={`${idPrefix}rent-max`} type="number" min={0} placeholder="35000" error={!!le?.rent_max} {...form.register('listing.rent_max')} />
      </FormField>
      <FormField label="Bedrooms Min" htmlFor={`${idPrefix}bedrooms-min`} error={le?.bedrooms_min?.message}>
        <Input id={`${idPrefix}bedrooms-min`} type="number" min={0} error={!!le?.bedrooms_min} {...form.register('listing.bedrooms_min')} />
      </FormField>
      <FormField label="Bedrooms Max" htmlFor={`${idPrefix}bedrooms-max`} error={le?.bedrooms_max?.message}>
        <Input id={`${idPrefix}bedrooms-max`} type="number" min={0} error={!!le?.bedrooms_max} {...form.register('listing.bedrooms_max')} />
      </FormField>
      <FormField label="Bathrooms Min" htmlFor={`${idPrefix}bathrooms-min`} error={le?.bathrooms_min?.message}>
        <Input id={`${idPrefix}bathrooms-min`} type="number" min={0} error={!!le?.bathrooms_min} {...form.register('listing.bathrooms_min')} />
      </FormField>
      <FormField label="Bathrooms Max" htmlFor={`${idPrefix}bathrooms-max`} error={le?.bathrooms_max?.message}>
        <Input id={`${idPrefix}bathrooms-max`} type="number" min={0} error={!!le?.bathrooms_max} {...form.register('listing.bathrooms_max')} />
      </FormField>
      <label className="flex items-center gap-2 self-end rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
        <input type="checkbox" className="h-4 w-4 accent-primary" {...form.register('listing.is_available')} />
        Available
      </label>
      <div className="col-span-2">
        <p className="mb-2 text-xs font-medium text-foreground">Amenities</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AMENITY_OPTIONS.map((amenity) => (
            <label key={amenity} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground">
              <input
                type="checkbox"
                value={amenity}
                checked={selectedAmenities.includes(amenity)}
                className="h-4 w-4 accent-primary"
                {...form.register('listing.amenities')}
              />
              {amenity}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function buildPropertyPayload(values: PropertySchema): PropertyInput {
  const selectedAmenities = values.listing?.amenities ?? []

  return {
    name: values.name,
    address: values.address,
    city: values.city,
    county: values.county || null,
    state: values.state || null,
    country: values.country || null,
    phone: values.phone || null,
    email: values.email || null,
    description: values.description || null,
    total_floors: values.total_floors ?? null,
    status: values.status,
    latitude: values.latitude ?? undefined,
    longitude: values.longitude ?? undefined,
    listing: {
      house_type: values.listing?.house_type,
      rent_min: values.listing?.rent_min,
      rent_max: values.listing?.rent_max,
      bedrooms_min: values.listing?.bedrooms_min,
      bedrooms_max: values.listing?.bedrooms_max,
      bathrooms_min: values.listing?.bathrooms_min,
      bathrooms_max: values.listing?.bathrooms_max,
      neighbourhood: values.listing?.neighbourhood,
      amenities: selectedAmenities,
      water_available: selectedAmenities.includes('Water Available'),
      internet_available: selectedAmenities.includes('WiFi'),
      parking_available: selectedAmenities.includes('Parking'),
      security_level: selectedAmenities.includes('Security') ? 'high' : 'standard',
      is_available: values.listing?.is_available ?? true,
    },
  }
}

function houseTypeLabel(value?: string | null): string {
  if (!value) return '—'
  return HOUSE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? String(value)
}

function formatRange(min?: number | null, max?: number | null): string {
  if (min == null && max == null) return '—'
  if (min != null && max != null) return min === max ? String(min) : `${min} - ${max}`
  return String(min ?? max)
}

function formatRentRange(listing: NonNullable<Property['listing']>): string {
  const range = formatRange(listing.rent_min, listing.rent_max)
  return range === '—' ? range : `${listing.currency ?? 'KES'} ${range}`
}

function extractMediaItems(row: Property): MediaItem[] {
  const media = row.media as Record<string, unknown> | MediaItem[] | undefined
  const mediaItems = Array.isArray(media)
    ? media
    : [
        media?.cover,
        ...((media?.gallery as unknown[]) ?? []),
      ]

  const items = [
    row.cover_image,
    ...mediaItems,
    ...((row.images as unknown[]) ?? []),
  ]

  return items
    .filter((item): item is MediaItem => Boolean(item) && typeof item === 'object' && typeof (item as MediaItem).uuid === 'string')
    .filter((item, index, all) => all.findIndex((candidate) => candidate.uuid === item.uuid) === index)
    .map((item, index) => ({ ...item, sort_order: item.sort_order ?? index }))
}

function getPropertyImage(row: Property): MediaItem | string | null {
  const cover = row.cover_image as MediaItem | undefined
  if (cover?.optimized_urls?.medium || cover?.optimized_urls?.small || cover?.optimized_urls?.thumbnail || cover?.optimized_urls?.original) return cover

  const media = row.media as Record<string, unknown> | MediaItem[] | undefined
  const firstMedia = Array.isArray(media)
    ? media[0]
    : ((media?.cover as MediaItem | undefined) ?? ((media?.gallery as MediaItem[] | undefined)?.[0]))
  if (firstMedia?.optimized_urls?.medium || firstMedia?.optimized_urls?.small || firstMedia?.optimized_urls?.thumbnail || firstMedia?.optimized_urls?.original) return firstMedia

  return (row.banner_url as string | undefined) ?? ((row.images as string[] | undefined)?.[0]) ?? null
}
