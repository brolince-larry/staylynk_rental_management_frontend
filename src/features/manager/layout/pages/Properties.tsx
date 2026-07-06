import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { MapPin, Video } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { propertiesApi } from '@/api/properties'
import { useDebounce, usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef, type SortState } from '@/components/tables/DataTable'
import { Button, FilterBar, Modal, SearchInput, Select, ToastContainer } from '@/components/forms'
import { PageHeader, ProgressBar, StatusBadge } from '@/components/ui'
import { PropertyVideoManager } from '@/features/admin/components/PropertyVideoManager'
import { formatDate } from '@/utils/format'

type Property = Record<string, unknown>

export default function ManagerProperties(): React.ReactElement {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState<SortState>({ column: 'name', direction: 'asc' })
  const [videoProperty, setVideoProperty] = useState<Property | null>(null)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const debouncedSearch = useDebounce(search, 400)
  const { toasts, success, error: toastError, dismiss } = useToast()
  const qc = useQueryClient()

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
    onError: (err) => toastError(err, 'Failed to update property'),
  })

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
        const canManageVideos = hasPermission(row, 'property_videos.manage')
        return (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setVideoProperty(row)}
              disabled={!canManageVideos}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
            >
              <Video className="h-3.5 w-3.5" /> Videos
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
        open={!!videoProperty}
        onClose={() => setVideoProperty(null)}
        title={`${String(videoProperty?.name ?? 'Property')} Videos`}
        size="xl"
        footer={<Button variant="outline" onClick={() => setVideoProperty(null)}>Close</Button>}
      >
        {videoProperty ? (
          <PropertyVideoManager
            propertyId={String(videoProperty.id)}
            scope="manager"
            title="Manager Videos"
          />
        ) : null}
      </Modal>
    </>
  )
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
