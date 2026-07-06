import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import {
  Award, Eye, RefreshCw, Send, Star, ShieldCheck, ShieldAlert,
  CheckCircle2, XCircle, AlertTriangle, Phone, Mail, BadgeCheck,
  ChevronRight,
} from 'lucide-react'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { Button, FilterBar, FormField, Input, Modal, Select, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge, StatCard } from '@/components/ui'
import { usePagination, useToast } from '@/hooks'
import { formatCurrency, formatDate } from '@/utils/format'
import { propertiesApi } from '@/api/properties'
import { useQuery } from '@tanstack/react-query'
import { PROPERTY_TYPE_OPTIONS, type ListingHouseType, type PublicListing } from '@/api/listings'
import type { ApiError } from '@/types'
import { getErrorMessage, isApiError } from '@/utils/errors'
import { useAdminListings, useFeatureListing, usePublishListing, useSyncListing, useUnpublishListing } from '../layout/hooks/useListings'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PermissionDeniedBlock {
  permission: string
  role:       string
  steps:      string[]
}

interface VerificationBlock {
  phone_verified: boolean
  email_verified: boolean
  badge_earned:   boolean
  status:         string
}

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

function extractPermissionDenied(err: unknown): PermissionDeniedBlock | null {
  if (!isApiError(err)) return null
  const apiErr = err as ApiError
  const payload = apiErr.data as Record<string, unknown> | null
  const data = (payload?.data && typeof payload.data === 'object'
    ? payload.data
    : payload) as Record<string, unknown> | null
  if (apiErr.status === 403 && data?.permission_denied === true) {
    return {
      permission: String(data.permission ?? ''),
      role:       String(data.role ?? 'user'),
      steps:      Array.isArray(data.steps) ? (data.steps as string[]) : [],
    }
  }
  return null
}

function extractVerificationBlock(err: unknown): VerificationBlock | null {
  if (!isApiError(err)) return null
  const apiErr = err as ApiError
  const payload = apiErr.data as Record<string, unknown> | null
  const data = (payload?.data && typeof payload.data === 'object'
    ? payload.data
    : payload) as Record<string, unknown> | null
  if (apiErr.status === 403 && data?.verification_required === true) {
    return {
      phone_verified: Boolean(data.phone_verified),
      email_verified: Boolean(data.email_verified),
      badge_earned:   Boolean(data.badge_earned),
      status:         String(data.status ?? 'none'),
    }
  }
  return null
}

