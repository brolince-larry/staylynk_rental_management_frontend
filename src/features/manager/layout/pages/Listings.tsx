import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import { Award, Eye, RefreshCw, Send, Star } from 'lucide-react'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { Button, FilterBar, FormField, Input, Modal, Select, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge, StatCard, PermissionDeniedModal } from '@/components/ui'
import { usePagination, useToast } from '@/hooks'
import { formatCurrency, formatDate } from '@/utils/format'
import { propertiesApi } from '@/api/properties'
import { PROPERTY_TYPE_OPTIONS, type ListingHouseType, type PublicListing } from '@/api/listings'
import type { ApiError } from '@/types'
import { getErrorMessage, isApiError, extractPermissionDenied, type PermissionDeniedBlock } from '@/utils/errors'
import {
  useManagerListings, useManagerFeatureListing,
  useManagerPublishListing, useManagerSyncListing, useManagerUnpublishListing,
} from '../hooks'
import { useAuthStore } from '@/store/auth.store'

function lockedFeature(err: unknown): { feature: string; message: string } | null {
  if (!isApiError(err)) return null
  const apiErr = err as ApiError
  const payload = apiErr.data as Record<string, unknown> | null
  const data = (payload?.data && typeof payload.data === 'object'
    ? payload.data
    : payload) as Record<string, unknown> | null

  return apiErr.status === 403 && data?.upgrade_required === true && typeof data.feature === 'string'
    ? { feature: data.feature, message: getErrorMessage(err) }
    : null
}

