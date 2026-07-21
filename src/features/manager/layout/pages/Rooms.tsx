import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { roomsApi, type RoomStatus } from '@/api/rooms'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef, type SortState } from '@/components/tables/DataTable'
import { FilterBar, SearchInput, Select, Modal, Button, FormField, Input, ConfirmDialog, ToastContainer } from '@/components/forms'
import { MediaManager, MediaUploadField, SmartImage } from '@/components/media'
import { entityIdFromResponse, mediaService, type MediaItem } from '@/services/media'
import { PageHeader, StatusBadge, PermissionDeniedModal } from '@/components/ui'
import { roomSchema, type RoomSchema } from '@/schemas/property.schema'
import { HOUSE_TYPE_OPTIONS } from '@/api/listings'
import { formatCurrency } from '@/utils/format'
import { extractPermissionDenied, type PermissionDeniedBlock } from '@/utils/errors'
import { useAuthStore } from '@/store/auth.store'

type Room = Record<string, unknown>
type RoomCreateResult = {
  created_count?: number
  room_numbers?: string[]
  floors?: Array<{ floor: string; count: number }>
  data?: unknown
}

const ROOM_DEFAULTS: Partial<RoomSchema> = { status: 'available', capacity: 1, number_of_rooms: 1 }

function hasRoomPermission(row: Room, permission: string): boolean {
  const property = row.property as Record<string, unknown> | null
  const permissions = row.permissions ?? property?.permissions ?? property?.property_permissions
  if (Array.isArray(permissions)) return permissions.includes(permission)
  if (permissions && typeof permissions === 'object') {
    const value = (permissions as Record<string, unknown>)[permission]
    return value === undefined ? true : Boolean(value)
  }
  return true
}

