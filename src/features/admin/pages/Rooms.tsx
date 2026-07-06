// src/features/admin/pages/Rooms.tsx
import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom } from '../hooks/useRooms'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef, type SortState } from '@/components/tables/DataTable'
import { SearchInput, FilterBar, Select, Modal, Button, FormField, Input, ConfirmDialog, ToastContainer } from '@/components/forms'
import { MediaManager, MediaUploadField, SmartImage } from '@/components/media'
import { entityIdFromResponse, mediaService, type MediaItem } from '@/services/media'
import { PageHeader, StatusBadge } from '@/components/ui'
import { roomSchema, type RoomSchema } from '@/schemas/property.schema'
import { HOUSE_TYPE_OPTIONS } from '@/api/listings'
import { roomsApi } from '@/api/rooms'
import { formatCurrency } from '@/utils/format'

type Room = Record<string, unknown>
type RoomCreateResult = {
  created_count?: number
  room_numbers?: string[]
  floors?: Array<{ floor: string; count: number }>
  data?: unknown
}

const ROOM_DEFAULTS: Partial<RoomSchema> = { status: 'available', capacity: 1, number_of_rooms: 1 }

export default function Rooms(): React.ReactElement {
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editRoom, setEditRoom]     = useState<Room | null>(null)
  const [deleteId, setDeleteId]   = useState<number | null>(null)
  const [roomMedia, setRoomMedia] = useState<MediaItem[]>([])
  const [roomImageFiles, setRoomImageFiles] = useState<File[]>([])
  const [mediaProgress, setMediaProgress] = useState<number | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [sort, setSort]           = useState<SortState>({ column: 'room_number', direction: 'asc' })
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError, refetch } = useRooms({
    search:      debouncedSearch || undefined,
    status:      statusFilter    || undefined,
    sort: sort.column, direction: sort.direction,
    page, per_page: perPage,
  })

  const roomModalOpen = createOpen || !!editRoom
  const { mutate: createRoom,   isPending: creating } = useCreateRoom()
  const { mutate: updateRoom,   isPending: updating } = useUpdateRoom((editRoom?.id as string) ?? '')
  const { mutate: deleteRoom,   isPending: deleting } = useDeleteRoom()

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
      room_number: String(editRoom.room_number ?? editRoom.display_name ?? ''),
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
      const response = await roomsApi.get(Number(editRoom.id))
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
        onError: (err) => toastError(err, 'Failed to update room'),
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
      onError: (err) => toastError(err, 'Failed to create room'),
    })
  }

  const list = data as Record<string, unknown> | undefined
  const rows = ((list?.data as Room[]) ?? []).map((room, i) => ({
    ...room,
    id: room.id ?? `row-${i}`,
  }))
  const meta = list?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<Room>[] = [
    {
      key: 'room_number', header: 'Room', sortable: true,
      accessor: (row) => (
        <div className="flex items-center gap-3">
          <SmartImage
            src={getRoomImage(row)}
            alt={`Room ${String(row.display_name ?? row.room_number ?? '')}`}
            usage="card"
            aspectRatio="1 / 1"
            sizes="48px"
            wrapperClassName="h-12 w-12 shrink-0 overflow-hidden rounded-md"
            className="object-cover"
          />
          <div>
            <p className="text-xs font-semibold text-foreground">{String(row.display_name ?? row.room_number ?? '—')}</p>
            {(row.block !== undefined || row.floor !== undefined) && (
              <p className="text-xs text-muted-foreground">
                {row.block ? `Block ${String(row.block)}` : ''}{row.floor ? `, Floor ${String(row.floor)}` : ''}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'property', header: 'Property',
      accessor: (row) => {
        const p = row.property as Record<string, string> | null
        return <span className="text-xs text-muted-foreground">{p?.name ?? '—'}</span>
      },
    },
    {
      key: 'room_type', header: 'Type',
      accessor: (row) => {
        const t = row.room_type as Record<string, string> | null
        return <span className="text-xs text-foreground">{t?.name ?? '—'}</span>
      },
    },
    {
      key: 'monthly_rent', header: 'Rent', align: 'right', sortable: true,
      accessor: (row) => <span className="text-xs font-semibold text-foreground">{formatCurrency(row.monthly_rent as number)}</span>,
    },
    {
      key: 'capacity', header: 'Capacity',
      accessor: (row) => (
        <span className="text-xs text-foreground">
          {row.current_occupants as number}/{row.capacity as number}
        </span>
      ),
    },
    { key: 'status', header: 'Status', sortable: true, accessor: (row) => <StatusBadge status={row.status as string} /> },
    {
      key: 'actions', header: 'Actions', width: 'w-36', align: 'right',
      accessor: (row) => {
        const id     = row.id as number
        return (
          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { setRoomMedia(extractRoomMedia(row)); setEditRoom(row) }}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteId(id)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <>
      <Helmet><title>Rooms — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Rooms & Beds"
          subtitle="Manage all rooms across your properties."
          actions={<Button onClick={() => { form.reset(ROOM_DEFAULTS); setCreateOpen(true) }}><Plus className="h-3.5 w-3.5" /> Add Room</Button>}
        />
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search room number…" className="w-60" />
          <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} placeholder="All statuses" className="w-36 text-xs"
            options={[{ value:'', label:'All' }, { value:'available', label:'Available' }, { value:'occupied', label:'Occupied' }, { value:'maintenance', label:'Maintenance' }, { value:'reserved', label:'Reserved' }]} />
        </FilterBar>
        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading}
          error={isError ? 'Failed to load rooms.' : null}
          emptyTitle="No rooms found"
          sort={sort} onSort={(col, dir) => { setSort({ column: col, direction: dir }); setPage(1) }}
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Rooms list"
        />
      </div>

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
          <FormField label="Starting Room Number" htmlFor="rnum" error={form.formState.errors.room_number?.message} required>
            <Input id="rnum" placeholder="101" error={!!form.formState.errors.room_number} {...form.register('room_number')} />
          </FormField>
          {!editRoom && (
            <FormField label="Number of Rooms" htmlFor="rcount" error={form.formState.errors.number_of_rooms?.message} required>
              <Input id="rcount" type="number" min={1} max={100} error={!!form.formState.errors.number_of_rooms} {...form.register('number_of_rooms')} />
            </FormField>
          )}
          <FormField label="House Type" htmlFor="rhousetype" error={form.formState.errors.house_type?.message} required>
            <Select
              id="rhousetype"
              error={!!form.formState.errors.house_type}
              placeholder="Select house type"
              {...form.register('house_type')}
              options={[...HOUSE_TYPE_OPTIONS]}
            />
          </FormField>
          {!editRoom && Number(numberOfRooms) > 1 && (
            <FormField
              label="Rooms Per Floor"
              htmlFor="rperfloor"
              error={form.formState.errors.rooms_per_floor?.message}
              hint="Floors will be assigned automatically from Ground Floor upward."
            >
              <Input id="rperfloor" type="number" min={1} max={100} error={!!form.formState.errors.rooms_per_floor} {...form.register('rooms_per_floor')} />
            </FormField>
          )}
          <FormField label="Monthly Rent" htmlFor="rrent" error={form.formState.errors.monthly_rent?.message} required>
            <Input id="rrent" type="text" inputMode="decimal" placeholder="KSh 15,000" error={!!form.formState.errors.monthly_rent} {...form.register('monthly_rent')} />
          </FormField>
          <FormField label="Security Deposit" htmlFor="rdeposit">
            <Input id="rdeposit" type="text" inputMode="decimal" placeholder="KSh 15,000" {...form.register('security_deposit')} />
          </FormField>
          <FormField label="Capacity" htmlFor="rcap" error={form.formState.errors.capacity?.message} required>
            <Input id="rcap" type="number" min={1} max={20} error={!!form.formState.errors.capacity} {...form.register('capacity')} />
          </FormField>
          <FormField label="Block" htmlFor="rblock">
            <Input id="rblock" placeholder="Block A" {...form.register('block')} />
          </FormField>
          {!autoAssignFloors && (
            <FormField label="Floor" htmlFor="rfloor">
              <Input id="rfloor" placeholder="Ground Floor" {...form.register('floor')} />
            </FormField>
          )}
          <FormField label="Status" htmlFor="rstatus">
            <Select id="rstatus" {...form.register('status')}
              options={[{ value:'available', label:'Available' }, { value:'occupied', label:'Occupied' }, { value:'maintenance', label:'Maintenance' }, { value:'reserved', label:'Reserved' }]} />
          </FormField>
          <FormField label="Notes" htmlFor="rnotes" className="col-span-2">
            <Input id="rnotes" placeholder="Optional room notes" {...form.register('notes')} />
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
          deleteRoom(deleteId, {
            onSuccess: () => { success('Room deleted'); setDeleteId(null) },
            onError: (err) => toastError(err, 'Failed to delete'),
          })
        }}
        title="Delete Room" description="This permanently deletes the room. Active leases must be terminated first."
        confirmLabel="Delete" variant="destructive" loading={deleting}
      />
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
