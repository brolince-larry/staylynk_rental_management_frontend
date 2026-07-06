import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  BarChart3, Check, ChevronRight, Copy, Download, ExternalLink,
  Link2, MessageCircle, Plus, RefreshCw, ShieldOff, Trash2,
} from 'lucide-react'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { Button, ConfirmDialog, FilterBar, FormField, Input, Modal, Select, ToastContainer } from '@/components/forms'
import { PageHeader, StatCard, StatusBadge } from '@/components/ui'
import { usePagination, useToast } from '@/hooks'
import { useProperties } from '../hooks/index'
import {
  useAdminInviteAnalytics,
  useAdminInviteExports,
  useAdminInvites,
  useBulkGenerateInvites,
  useRevokeAllInvites,
  useRevokeInvite,
} from '../layout/hooks/useInvites'
import { inviteAdminApi, type BulkGenerateResult, type InviteExport, type InviteItem, type InviteListResponse } from '@/api/invites'
import { formatDate, formatDatetime } from '@/utils/format'
import { isApiError } from '@/utils/errors'
import { useAuthStore } from '@/store/auth.store'

type Tab = 'invites' | 'exports'
const EXPIRY_OPTIONS = [
  { value: '7',  label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
]

const STATUS_BADGE: Record<string, string> = {
  pending: 'active',
  used:    'completed',
  expired: 'expired',
  revoked: 'cancelled',
}

export default function AdminInvites(): React.ReactElement {
  const currentProperty = useAuthStore((s) => s.user?.current_property)

  const [tab, setTab]                         = useState<Tab>('invites')
  const [propertyFilter, setPropertyFilter]   = useState<string | undefined>(currentProperty?.uuid ?? undefined)
  const [statusFilter, setStatusFilter]       = useState('')
  const { page, perPage, setPage, setPerPage } = usePagination()

  // Sync filter when property switcher changes
  useEffect(() => {
    setPropertyFilter(currentProperty?.uuid ?? undefined)
    setPage(1)
  }, [currentProperty?.uuid])

  // Generate modal
  const [generateOpen, setGenerateOpen]   = useState(false)
  const [genPropertyId, setGenPropertyId] = useState(currentProperty?.uuid ?? '')
  const [genExpiry, setGenExpiry]         = useState('14')
  const [genResult, setGenResult]         = useState<BulkGenerateResult | null>(null)

  // Revoke
  const [revokeTarget, setRevokeTarget]     = useState<InviteItem | null>(null)
  const [revokeAllPropId, setRevokeAllPropId] = useState<string | null>(null)

  // Copied state
  const [copiedUrl, setCopiedUrl]     = useState<string | null>(null)
  const [waLoading, setWaLoading]     = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data: propertiesRes } = useProperties()
  const properties = (propertiesRes?.data ?? []) as { id: number; uuid: string; name: string }[]

  const { data: inviteData, isLoading: invitesLoading } = useAdminInvites({
    property_id: propertyFilter,
    status: statusFilter || undefined,
    page, per_page: perPage,
  })
  const { data: analytics } = useAdminInviteAnalytics({ property_id: propertyFilter })
  const { data: exports = [], isLoading: exportsLoading } = useAdminInviteExports()

  const { mutate: bulkGenerate, isPending: generating } = useBulkGenerateInvites()
  const { mutate: revokeInvite, isPending: revoking }   = useRevokeInvite()
  const { mutate: revokeAll,    isPending: revokingAll } = useRevokeAllInvites()

  const invites = (inviteData as InviteListResponse | undefined)?.invites ?? []
  const rawMeta = (inviteData as InviteListResponse | undefined)?.meta
  const meta = rawMeta ? { ...rawMeta, per_page: perPage, from: null, to: null } : undefined

  // ── Generate ────────────────────────────────────────────────────────────────

  const handleGenerate = () => {
    if (!genPropertyId) return
    bulkGenerate(
      { property_id: genPropertyId, expiry_days: Number(genExpiry) as 7 | 14 | 30 | 60 },
      {
        onSuccess: (res) => {
          setGenResult(res.data)
          success(`Generated ${res.data.invite_count} invite links`)
        },
        onError: (err) => toastError(err, 'Failed to generate invites'),
      }
    )
  }

  const closeGenerateModal = () => {
    setGenerateOpen(false)
    setGenResult(null)
    setGenPropertyId('')
    setGenExpiry('14')
  }

  // ── Copy URL ────────────────────────────────────────────────────────────────

  const copyUrl = (url: string) => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url)
      window.setTimeout(() => setCopiedUrl(null), 2000)
    })
  }

  // ── WhatsApp group share ─────────────────────────────────────────────────

  const openWhatsApp = async (exportUuid: string) => {
    setWaLoading(true)
    try {
      const res = await inviteAdminApi.whatsappGroup(exportUuid)
      if (res.data?.link) window.open(res.data.link, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toastError(err, 'Failed to get WhatsApp link')
    } finally {
      setWaLoading(false)
    }
  }

  // ── PDF download ─────────────────────────────────────────────────────────

  const downloadPdf = async (uuid: string) => {
    setDownloading(uuid)
    try {
      await inviteAdminApi.downloadExport(uuid)
    } catch (err) {
      toastError(err, 'Failed to download PDF')
    } finally {
      setDownloading(null)
    }
  }

  // ── Columns ──────────────────────────────────────────────────────────────

  const inviteColumns: ColumnDef<InviteItem>[] = [
    {
      key: 'room', header: 'Room',
      accessor: (r) => (
        <div className="text-xs">
          <p className="font-semibold text-foreground">{r.room?.room_number ?? '—'}</p>
          {r.room?.floor && <p className="text-muted-foreground">{r.room.floor}{r.room.block ? ` · Block ${r.room.block}` : ''}</p>}
        </div>
      ),
    },
    {
      key: 'type', header: 'Type',
      accessor: (r) => <span className="text-xs text-muted-foreground">{r.room?.room_type ?? '—'}</span>,
    },
    {
      key: 'status', header: 'Status',
      accessor: (r) => <StatusBadge status={STATUS_BADGE[r.status] ?? r.status} />,
    },
    {
      key: 'used_by', header: 'Tenant',
      accessor: (r) => r.used_by
        ? <div className="text-xs"><p className="font-medium text-foreground">{r.used_by.name}</p></div>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: 'clicks', header: 'Clicks',
      accessor: (r) => <span className="text-xs tabular-nums text-muted-foreground">{r.click_count}</span>,
    },
    {
      key: 'expires_at', header: 'Expires',
      accessor: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.expires_at)}</span>,
    },
    {
      key: 'actions', header: '', width: 'w-24',
      accessor: (r) => r.status === 'pending' ? (
        <div className="flex items-center gap-1">
          <button
            onClick={() => { copyUrl(r.registration_url) }}
            title="Copy link"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          >
            {copiedUrl === r.registration_url ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setRevokeTarget(r)}
            title="Revoke"
            className="flex h-7 w-7 items-center justify-center rounded text-destructive hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <ShieldOff className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null,
    },
  ]

  const exportColumns: ColumnDef<InviteExport>[] = [
    {
      key: 'property', header: 'Property',
      accessor: (r) => <span className="text-xs font-medium text-foreground">{r.property_name ?? `Property #${r.property_id}`}</span>,
    },
    {
      key: 'invite_count', header: 'Invites',
      accessor: (r) => <span className="text-xs tabular-nums text-muted-foreground">{r.invite_count}</span>,
    },
    {
      key: 'expires_at', header: 'Expires',
      accessor: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.expires_at)}</span>,
    },
    {
      key: 'created_at', header: 'Created',
      accessor: (r) => <span className="text-xs text-muted-foreground">{formatDatetime(r.created_at)}</span>,
    },
    {
      key: 'actions', header: '', width: 'w-40',
      accessor: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => void openWhatsApp(r.uuid)}
            disabled={waLoading}
            title="Share via WhatsApp"
            className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => void downloadPdf(r.uuid)}
            disabled={downloading === r.uuid}
            title="Download PDF"
            className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {downloading === r.uuid
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
          </button>
        </div>
      ),
    },
  ]

  const propertyOptions = [
    { value: '', label: 'All properties' },
    ...properties.map((p) => ({ value: p.uuid, label: p.name })),
  ]

  return (
    <>
      <Helmet><title>Room Invites — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="animate-page-slide-in p-6">
        <PageHeader
          title="Room Invites"
          subtitle="Generate shareable links for vacant rooms and track registrations."
          actions={
            <Button onClick={() => { setGenPropertyId(currentProperty?.uuid ?? ''); setGenerateOpen(true) }}>
              <Plus className="mr-1.5 h-4 w-4" />
              Generate Invites
            </Button>
          }
        />

        {/* ── Analytics strip ── */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total"         value={analytics?.total ?? 0}           icon={<Link2 className="h-4 w-4 text-primary" />}          iconBg="bg-primary/10"                            loading={!analytics} />
          <StatCard label="Pending"       value={analytics?.pending ?? 0}         icon={<ChevronRight className="h-4 w-4 text-amber-600" />}  iconBg="bg-amber-50 dark:bg-amber-950/40"          loading={!analytics} />
          <StatCard label="Used"          value={analytics?.used ?? 0}            icon={<Check className="h-4 w-4 text-emerald-600" />}       iconBg="bg-emerald-50 dark:bg-emerald-950/40"      loading={!analytics} />
          <StatCard label="Conversion"    value={`${analytics?.conversion_rate ?? 0}%`} icon={<BarChart3 className="h-4 w-4 text-violet-600" />}   iconBg="bg-violet-50 dark:bg-violet-950/40"        loading={!analytics} />
        </div>

        {/* ── Tabs ── */}
        <div className="mb-4 flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {(['invites', 'exports'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                'flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors',
                tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {t === 'exports' ? 'PDF Exports' : 'Invites'}
            </button>
          ))}
        </div>

        {/* ── Invites tab ── */}
        {tab === 'invites' && (
          <>
            <FilterBar>
              <Select
                value={String(propertyFilter ?? '')}
                onChange={(e) => { setPropertyFilter(e.target.value || undefined); setPage(1) }}
                options={propertyOptions}
                className="w-44 text-xs"
              />
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                options={[
                  { value: '',        label: 'All statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'used',    label: 'Used' },
                  { value: 'expired', label: 'Expired' },
                  { value: 'revoked', label: 'Revoked' },
                ]}
                className="w-36 text-xs"
              />
              {propertyFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevokeAllPropId(propertyFilter)}
                  className="text-destructive hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Revoke All
                </Button>
              )}
            </FilterBar>
            <DataTable
              columns={inviteColumns}
              data={invites}
              keyField="id"
              loading={invitesLoading}
              emptyTitle="No invites found"
              emptyDescription="Generate invite links for vacant rooms to get started."
              pagination={meta}
              onPageChange={setPage}
              onPerPageChange={setPerPage}
              caption="Room invites"
            />
          </>
        )}

        {/* ── Exports tab ── */}
        {tab === 'exports' && (
          <DataTable
            columns={exportColumns}
            data={exports}
            keyField="id"
            loading={exportsLoading}
            emptyTitle="No PDF exports"
            emptyDescription="Generate bulk invites to create a shareable PDF."
            caption="PDF exports"
          />
        )}
      </div>

      {/* ── Generate invites modal ── */}
      <Modal
        open={generateOpen}
        onClose={closeGenerateModal}
        title={genResult ? 'Invites Generated!' : 'Generate Invite Links'}
        size="sm"
        footer={
          genResult ? (
            <Button className="w-full" onClick={closeGenerateModal}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={closeGenerateModal}>Cancel</Button>
              <Button loading={generating} disabled={!genPropertyId} onClick={handleGenerate}>
                Generate
              </Button>
            </>
          )
        }
      >
        {genResult ? (
          <div className="space-y-4">
            {/* Success summary */}
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <Check className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{genResult.invite_count} invite links created</p>
                <p className="text-xs text-muted-foreground">Expires {formatDate(genResult.expires_at)}</p>
              </div>
            </div>

            {/* PDF download */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-foreground">Invite links PDF</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void downloadPdf(genResult.pdf_export_id ?? '')}
                loading={downloading === (genResult.pdf_export_id ?? '')}
                disabled={!genResult.pdf_export_id}
              >
                Download
              </Button>
            </div>

            {/* WhatsApp group share */}
            {genResult.whatsapp_group_link && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                  <p className="text-xs font-medium text-foreground">Share via WhatsApp</p>
                </div>
                <a
                  href={genResult.whatsapp_group_link ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-500 px-3 text-xs font-medium text-white hover:bg-emerald-600"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <FormField label="Property" htmlFor="gen-property" required>
              <Select
                id="gen-property"
                value={genPropertyId}
                onChange={(e) => setGenPropertyId(e.target.value)}
                options={[
                  { value: '', label: 'Select a property…' },
                  ...properties.map((p) => ({ value: p.uuid, label: p.name })),
                ]}
              />
            </FormField>
            <FormField label="Link expiry" htmlFor="gen-expiry" hint="Links expire after this many days.">
              <Select
                id="gen-expiry"
                value={genExpiry}
                onChange={(e) => setGenExpiry(e.target.value)}
                options={EXPIRY_OPTIONS}
              />
            </FormField>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800/40 dark:bg-blue-950/20">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                One link will be generated per vacant room. A PDF with all links and a WhatsApp share button will be provided after generation.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Revoke single confirm ── */}
      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke Invite"
        description={`Revoke the invite for Room ${revokeTarget?.room?.room_number ?? ''}? The link will stop working immediately.`}
        confirmLabel="Revoke"
        loading={revoking}
        onConfirm={() => {
          if (!revokeTarget) return
          revokeInvite(revokeTarget.id, {
            onSuccess: () => { success('Invite revoked'); setRevokeTarget(null) },
            onError: (err) => { toastError(err, 'Failed to revoke invite'); setRevokeTarget(null) },
          })
        }}
        onCancel={() => setRevokeTarget(null)}
      />

      {/* ── Revoke all confirm ── */}
      <ConfirmDialog
        open={!!revokeAllPropId}
        title="Revoke All Invites"
        description="This will revoke all pending invites for this property. Tenants with the old links will not be able to register."
        confirmLabel="Revoke All"
        loading={revokingAll}
        onConfirm={() => {
          if (!revokeAllPropId) return
          revokeAll(revokeAllPropId, {
            onSuccess: () => { success('All pending invites revoked'); setRevokeAllPropId(null) },
            onError: (err) => { toastError(err, 'Failed to revoke invites'); setRevokeAllPropId(null) },
          })
        }}
        onCancel={() => setRevokeAllPropId(null)}
      />
    </>
  )
}