export default function ManagerRooms(): React.ReactElement {
  const currency = useAuthStore((s) => s.user?.org?.currency ?? 'KES')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<SortState>({ column: 'room_number', direction: 'asc' })
  const [createOpen, setCreateOpen] = useState(false)
  const [editRoom, setEditRoom] = useState<Room | null>(null)
  const [viewRoom, setViewRoom] = useState<Room | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [roomMedia, setRoomMedia] = useState<MediaItem[]>([])
  const [roomImageFiles, setRoomImageFiles] = useState<File[]>([])
  const [mediaProgress, setMediaProgress] = useState<number | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
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

  const params = { search: debouncedSearch || undefined, status: statusFilter || undefined, sort: sort.column, direction: sort.direction, page, per_page: perPage }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['manager', 'rooms', params],
    queryFn: () => roomsApi.managerList(params).then((r) => r.data),
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RoomStatus }) => roomsApi.managerUpdateStatus(id, status),
    onSuccess: () => {
      success('Room status updated')
      void qc.invalidateQueries({ queryKey: ['manager', 'rooms'] })
      void qc.invalidateQueries({ queryKey: ['manager', 'dashboard'] })
    },
    onError: (err) => handleLockedError(err, 'Failed to update room status'),
  })

  const { mutate: createRoom, isPending: creating } = useMutation({
    mutationFn: roomsApi.managerCreate,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['manager', 'rooms'] }),
  })

  const { mutate: updateRoom, isPending: updating } = useMutation({
    mutationFn: (data: Parameters<typeof roomsApi.managerUpdate>[1]) =>
      roomsApi.managerUpdate((editRoom?.id as string) ?? '', data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['manager', 'rooms'] }),
  })

  const { mutate: deleteRoom, isPending: deleting } = useMutation({
    mutationFn: roomsApi.managerDelete,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['manager', 'rooms'] }),
  })

  const roomModalOpen = createOpen || !!editRoom
  const form = useForm<RoomSchema>({
    resolver: zodResolver(roomSchema) as Resolver<RoomSchema>,
    defaultValues: ROOM_DEFAULTS,
  })
  const numberOfRooms = useWatch({ control: form.control, name: 'number_of_rooms' })
  const roomsPerFloor = useWatch({ control: form.control, name: 'rooms_per_floor' })
  const autoAssignFloors = !editRoom && Number(numberOfRooms) > 1 && Number(roomsPerFloor) > 0

  useEffect(() => {
    if (!editRoom) return
    form.reset({
      house_type: String(editRoom.house_type ?? editRoom.property_type ?? '') as RoomSchema['house_type'],
      room_number: String(editRoom.room_number ?? ''),
      number_of_rooms: 1,
      rooms_per_floor: undefined,
      floor: String(editRoom.floor ?? ''),
      block: String(editRoom.block ?? ''),
      monthly_rent: Number(editRoom.monthly_rent ?? 0),
      security_deposit: Number(editRoom.security_deposit ?? 0),
      capacity: Number(editRoom.capacity ?? 1),
      status: (editRoom.status as RoomSchema['status']) ?? 'available',
      notes: String(editRoom.notes ?? ''),
    })
  }, [editRoom, form])

  const closeModal = () => {
    setCreateOpen(false)
    setEditRoom(null)
    setRoomMedia([])
    setRoomImageFiles([])
    setMediaProgress(null)
    form.reset(ROOM_DEFAULTS)
  }

  const uploadRoomImages = async (roomId: number, roomNumber: string) => {
    if (roomImageFiles.length === 0) return
    await mediaService.uploadFilesForEntity({
      files: roomImageFiles,
      media_type: 'room_image',
      entity_type: 'room',
      entity_id: roomId,
      is_public: true,
      cover_index: 0,
      alt_text: `Room ${roomNumber}`,
    }, ({ progress }) => setMediaProgress(progress))
  }

  const refreshEditedRoom = async () => {
    if (!editRoom?.id) {
      void refetch()
      return
    }
    try {
      const response = await roomsApi.managerGet(String(editRoom.id))
      const freshRoom = response.data as Room
      setEditRoom(freshRoom)
      setRoomMedia(extractRoomMedia(freshRoom))
    } finally {
      void refetch()
    }
  }

  const handleSave = (values: RoomSchema) => {
    if (editRoom) {
      const updateValues: Partial<RoomSchema> = { ...values }
      delete updateValues.number_of_rooms
      delete updateValues.rooms_per_floor
      updateRoom(updateValues, {
        onSuccess: () => {
          void (async () => {
            try {
              setUploadingMedia(true)
              await uploadRoomImages(editRoom.id as number, values.room_number)
              success(roomImageFiles.length > 0 ? 'Room updated. Images are processing.' : 'Room updated')
              closeModal()
            } catch (err) {
              toastError(err, 'Room updated, but media upload failed')
            } finally {
              setUploadingMedia(false)
              setMediaProgress(null)
            }
          })()
        },
        onError: (err) => handleLockedError(err, 'Failed to update room'),
      })
      return
    }

    createRoom(values, {
      onSuccess: (response) => {
        const result = response.data as RoomCreateResult
        const roomId = entityIdFromResponse(response.data)
        const isBulkCreate = Number(result?.created_count ?? values.number_of_rooms ?? 1) > 1
        if (!roomId && roomImageFiles.length > 0 && !isBulkCreate) {
          success('Room created')
          toastError('Upload images after opening the room again.', 'Room ID was not returned')
          closeModal()
          return
        }

        void (async () => {
          try {
            setUploadingMedia(true)
            if (roomId && !isBulkCreate) await uploadRoomImages(roomId, values.room_number)

            if (Number(result?.created_count) > 1) {
              const floorSummary = Array.isArray(result.floors)
                ? result.floors.map((floor) => `${floor.floor}: ${floor.count} rooms`).join(', ')
                : undefined
              success(`${result.created_count} rooms created successfully`, floorSummary)
            } else {
              success(roomImageFiles.length > 0 ? 'Room created. Images are processing.' : 'Room created')
            }
            closeModal()
          } catch (err) {
            toastError(err, 'Room created, but media upload failed')
          } finally {
            setUploadingMedia(false)
            setMediaProgress(null)
          }
        })()
      },
      onError: (err) => handleLockedError(err, 'Failed to create room'),
    })
  }

  const rows = (data?.data as Room[] | undefined) ?? []
  const meta = data?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<Room>[] = [
    {
      key: 'room_number', header: 'Room', sortable: true,
      accessor: (row) => (
        <div className="flex items-center gap-3">
          <SmartImage
            src={getRoomImage(row)}
            alt={`Room ${String(row.room_number ?? '')}`}
            usage="card"
            aspectRatio="1 / 1"
            sizes="40px"
            wrapperClassName="h-10 w-10 shrink-0 overflow-hidden rounded-md"
            className="object-cover"
          />
          <div>
            <p className="text-xs font-semibold text-foreground">{String(row.room_number ?? '-')}</p>
            {(row.block !== undefined || row.floor !== undefined) && (
              <p className="text-xs text-muted-foreground">{row.block ? `Block ${String(row.block)}` : ''}{row.floor ? `, Floor ${String(row.floor)}` : ''}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'property', header: 'Property',
      accessor: (row) => {
        const property = row.property as Record<string, string> | null
        return <span className="text-xs text-muted-foreground">{property?.name ?? '-'}</span>
      },
    },
    {
      key: 'room_type', header: 'Type',
      accessor: (row) => {
        const type = row.room_type as Record<string, string> | null
        return <span className="text-xs text-foreground">{type?.name ?? '-'}</span>
      },
    },
    { key: 'monthly_rent', header: 'Rent', align: 'right', sortable: true, accessor: (row) => <span className="text-xs font-semibold text-foreground">{formatCurrency(row.monthly_rent as number, currency)}</span> },
    { key: 'capacity', header: 'Capacity', accessor: (row) => <span className="text-xs text-foreground">{row.current_occupants as number}/{row.capacity as number}</span> },
    { key: 'status', header: 'Status', sortable: true, accessor: (row) => <StatusBadge status={row.status as string} /> },
    {
      key: 'row_actions', header: 'Actions', width: 'w-28', align: 'right',
      accessor: (row) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setViewRoom(row)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="View room"
          >
            <Eye className="h-3 w-3" />
          </button>
          {hasRoomPermission(row, 'rooms.update') && (
            <button
              type="button"
              onClick={() => { setRoomMedia(extractRoomMedia(row)); setEditRoom(row) }}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
              aria-label="Edit room"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {hasRoomPermission(row, 'rooms.status') && (
            <button
              type="button"
              onClick={() => setDeleteId(row.id as number)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              aria-label="Delete room"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'actions', header: 'Status Update', width: 'w-40', align: 'right',
      accessor: (row) => {
        const id = row.id as string
        const current = row.status as RoomStatus
        const canUpdateStatus = hasRoomPermission(row, 'rooms.status')
        return (
          <Select
            value={current}
            disabled={!canUpdateStatus}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => updateStatus({ id, status: e.target.value as RoomStatus })}
            className="w-32 text-xs"
            options={[
              { value: 'available', label: 'Available' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'reserved', label: 'Reserved' },
              { value: 'occupied', label: 'Occupied' },
            ]}
          />
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Rooms - StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Rooms & Beds"
          subtitle="View rooms and update room status."
          actions={
            <Button onClick={() => {
              form.reset(ROOM_DEFAULTS)
              setCreateOpen(true)
              void roomsApi.managerNextNumber().then((res) => {
                form.setValue('room_number', res.data.next_room_number)
              }).catch(() => { /* keep the blank placeholder — not worth failing the modal over */ })
            }}>
              <Plus className="h-3.5 w-3.5" /> Add Room
            </Button>
          }
        />
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search room number..." className="w-60" />
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="w-36 text-xs"
            options={[{ value:'', label:'All' }, { value:'available', label:'Available' }, { value:'occupied', label:'Occupied' }, { value:'maintenance', label:'Maintenance' }, { value:'reserved', label:'Reserved' }]} />
        </FilterBar>
        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading} error={isError ? 'Failed to load rooms.' : null}
          emptyTitle="No rooms found" sort={sort} onSort={(col, dir) => { setSort({ column: col, direction: dir }); setPage(1) }}
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Manager rooms" />
      </div>

      {/* View room (read-only) */}
      <Modal
        open={!!viewRoom}
        onClose={() => setViewRoom(null)}
        title={`Room ${String(viewRoom?.room_number ?? '')}`}
        size="md"
        footer={<Button variant="outline" onClick={() => setViewRoom(null)}>Close</Button>}
      >
        {viewRoom && (
          <div className="space-y-4">
            <SmartImage
              src={getRoomImage(viewRoom)}
              alt={`Room ${String(viewRoom.room_number ?? '')}`}
              usage="card"
              aspectRatio="16 / 9"
              sizes="480px"
              wrapperClassName="w-full overflow-hidden rounded-lg bg-muted"
              className="object-cover"
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ['Property', (viewRoom.property as Record<string, string> | null)?.name ?? '—'],
                ['Type', (viewRoom.room_type as Record<string, string> | null)?.name ?? '—'],
                ['Block', String(viewRoom.block ?? '—')],
                ['Floor', String(viewRoom.floor ?? '—')],
                ['Monthly Rent', formatCurrency(viewRoom.monthly_rent as number, currency)],
                ['Security Deposit', formatCurrency(viewRoom.security_deposit as number ?? 0, currency)],
                ['Capacity', `${viewRoom.current_occupants ?? 0}/${viewRoom.capacity ?? 0}`],
                ['Status', undefined],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-xs text-muted-foreground">{label as string}</p>
                  {label === 'Status'
                    ? <StatusBadge status={viewRoom.status as string} />
                    : <p className="text-sm font-medium text-foreground">{value as string}</p>}
                </div>
              ))}
            </div>
            {Boolean(viewRoom.notes) && (
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm text-foreground">{String(viewRoom.notes)}</p>
              </div>
            )}
            {hasRoomPermission(viewRoom, 'rooms.update') && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setRoomMedia(extractRoomMedia(viewRoom)); setEditRoom(viewRoom); setViewRoom(null) }}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Room
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* Add / edit room */}
      <Modal open={roomModalOpen} onClose={closeModal}
        title={editRoom ? 'Update Room' : 'Add New Room'} size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button loading={creating || updating || uploadingMedia} onClick={form.handleSubmit(handleSave)}>
              {editRoom ? 'Save Changes' : 'Create Room'}
            </Button>
          </>
        }
      >
        <form onSubmit={form.handleSubmit(handleSave)} className="grid grid-cols-2 gap-4">
          <FormField label="Starting Room Number" htmlFor="mrnum" error={form.formState.errors.room_number?.message} required>
            <Input id="mrnum" placeholder="101" error={!!form.formState.errors.room_number} {...form.register('room_number')} />
          </FormField>
          {!editRoom && (
            <FormField label="Number of Rooms" htmlFor="mrcount" error={form.formState.errors.number_of_rooms?.message} required
              hint="Add one room, or several at once — room numbers and floors are generated automatically."
            >
              <Input id="mrcount" type="number" min={1} max={100} error={!!form.formState.errors.number_of_rooms} {...form.register('number_of_rooms')} />
            </FormField>
          )}
          <FormField label="House Type" htmlFor="mrhousetype" error={form.formState.errors.house_type?.message} required>
            <Select
              id="mrhousetype"
              error={!!form.formState.errors.house_type}
              placeholder="Select house type"
              {...form.register('house_type')}
              options={[...HOUSE_TYPE_OPTIONS]}
            />
          </FormField>
          {!editRoom && Number(numberOfRooms) > 1 && (
            <FormField
              label="Rooms Per Floor"
              htmlFor="mrperfloor"
              error={form.formState.errors.rooms_per_floor?.message}
              hint="Floors will be assigned automatically from Ground Floor upward."
            >
              <Input id="mrperfloor" type="number" min={1} max={100} error={!!form.formState.errors.rooms_per_floor} {...form.register('rooms_per_floor')} />
            </FormField>
          )}
          <FormField label="Monthly Rent" htmlFor="mrrent" error={form.formState.errors.monthly_rent?.message} required>
            <Input id="mrrent" type="text" inputMode="decimal" placeholder="KSh 15,000" error={!!form.formState.errors.monthly_rent} {...form.register('monthly_rent')} />
          </FormField>
          <FormField label="Security Deposit" htmlFor="mrdeposit">
            <Input id="mrdeposit" type="text" inputMode="decimal" placeholder="KSh 15,000" {...form.register('security_deposit')} />
          </FormField>
          <FormField label="Capacity" htmlFor="mrcap" error={form.formState.errors.capacity?.message} required>
            <Input id="mrcap" type="number" min={1} max={20} error={!!form.formState.errors.capacity} {...form.register('capacity')} />
          </FormField>
          <FormField label="Block" htmlFor="mrblock">
            <Input id="mrblock" placeholder="Block A" {...form.register('block')} />
          </FormField>
          {!autoAssignFloors && (
            <FormField label="Floor" htmlFor="mrfloor">
              <Input id="mrfloor" placeholder="Ground Floor" {...form.register('floor')} />
            </FormField>
          )}
          <FormField label="Status" htmlFor="mrstatus">
            <Select id="mrstatus" {...form.register('status')}
              options={[{ value:'available', label:'Available' }, { value:'occupied', label:'Occupied' }, { value:'maintenance', label:'Maintenance' }, { value:'reserved', label:'Reserved' }]} />
          </FormField>
          <FormField label="Notes" htmlFor="mrnotes" className="col-span-2">
            <Input id="mrnotes" placeholder="Optional room notes" {...form.register('notes')} />
          </FormField>
          {editRoom && (
            <div className="col-span-2">
              <p className="mb-2 text-xs font-medium text-foreground">Current Room Images</p>
              <MediaManager
                items={roomMedia}
                mediaType="room_image"
                onChange={setRoomMedia}
                onRefresh={() => void refreshEditedRoom()}
                emptyLabel="No room images returned for this room."
              />
            </div>
          )}
          <div className="col-span-2">
            <MediaUploadField
              label="Room Images"
              mediaType="room_image"
              files={roomImageFiles}
              onChange={setRoomImageFiles}
              multiple
              disabled={!editRoom && Number(numberOfRooms) > 1}
              hint={!editRoom && Number(numberOfRooms) > 1
                ? 'Create bulk rooms first, then add images to individual rooms.'
                : 'Upload up to 25 images. First image becomes the room cover.'}
              progress={uploadingMedia ? mediaProgress : null}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return
          deleteRoom(String(deleteId), {
            onSuccess: () => { success('Room deleted'); setDeleteId(null) },
            onError: (err) => handleLockedError(err, 'Failed to delete'),
          })
        }}
        title="Delete Room" description="This permanently deletes the room. Active leases must be terminated first."
        confirmLabel="Delete" variant="destructive" loading={deleting}
      />

      <PermissionDeniedModal block={permissionDenied} onClose={() => setPermissionDenied(null)} />
    </>
  )
}

function extractRoomMedia(row: Room): MediaItem[] {
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

function getRoomImage(row: Room): MediaItem | string | null {
  const cover = row.cover_image as MediaItem | undefined
  if (cover?.optimized_urls?.medium || cover?.optimized_urls?.small || cover?.optimized_urls?.thumbnail) return cover

  const media = row.media as Record<string, unknown> | MediaItem[] | undefined
  const firstMedia = Array.isArray(media)
    ? media[0]
    : ((media?.cover as MediaItem | undefined) ?? ((media?.gallery as MediaItem[] | undefined)?.[0]))
  if (firstMedia?.optimized_urls?.medium || firstMedia?.optimized_urls?.small || firstMedia?.optimized_urls?.thumbnail) return firstMedia

  return ((row.images as string[] | undefined)?.[0]) ?? null
}
