import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Images, MapPin } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { propertiesApi } from '@/api/properties'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef, type SortState } from '@/components/tables/DataTable'
import { Button, FilterBar, Modal, SearchInput, Select, ToastContainer } from '@/components/forms'
import { MediaManager, MediaUploadField } from '@/components/media'
import { mediaService, type MediaItem } from '@/services/media'
import { PageHeader, ProgressBar, StatusBadge, PermissionDeniedModal } from '@/components/ui'
import { PropertyVideoManager } from '@/features/admin/components/PropertyVideoManager'
import { formatDate } from '@/utils/format'
import { useAuthStore } from '@/store/auth.store'
import { extractPermissionDenied, type PermissionDeniedBlock } from '@/utils/errors'

type Property = Record<string, unknown>

const MAX_PROPERTY_PHOTOS = 25

export default function ManagerProperties(): React.ReactElement {
  const user = useAuthStore((s) => s.user)
  const setCurrentProperty = useAuthStore((s) => s.setCurrentProperty)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState<SortState>({ column: 'name', direction: 'asc' })
  const [mediaProperty, setMediaProperty] = useState<Property | null>(null)
  const [mediaTab, setMediaTab] = useState<'photos' | 'videos'>('photos')
  const [propertyMedia, setPropertyMedia] = useState<MediaItem[]>([])
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [mediaProgress, setMediaProgress] = useState<number | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [switchingProperty, setSwitchingProperty] = useState(false)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()
  const [permissionDenied, setPermissionDenied] = useState<PermissionDeniedBlock | null>(null)
  const qc = useQueryClient()

  const handleLockedError = (err: unknown, fallback: string) => {
    const block = extractPermissionDenied(err)
    if (block) { setPermissionDenied(block); return }
    toastError(err, fallback)
  }

  const params = { search: debouncedSearch || undefined, status: status || undefined, sort: sort.column, direction: sort.direction, page, per_page: perPage }
  const { data, isLoading, isError } = useQuery({
    queryKey: ['manager', 'properties', params],
    queryFn: () => propertiesApi.managerList(params).then((r) => r.data),
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) => propertiesApi.managerUpdateStatus(id, next),
    onSuccess: () => {
      success('Property status updated')
      void qc.invalidateQueries({ queryKey: ['manager', 'properties'] })
    },
    onError: (err) => handleLockedError(err, 'Failed to update property'),
  })

  const isCurrentProperty = mediaProperty
    ? String(user?.current_property?.uuid ?? '') === String(mediaProperty.id ?? '')
    : false

  const openMediaModal = (row: Property) => {
    setPropertyMedia(extractPropertyMedia(row))
    setMediaTab('photos')
    setPhotoFiles([])
    setMediaProperty(row)
  }

  const closeMediaModal = () => {
    setMediaProperty(null)
    setPropertyMedia([])
    setPhotoFiles([])
  }

  const refreshMediaProperty = async () => {
    if (!mediaProperty?.id) return
    try {
      const response = await propertiesApi.managerGet(String(mediaProperty.id))
      setPropertyMedia(extractPropertyMedia(response.data as Property))
    } catch {
      // Ignore — the media list will still reflect the last known state.
    } finally {
      void qc.invalidateQueries({ queryKey: ['manager', 'properties'] })
    }
  }

  const switchToMediaProperty = async () => {
    if (!mediaProperty?.id) return
    setSwitchingProperty(true)
    try {
      await propertiesApi.managerSetCurrent(String(mediaProperty.id))
      setCurrentProperty({
        uuid: String(mediaProperty.id),
        name: String(mediaProperty.name ?? ''),
        slug: String(mediaProperty.slug ?? ''),
      })
      void qc.invalidateQueries({ queryKey: ['manager', 'properties'] })
      void qc.invalidateQueries({ queryKey: ['manager', 'dashboard'] })
      success('Switched active property')
    } catch (err) {
      toastError(err, 'Failed to switch property')
    } finally {
      setSwitchingProperty(false)
    }
  }

  const uploadPhotos = async () => {
    if (photoFiles.length === 0 || !mediaProperty) return
    setUploadingMedia(true)
    try {
      await mediaService.uploadFilesForEntity({
        files: photoFiles,
        media_type: 'property_image',
        entity_type: 'property',
        entity_id: String(mediaProperty.id),
        is_public: true,
        cover_index: propertyMedia.length === 0 ? 0 : undefined,
        alt_text: String(mediaProperty.name ?? 'Property'),
      }, ({ progress }) => setMediaProgress(progress))
      success('Photos uploaded')
      setPhotoFiles([])
      await refreshMediaProperty()
    } catch (err) {
      handleLockedError(err, 'Failed to upload photos')
    } finally {
      setUploadingMedia(false)
      setMediaProgress(null)
    }
  }

  const remainingPhotoSlots = Math.max(0, MAX_PROPERTY_PHOTOS - propertyMedia.length)

  const rows = (data?.data as Property[] | undefined) ?? []
  const meta = data?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<Property>[] = [
    {
      key: 'name', header: 'Property', sortable: true,
      accessor: (row) => (
        <div>
          <p className="text-xs font-semibold text-foreground">{row.name as string}</p>
          <div className="mt-0.5 flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{row.city as string}{row.state ? `, ${row.state as string}` : ''}</p>
          </div>
        </div>
      ),
    },
    { key: 'total_rooms', header: 'Rooms', align: 'right', accessor: (row) => <span className="text-xs font-medium">{row.total_rooms as number ?? 0}</span> },
    {
      key: 'occupancy_rate', header: 'Occupancy',
      accessor: (row) => {
        const rate = row.occupancy_rate as number ?? 0
        return (
          <div className="min-w-[90px]">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">{row.occupied_rooms as number ?? 0}/{row.total_rooms as number ?? 0}</span>
              <span className="font-medium">{rate.toFixed(0)}%</span>
            </div>
            <ProgressBar value={rate} color={rate >= 90 ? 'bg-emerald-500' : rate >= 70 ? 'bg-primary' : rate >= 50 ? 'bg-amber-500' : 'bg-red-400'} />
          </div>
        )
      },
    },
    { key: 'status', header: 'Status', sortable: true, accessor: (row) => <StatusBadge status={row.status as string} /> },
    { key: 'created_at', header: 'Added', accessor: (row) => <span className="text-xs text-muted-foreground">{formatDate(row.created_at as string)}</span> },
    {
      key: 'actions', header: '', width: 'w-28',
      accessor: (row) => {
        const id = row.id as string
        const active = row.status === 'active'
        const canManageMedia = hasPermission(row, 'property_videos.manage')
        return (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => canManageMedia
                ? openMediaModal(row)
                : setPermissionDenied({
                    permission: 'property_videos.manage',
                    role: 'manager',
                    steps: ['Ask your property admin to enable "Manage photos & videos" for your account under Org Users → Permissions.'],
                  })}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
            >
              <Images className="h-3.5 w-3.5" /> Media
            </button>
            <button
              type="button"
              onClick={() => updateStatus({ id, next: active ? 'maintenance' : 'active' })}
              className={`rounded px-2 py-1 text-xs ${active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
            >
              {active ? 'Maintenance' : 'Activate'}
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Properties - StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader title="Properties" subtitle="Properties assigned to your manager account." />
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, city..." className="w-64" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="w-36 text-xs"
            options={[{ value:'', label:'All' }, { value:'active', label:'Active' }, { value:'inactive', label:'Inactive' }, { value:'maintenance', label:'Maintenance' }]} />
        </FilterBar>
        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading} error={isError ? 'Failed to load properties.' : null}
          emptyTitle="No properties assigned" sort={sort} onSort={(col, dir) => { setSort({ column: col, direction: dir }); setPage(1) }}
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Manager properties" />
      </div>

      <Modal
        open={!!mediaProperty}
        onClose={closeMediaModal}
        title={`${String(mediaProperty?.name ?? 'Property')} Media`}
        size="xl"
        footer={<Button variant="outline" onClick={closeMediaModal}>Close</Button>}
      >
        {mediaProperty ? (
          <div className="space-y-4">
            <div className="flex gap-1 border-b border-border">
              {([['photos', 'Photos'], ['videos', 'Videos']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setMediaTab(tab)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                    mediaTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mediaTab === 'photos' ? (
              !isCurrentProperty ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Photo uploads apply to your active property. Switch to <strong>{String(mediaProperty.name)}</strong> to manage its photos.
                  </p>
                  <Button size="sm" loading={switchingProperty} onClick={() => void switchToMediaProperty()}>
                    Switch &amp; Manage Photos
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-foreground">Current Photos</p>
                    <MediaManager
                      items={propertyMedia}
                      mediaType="property_image"
                      onChange={setPropertyMedia}
                      onRefresh={() => void refreshMediaProperty()}
                      emptyLabel="No photos uploaded for this property yet."
                    />
                  </div>
                  <MediaUploadField
                    label="Add Photos"
                    mediaType="property_image"
                    files={photoFiles}
                    onChange={setPhotoFiles}
                    multiple
                    maxFiles={remainingPhotoSlots}
                    disabled={remainingPhotoSlots <= 0 || uploadingMedia}
                    hint={remainingPhotoSlots <= 0
                      ? `Photo limit reached — maximum ${MAX_PROPERTY_PHOTOS} photos per property.`
                      : `${propertyMedia.length} uploaded · max ${MAX_PROPERTY_PHOTOS} · ${remainingPhotoSlots} slots remaining.`}
                    progress={uploadingMedia ? mediaProgress : null}
                  />
                  {photoFiles.length > 0 && (
                    <Button size="sm" loading={uploadingMedia} onClick={() => void uploadPhotos()}>
                      Upload {photoFiles.length} Photo{photoFiles.length === 1 ? '' : 's'}
                    </Button>
                  )}
                </div>
              )
            ) : (
              <PropertyVideoManager
                propertyId={String(mediaProperty.id)}
                scope="manager"
                title="Property Videos"
              />
            )}
          </div>
        ) : null}
      </Modal>

      <PermissionDeniedModal block={permissionDenied} onClose={() => setPermissionDenied(null)} />
    </>
  )
}

function extractPropertyMedia(row: Property): MediaItem[] {
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

function hasPermission(row: Property, permission: string): boolean {
  const permissions = row.permissions ?? row.property_permissions
  if (Array.isArray(permissions)) return permissions.includes(permission)
  if (permissions && typeof permissions === 'object') {
    const value = (permissions as Record<string, unknown>)[permission]
    return value === undefined ? true : Boolean(value)
  }
  return true
}
