import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { roomsApi, type RoomStatus } from '@/api/rooms'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef, type SortState } from '@/components/tables/DataTable'
import { FilterBar, SearchInput, Select, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge } from '@/components/ui'
import { formatCurrency } from '@/utils/format'

type Room = Record<string, unknown>

export default function ManagerRooms(): React.ReactElement {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<SortState>({ column: 'room_number', direction: 'asc' })
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()
  const qc = useQueryClient()

  const params = { search: debouncedSearch || undefined, status: statusFilter || undefined, sort: sort.column, direction: sort.direction, page, per_page: perPage }
  const { data, isLoading, isError } = useQuery({
    queryKey: ['manager', 'rooms', params],
    queryFn: () => roomsApi.managerList(params).then((r) => r.data),
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: RoomStatus }) => roomsApi.managerUpdateStatus(id, status),
    onSuccess: () => {
      success('Room status updated')
      void qc.invalidateQueries({ queryKey: ['manager', 'rooms'] })
      void qc.invalidateQueries({ queryKey: ['manager', 'dashboard'] })
    },
    onError: (err) => toastError(err, 'Failed to update room status'),
  })

  const rows = (data?.data as Room[] | undefined) ?? []
  const meta = data?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<Room>[] = [
    {
      key: 'room_number', header: 'Room', sortable: true,
      accessor: (row) => (
        <div>
          <p className="text-xs font-semibold text-foreground">{String(row.display_name ?? row.room_number ?? '-')}</p>
          {(row.block !== undefined || row.floor !== undefined) && (
            <p className="text-xs text-muted-foreground">{row.block ? `Block ${String(row.block)}` : ''}{row.floor ? `, Floor ${String(row.floor)}` : ''}</p>
          )}
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
    { key: 'monthly_rent', header: 'Rent', align: 'right', sortable: true, accessor: (row) => <span className="text-xs font-semibold text-foreground">{formatCurrency(row.monthly_rent as number)}</span> },
    { key: 'capacity', header: 'Capacity', accessor: (row) => <span className="text-xs text-foreground">{row.current_occupants as number}/{row.capacity as number}</span> },
    { key: 'status', header: 'Status', sortable: true, accessor: (row) => <StatusBadge status={row.status as string} /> },
    {
      key: 'actions', header: 'Status Update', width: 'w-40', align: 'right',
      accessor: (row) => {
        const id = row.id as number
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
        <PageHeader title="Rooms & Beds" subtitle="View rooms and update room status." />
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search room number..." className="w-60" />
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="w-36 text-xs"
            options={[{ value:'', label:'All' }, { value:'available', label:'Available' }, { value:'occupied', label:'Occupied' }, { value:'maintenance', label:'Maintenance' }, { value:'reserved', label:'Reserved' }]} />
        </FilterBar>
        <DataTable columns={columns} data={rows} keyField="id" loading={isLoading} error={isError ? 'Failed to load rooms.' : null}
          emptyTitle="No rooms found" sort={sort} onSort={(col, dir) => { setSort({ column: col, direction: dir }); setPage(1) }}
          pagination={meta} onPageChange={setPage} onPerPageChange={setPerPage} caption="Manager rooms" />
      </div>
    </>
  )
}

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