function featureLabel(feature: string): string {
  return feature.replace(/^enable_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Verification gate banner ───────────────────────────────────────────────────

function VerificationGate({ block, onDismiss }: { block: VerificationBlock; onDismiss: () => void }) {
  const steps = [
    { key: 'phone', label: 'Phone verified',          done: block.phone_verified, icon: <Phone className="h-3.5 w-3.5" /> },
    { key: 'email', label: 'Email verified',           done: block.email_verified, icon: <Mail className="h-3.5 w-3.5" /> },
    { key: 'badge', label: 'Trusted Badge approved',  done: block.badge_earned,   icon: <BadgeCheck className="h-3.5 w-3.5" /> },
  ]

  const badgeLabel: Record<string, string> = {
    none:      'Not submitted',
    submitted: 'Pending superadmin review',
    approved:  'Approved',
    trusted:   'Trusted',
    rejected:  'Rejected — resubmit documents',
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-50 to-orange-50 dark:border-amber-700/40 dark:from-amber-950/30 dark:to-orange-950/20">
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
            Verification required before publishing
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800/80 dark:text-amber-300/70">
            To keep the StayLynk marketplace safe and scam-free, only verified landlords may publish
            public listings. Verified properties gain a <strong>Trusted Badge</strong>, priority ranking,
            and access to premium StayLynk services — giving you a real competitive edge over
            unverified listings.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 text-amber-600 hover:bg-amber-200/60 dark:hover:bg-amber-800/40"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>

      {/* Why verification matters */}
      <div className="mx-5 mb-4 rounded-xl border border-amber-200/60 bg-white/60 p-4 dark:border-amber-800/30 dark:bg-black/20">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Why we require approval
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { icon: '🛡️', title: 'Prevent Scammers', desc: 'Identity verification ensures only genuine property owners list on StayLynk.' },
            { icon: '🏆', title: 'Priority Access', desc: 'Verified landlords get priority placement, premium AI tools, and dedicated support.' },
            { icon: '🔗', title: 'Build Your Portfolio', desc: 'Earn the Trusted Badge to build a professional online presence that attracts quality tenants.' },
          ].map((r) => (
            <div key={r.title} className="flex items-start gap-2.5">
              <span className="text-base leading-none">{r.icon}</span>
              <div>
                <p className="text-xs font-semibold text-foreground">{r.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Checklist */}
      <div className="mx-5 mb-4 space-y-2">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Your verification progress:</p>
        {steps.map((s) => (
          <div key={s.key} className="flex items-center gap-2.5 rounded-lg border border-amber-200/50 bg-white/50 px-3 py-2 dark:border-amber-800/30 dark:bg-black/20">
            {s.done
              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              : <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
            <span className="text-xs font-medium text-foreground">{s.label}</span>
            {s.key === 'badge' && (
              <span className="ml-auto text-xs text-muted-foreground">{badgeLabel[block.status] ?? block.status}</span>
            )}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex items-center justify-end gap-3 border-t border-amber-200/50 bg-amber-50/50 px-5 py-3 dark:border-amber-800/30 dark:bg-amber-950/10">
        <p className="mr-auto text-xs text-amber-700 dark:text-amber-400">
          {block.badge_earned
            ? 'You\'re approved — complete remaining steps above.'
            : block.status === 'submitted'
            ? 'Documents submitted — awaiting superadmin review.'
            : 'Complete verification to unlock public publishing.'}
        </p>
        <Link
          to="/admin/verification"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Go to Verification
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Listings(): React.ReactElement {
  const [status, setStatus] = useState('')
  const [houseType, setHouseType] = useState<ListingHouseType | ''>('')
  const [publishOpen, setPublishOpen] = useState(false)
  const [propertyId, setPropertyId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [addressDisplay, setAddressDisplay] = useState('')
  const [upgradeNotice, setUpgradeNotice] = useState<{ feature: string; message: string } | null>(null)
  const [verificationBlock, setVerificationBlock] = useState<VerificationBlock | null>(null)
  const [permissionDenied, setPermissionDenied] = useState<PermissionDeniedBlock | null>(null)
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError, error: listingsError } = useAdminListings({
    status: status || undefined,
    house_type: houseType || undefined,
    page,
    per_page: perPage,
  })
  const { data: propertiesData } = useQuery({
    queryKey: ['admin', 'properties', 'listing-publish'],
    queryFn: () => propertiesApi.list({ per_page: 100 }).then((r) => r.data),
  })
  const { mutate: publish, isPending: publishing } = usePublishListing()
  const { mutate: unpublish } = useUnpublishListing()
  const { mutate: sync } = useSyncListing()
  const { mutate: feature } = useFeatureListing()

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
    const vBlock = extractVerificationBlock(err)
    if (vBlock) { setVerificationBlock(vBlock); setPublishOpen(false); return }
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
      accessor: (row) => <span className="text-xs text-muted-foreground">{formatCurrency(row.rent_min ?? 0)} - {formatCurrency(row.rent_max ?? 0)}</span>,
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
          <button onClick={() => sync(row.uuid, { onSuccess: () => success('Listing synced'), onError: (err) => toastError(err, 'Failed to sync listing') })} className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10">
            Sync
          </button>
          <button onClick={() => feature({ uuid: row.uuid, featured: !row.is_featured }, { onSuccess: () => success(row.is_featured ? 'Feature removed' : 'Listing featured'), onError: (err) => toastError(err, 'Failed to update feature') })} className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50">
            {row.is_featured ? 'Unfeature' : 'Feature'}
          </button>
          {row.is_published ? (
            <button onClick={() => unpublish(row.uuid, { onSuccess: () => success('Listing unpublished'), onError: (err) => toastError(err, 'Failed to unpublish') })} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">
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
          subtitle="Control which properties are published to house hunters."
          actions={<Button onClick={() => setPublishOpen(true)}><Send className="h-3.5 w-3.5" /> Publish Property</Button>}
        />

        {/* ── Verification gate notice ── */}
        {verificationBlock && (
          <VerificationGate block={verificationBlock} onDismiss={() => setVerificationBlock(null)} />
        )}

        {/* ── Subscription upgrade notice ── */}
        {!verificationBlock && activeUpgradeNotice && (
          <div className="mb-5 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{activeUpgradeNotice.message}</p>
              <p className="text-xs text-amber-800">Upgrade to Premium to unlock {featureLabel(activeUpgradeNotice.feature)}.</p>
            </div>
            <div className="flex gap-2">
              {upgradeNotice && <Button variant="outline" onClick={() => setUpgradeNotice(null)}>Dismiss</Button>}
              <Link
                to="/admin/billing"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                View Subscription Plans
              </Link>
            </div>
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

      {/* ── Permission denied guidance modal ── */}
      <Modal
        open={!!permissionDenied}
        onClose={() => setPermissionDenied(null)}
        title="Action not permitted"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setPermissionDenied(null)}>Close</Button>
            {permissionDenied?.role === 'manager' && (
              <Link
                to="/admin/org-users"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => setPermissionDenied(null)}
              >
                Manage Permissions
              </Link>
            )}
            {permissionDenied?.role !== 'manager' && (
              <Link
                to="/admin/billing"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => setPermissionDenied(null)}
              >
                View Plans
              </Link>
            )}
          </div>
        }
      >
        {permissionDenied && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/40 dark:bg-red-950/20">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  You don't have access to <span className="font-bold text-primary">{permissionDenied.permission.replace(/[._]/g, ' ')}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {permissionDenied.role === 'manager'
                    ? 'Your manager account needs this permission enabled by the property admin.'
                    : 'This feature may require a subscription upgrade or contact with support.'}
                </p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Steps to resolve</p>
              <ol className="space-y-2">
                {permissionDenied.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Modal>

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
          {/* Inline verification hint */}
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-800/40 dark:bg-blue-950/20">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-300">
              Your organisation must be <strong>phone-verified</strong>, <strong>email-verified</strong>, and
              hold a <strong>Trusted Badge</strong> (approved by StayLynk) to publish. Once published, your
              listing will display a verified badge visible to all house hunters.
            </p>
          </div>
          <FormField label="Property" htmlFor="listing-property" required>
            <Select
              id="listing-property"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              options={[
                { value: '', label: 'Select property', disabled: true },
                ...properties.map((property) => ({ value: property.id as number, label: property.name as string })),
              ]}
            />
          </FormField>
          <FormField label="Public Title" htmlFor="listing-title">
            <Input id="listing-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </FormField>
          <FormField label="Address Display" htmlFor="listing-address">
            <Input id="listing-address" value={addressDisplay} onChange={(e) => setAddressDisplay(e.target.value)} maxLength={300} />
          </FormField>
          <FormField label="Description" htmlFor="listing-description">
            <Textarea id="listing-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} />
          </FormField>
        </div>
      </Modal>
    </>
  )
}