function featureLabel(feature: string): string {
  return feature.replace(/^enable_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ManagerListings(): React.ReactElement {
  const currency = useAuthStore((s) => s.user?.org?.currency ?? 'KES')
  const [status, setStatus] = useState('')
  const [houseType, setHouseType] = useState<ListingHouseType | ''>('')
  const [publishOpen, setPublishOpen] = useState(false)
  const [propertyId, setPropertyId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [addressDisplay, setAddressDisplay] = useState('')
  const [upgradeNotice, setUpgradeNotice] = useState<{ feature: string; message: string } | null>(null)
  const [permissionDenied, setPermissionDenied] = useState<PermissionDeniedBlock | null>(null)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError, error: listingsError } = useManagerListings({
    status: status || undefined,
    house_type: houseType || undefined,
    page,
    per_page: perPage,
  })
  const { data: propertiesData } = useQuery({
    queryKey: ['manager', 'properties', 'listing-publish'],
    queryFn: () => propertiesApi.managerList({ per_page: 100 }).then((r) => r.data),
  })
  const { mutate: publish, isPending: publishing } = useManagerPublishListing()
  const { mutate: unpublish } = useManagerUnpublishListing()
  const { mutate: sync } = useManagerSyncListing()
  const { mutate: feature } = useManagerFeatureListing()

  const rows = data?.data ?? []
  const meta = data?.meta
  const properties = (propertiesData?.data ?? []) as Array<Record<string, unknown>>
  const listingsUpgrade = lockedFeature(listingsError)
  const activeUpgradeNotice = upgradeNotice ?? listingsUpgrade

  const closePublish = () => {
    setPublishOpen(false)
    setPropertyId('')
    setTitle('')
    setDescription('')
    setAddressDisplay('')
  }

  const handleLockedError = (err: unknown, fallback: string) => {
    const pBlock = extractPermissionDenied(err)
    if (pBlock) { setPermissionDenied(pBlock); setPublishOpen(false); return }
    const feat = lockedFeature(err)
    if (feat) { setUpgradeNotice(feat); return }
    toastError(err, fallback)
  }

  const columns: ColumnDef<PublicListing>[] = [
    {
      key: 'title', header: 'Listing',
      accessor: (row) => (
        <div>
          <p className="text-xs font-semibold text-foreground">{row.title}</p>
          <p className="text-xs text-muted-foreground">{row.city ?? '—'} · {row.slug}</p>
        </div>
      ),
    },
    {
      key: 'units', header: 'Units',
      accessor: (row) => <span className="text-xs text-muted-foreground">{row.available_units}/{row.total_units} available</span>,
    },
    {
      key: 'rent', header: 'Rent',
      accessor: (row) => <span className="text-xs text-muted-foreground">{formatCurrency(row.rent_min ?? 0, currency)} - {formatCurrency(row.rent_max ?? 0, currency)}</span>,
    },
    {
      key: 'verification_status', header: 'Trust',
      accessor: (row) => row.trust?.is_trusted === true ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-400">
          <Award className="h-3 w-3" /> Trusted Landlord
        </span>
      ) : (
        <StatusBadge status={row.trust?.verification_status ?? row.verification_status ?? 'unverified'} />
      ),
    },
    {
      key: 'is_published', header: 'Published',
      accessor: (row) => <StatusBadge status={row.is_published ? 'published' : 'unpublished'} />,
    },
    {
      key: 'published_at', header: 'Published At',
      accessor: (row) => <span className="text-xs text-muted-foreground">{row.published_at ? formatDate(row.published_at) : '—'}</span>,
    },
    {
      key: 'actions', header: '', width: 'w-56',
      accessor: (row) => (
        <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => sync(row.uuid, { onSuccess: () => success('Listing synced'), onError: (err) => handleLockedError(err, 'Failed to sync listing') })} className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10">
            Sync
          </button>
          <button onClick={() => feature({ uuid: row.uuid, featured: !row.is_featured }, { onSuccess: () => success(row.is_featured ? 'Feature removed' : 'Listing featured'), onError: (err) => handleLockedError(err, 'Failed to update feature') })} className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50">
            {row.is_featured ? 'Unfeature' : 'Feature'}
          </button>
          {row.is_published ? (
            <button onClick={() => unpublish(row.uuid, { onSuccess: () => success('Listing unpublished'), onError: (err) => handleLockedError(err, 'Failed to unpublish') })} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">
              Unpublish
            </button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <>
      <Helmet><title>Public Listings — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Public Listings"
          subtitle="Control which of your properties are published to house hunters."
          actions={<Button onClick={() => setPublishOpen(true)}><Send className="h-3.5 w-3.5" /> Publish Property</Button>}
        />

        {/* ── Subscription upgrade notice ── */}
        {activeUpgradeNotice && (
          <div className="mb-5 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{activeUpgradeNotice.message}</p>
              <p className="text-xs text-amber-800">
                {featureLabel(activeUpgradeNotice.feature)} isn't enabled on your organization's plan — ask your admin to upgrade.
              </p>
            </div>
            {upgradeNotice && <Button variant="outline" onClick={() => setUpgradeNotice(null)}>Dismiss</Button>}
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Listings" value={meta?.total ?? rows.length} icon={<Eye className="h-4 w-4 text-blue-600" />} iconBg="bg-blue-100" loading={isLoading} />
          <StatCard label="Featured on Page" value={rows.filter((row) => row.is_featured).length} icon={<Star className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-100" loading={isLoading} />
          <StatCard label="Available on Page" value={rows.filter((row) => row.is_available).length} icon={<RefreshCw className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-100" loading={isLoading} />
        </div>

        <FilterBar>
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="w-44 text-xs"
            options={[
              { value: '', label: 'All listings' },
              { value: 'published', label: 'Published' },
              { value: 'unpublished', label: 'Unpublished' },
              { value: 'featured', label: 'Featured' },
            ]}
          />
          <Select
            value={houseType}
            onChange={(e) => { setHouseType(e.target.value as ListingHouseType | ''); setPage(1) }}
            className="w-44 text-xs"
            options={[...PROPERTY_TYPE_OPTIONS]}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          keyField="uuid"
          loading={isLoading}
          error={isError && !listingsUpgrade ? 'Failed to load listings.' : null}
          emptyTitle="No listings"
          emptyDescription="Publish a property to create its public listing."
          pagination={meta}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          caption="Public listings"
        />
      </div>

      <PermissionDeniedModal block={permissionDenied} onClose={() => setPermissionDenied(null)} />

      {/* ── Publish modal ── */}
      <Modal
        open={publishOpen}
        onClose={closePublish}
        title="Publish Property"
        description="Only explicitly approved listing fields are sent to the public listing."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closePublish}>Cancel</Button>
            <Button
              loading={publishing}
              disabled={!propertyId}
              onClick={() => publish({
                propertyId: propertyId as unknown as number,
                data: { title, description, address_display: addressDisplay },
              }, {
                onSuccess: () => { success('Property is being published'); closePublish() },
                onError: (err) => handleLockedError(err, 'Failed to publish property'),
              })}
            >
              Publish
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Property" htmlFor="mlisting-property" required>
            <Select
              id="mlisting-property"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              options={[
                { value: '', label: 'Select property', disabled: true },
                ...properties.map((property) => ({ value: property.id as number, label: property.name as string })),
              ]}
            />
          </FormField>
          <FormField label="Public Title" htmlFor="mlisting-title">
            <Input id="mlisting-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </FormField>
          <FormField label="Address Display" htmlFor="mlisting-address">
            <Input id="mlisting-address" value={addressDisplay} onChange={(e) => setAddressDisplay(e.target.value)} maxLength={300} />
          </FormField>
          <FormField label="Description" htmlFor="mlisting-description">
            <Textarea id="mlisting-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} />
          </FormField>
        </div>
      </Modal>
    </>
  )
}
