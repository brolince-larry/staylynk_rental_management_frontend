import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Building2, Calendar, Check, ChevronRight, Copy, Download, ExternalLink, Home, Link2,
  MessageCircle, Phone, Plus, RefreshCw, ShieldCheck, ShieldOff, Sparkles, Trash2, Users, Wallet,
} from 'lucide-react'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { Button, ConfirmDialog, FilterBar, FormField, Input, Modal, Select, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, StatCard, StatusBadge, PermissionDeniedModal } from '@/components/ui'
import { usePagination, useToast } from '@/hooks'
import { propertiesApi } from '@/api/properties'
import {
  useManagerInviteAnalytics, useManagerInviteExports, useManagerInvites,
  useManagerBulkGenerateInvites, useManagerRevokeAllInvites, useManagerRevokeInvite, useRecordLastPayment,
} from '../hooks'
import { inviteManagerApi, type BulkGenerateResult, type InviteExport, type InviteItem, type InviteListResponse } from '@/api/invites'
import type { RecordLastPaymentResult } from '@/api/leases'
import { formatDate, formatDatetime, formatCurrency } from '@/utils/format'
import { extractPermissionDenied, type PermissionDeniedBlock } from '@/utils/errors'
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

export default function ManagerInvites(): React.ReactElement {
  const currentProperty = useAuthStore((s) => s.user?.current_property)

  const [tab, setTab]                       = useState<Tab>('invites')
  const [propertyFilter, setPropertyFilter] = useState<string | undefined>(currentProperty?.uuid ?? undefined)
  const [statusFilter, setStatusFilter]     = useState('')
  const { page, perPage, setPage, setPerPage } = usePagination()

  useEffect(() => {
    setPropertyFilter(currentProperty?.uuid ?? undefined)
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProperty?.uuid])

  const [generateOpen, setGenerateOpen]   = useState(false)
  const [genPropertyId, setGenPropertyId] = useState(currentProperty?.uuid ?? '')
  const [genExpiry, setGenExpiry]         = useState('14')
  const [genResult, setGenResult]         = useState<BulkGenerateResult | null>(null)

  const [revokeTarget, setRevokeTarget]       = useState<InviteItem | null>(null)
  const [revokeAllPropId, setRevokeAllPropId] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState<PermissionDeniedBlock | null>(null)

  const [copiedUrl, setCopiedUrl]     = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [waLoading, setWaLoading]     = useState(false)

  const [contactShareExport, setContactShareExport] = useState<InviteExport | null>(null)
  const [contactPhones, setContactPhones]           = useState('')
  const [contactLinks, setContactLinks]             = useState<Record<string, string> | null>(null)
  const [contactSharing, setContactSharing]         = useState(false)
  const [contactShareError, setContactShareError]   = useState<string | null>(null)

  const [paymentInvite, setPaymentInvite]   = useState<InviteItem | null>(null)
  const [paymentResult, setPaymentResult]   = useState<RecordLastPaymentResult | null>(null)
  const [paidDate, setPaidDate]             = useState(new Date().toISOString().slice(0, 10))
  const [paidAmount, setPaidAmount]         = useState('')
  const [paidNotes, setPaidNotes]           = useState('')
  const { mutate: recordPayment, isPending: recordingPayment } = useRecordLastPayment()

  const closePaymentModal = () => {
    setPaymentInvite(null)
    setPaymentResult(null)
    setPaidDate(new Date().toISOString().slice(0, 10))
    setPaidAmount('')
    setPaidNotes('')
  }

  const { toasts, success, error: toastError, dismiss } = useToast()

  const handleLockedError = (err: unknown, fallback: string) => {
    const block = extractPermissionDenied(err)
    if (block) { setPermissionDenied(block); return }
    toastError(err, fallback)
  }

  const { data: propertiesRes } = useQuery({
    queryKey: ['manager', 'properties', 'invites'],
    queryFn: () => propertiesApi.managerList({ per_page: 100 }).then((r) => r.data),
  })
  const properties = (propertiesRes?.data ?? []) as { id: string; name: string }[]

  const { data: inviteData, isLoading: invitesLoading } = useManagerInvites({
    property_id: propertyFilter,
    status: statusFilter || undefined,
    page, per_page: perPage,
  })
  const { data: analytics } = useManagerInviteAnalytics({ property_id: propertyFilter })
  const { data: exports = [], isLoading: exportsLoading } = useManagerInviteExports()

  const { mutate: bulkGenerate, isPending: generating } = useManagerBulkGenerateInvites()
  const { mutate: revokeInvite, isPending: revoking }   = useManagerRevokeInvite()
  const { mutate: revokeAll,    isPending: revokingAll } = useManagerRevokeAllInvites()

  const invites = (inviteData as InviteListResponse | undefined)?.invites ?? []
  const rawMeta = (inviteData as InviteListResponse | undefined)?.meta
  const meta = rawMeta ? { ...rawMeta, per_page: perPage, from: null, to: null } : undefined

  const handleGenerate = () => {
    if (!genPropertyId) return
    bulkGenerate(
      { property_id: genPropertyId, expiry_days: Number(genExpiry) as 7 | 14 | 30 | 60 },
      {
        onSuccess: (res) => {
          setGenResult(res.data)
          success(`Generated ${res.data.invite_count} invite links`)
        },
        onError: (err) => handleLockedError(err, 'Failed to generate invites'),
      }
    )
  }

  const closeGenerateModal = () => {
    setGenerateOpen(false)
    setGenResult(null)
    setGenPropertyId('')
    setGenExpiry('14')
  }

  const copyUrl = (url: string) => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url)
      window.setTimeout(() => setCopiedUrl(null), 2000)
    })
  }

  const downloadPdf = async (uuid: string) => {
    setDownloading(uuid)
    try {
      await inviteManagerApi.downloadExport(uuid)
    } catch (err) {
      handleLockedError(err, 'Failed to download PDF')
    } finally {
      setDownloading(null)
    }
  }

  const openWhatsApp = async (exportUuid: string) => {
    setWaLoading(true)
    try {
      const res = await inviteManagerApi.whatsappGroup(exportUuid)
      if (res.data?.link) window.open(res.data.link, '_blank', 'noopener,noreferrer')
    } catch (err) {
      handleLockedError(err, 'Failed to get WhatsApp link')
    } finally {
      setWaLoading(false)
    }
  }

  const openContactShare = (exp: InviteExport) => {
    setContactShareExport(exp)
    setContactPhones('')
    setContactLinks(null)
    setContactShareError(null)
  }

  const closeContactShare = () => {
    setContactShareExport(null)
    setContactPhones('')
    setContactLinks(null)
    setContactShareError(null)
  }

  const submitContactShare = async () => {
    if (!contactShareExport) return
    const phones = contactPhones
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (phones.length === 0) return
    setContactSharing(true)
    setContactShareError(null)
    try {
      const res = await inviteManagerApi.whatsappContacts({ export_uuid: contactShareExport.uuid, phones })
      setContactLinks(res.data?.links ?? {})
    } catch (err) {
      const block = extractPermissionDenied(err)
      if (block) { setPermissionDenied(block); closeContactShare(); return }
      setContactShareError('Failed to generate WhatsApp links. Check the phone numbers and try again.')
    } finally {
      setContactSharing(false)
    }
  }

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
      key: 'actions', header: '', width: 'w-40',
      accessor: (r) => {
        if (r.status === 'pending') {
          return (
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
          )
        }
        if (r.status === 'used' && r.used_by?.lease_uuid) {
          return (
            <button
              onClick={() => setPaymentInvite(r)}
              title="Record the tenant's last payment to calculate arrears"
              className="flex h-7 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-xs font-medium text-primary hover:bg-primary/20"
            >
              <Wallet className="h-3.5 w-3.5" />
              Record Payment
            </button>
          )
        }
        return null
      },
    },
  ]

  const propertyOptions = [
    { value: '', label: 'All properties' },
    ...properties.map((p) => ({ value: p.id, label: p.name })),
  ]

  return (
    <>
      <Helmet><title>Room Invites — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="p-6">
        <PageHeader
          title="Room Invites"
          subtitle="Generate a PDF of vacant rooms to onboard existing tenants onto online rent payment."
          actions={
            <Button onClick={() => { setGenPropertyId(currentProperty?.uuid ?? ''); setGenerateOpen(true) }}>
              <Plus className="mr-1.5 h-4 w-4" />
              Generate Invites
            </Button>
          }
        />

        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3.5 dark:border-emerald-800/40 dark:from-emerald-950/20 dark:to-teal-950/20">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-emerald-900 dark:text-emerald-300">No security deposit for self-onboarding</p>
            <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-400/80">
              These links are for tenants already living in the property — they are never charged a deposit when they register themselves.
              After a tenant self-onboards, open their lease and use <span className="font-medium">Record Payment</span> to capture their last paid month and reveal any arrears.
            </p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total"      value={analytics?.total ?? 0}                 icon={<Link2 className="h-4 w-4 text-primary" />}         iconBg="bg-primary/10"                       loading={!analytics} />
          <StatCard label="Pending"    value={analytics?.pending ?? 0}               icon={<ChevronRight className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-50 dark:bg-amber-950/40"    loading={!analytics} />
          <StatCard label="Used"       value={analytics?.used ?? 0}                  icon={<Check className="h-4 w-4 text-emerald-600" />}      iconBg="bg-emerald-50 dark:bg-emerald-950/40" loading={!analytics} />
          <StatCard label="Conversion" value={`${analytics?.conversion_rate ?? 0}%`}  icon={<BarChart3 className="h-4 w-4 text-violet-600" />}   iconBg="bg-violet-50 dark:bg-violet-950/40"  loading={!analytics} />
        </div>

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

        {tab === 'exports' && (
          exportsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-muted/40" />
              ))}
            </div>
          ) : exports.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">No PDF exports yet</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">Generate bulk invites to create a shareable PDF of vacant rooms.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {exports.map((r) => (
                <div key={r.uuid} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                  <div className="bg-gradient-to-br from-primary/10 to-violet-500/10 px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-primary" />
                      <p className="truncate text-sm font-semibold text-foreground">{r.property_name ?? `Property #${r.property_id}`}</p>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 px-4 py-3.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Home className="h-3.5 w-3.5" />
                      <span>{r.invite_count} room{r.invite_count === 1 ? '' : 's'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Expires {formatDate(r.expires_at)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70">Generated {formatDatetime(r.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 border-t border-border px-3 py-2.5">
                    <button
                      onClick={() => void openWhatsApp(r.uuid)}
                      disabled={waLoading}
                      title="Share to a WhatsApp group"
                      className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Group
                    </button>
                    <button
                      onClick={() => openContactShare(r)}
                      title="Share to individual phone numbers"
                      className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Individual
                    </button>
                    <button
                      onClick={() => void downloadPdf(r.uuid)}
                      disabled={downloading === r.uuid}
                      title="Download PDF"
                      className="flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {downloading === r.uuid
                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        : <Download className="h-3.5 w-3.5" />}
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

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
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <Check className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{genResult.invite_count} invite links created</p>
                <p className="text-xs text-muted-foreground">Expires {formatDate(genResult.expires_at)}</p>
              </div>
            </div>

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
            <FormField label="Property" htmlFor="mgen-property" required>
              <Select
                id="mgen-property"
                value={genPropertyId}
                onChange={(e) => setGenPropertyId(e.target.value)}
                options={[
                  { value: '', label: 'Select a property…' },
                  ...properties.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </FormField>
            <FormField label="Link expiry" htmlFor="mgen-expiry" hint="Links expire after this many days.">
              <Select
                id="mgen-expiry"
                value={genExpiry}
                onChange={(e) => setGenExpiry(e.target.value)}
                options={EXPIRY_OPTIONS}
              />
            </FormField>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800/40 dark:bg-blue-950/20">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                One link will be generated per vacant room. A PDF with all links will be provided after generation —
                use it to onboard tenants who are already renting so they can move onto online rent payment.
              </p>
            </div>
          </div>
        )}
      </Modal>

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
            onError: (err) => { handleLockedError(err, 'Failed to revoke invite'); setRevokeTarget(null) },
          })
        }}
        onClose={() => setRevokeTarget(null)}
      />

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
            onError: (err) => { handleLockedError(err, 'Failed to revoke invites'); setRevokeAllPropId(null) },
          })
        }}
        onClose={() => setRevokeAllPropId(null)}
      />

      <Modal
        open={!!contactShareExport}
        onClose={closeContactShare}
        title="Share via WhatsApp"
        size="sm"
        footer={
          contactLinks ? (
            <Button className="w-full" onClick={closeContactShare}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={closeContactShare}>Cancel</Button>
              <Button loading={contactSharing} disabled={!contactPhones.trim()} onClick={() => void submitContactShare()}>
                Generate Links
              </Button>
            </>
          )
        }
      >
        {contactLinks ? (
          <div className="space-y-2">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{Object.keys(contactLinks).length} link{Object.keys(contactLinks).length === 1 ? '' : 's'} ready to send</span>
            </div>
            {Object.entries(contactLinks).map(([phone, link]) => (
              <div key={phone} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                <span className="text-xs font-medium text-foreground">{phone}</span>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-500 px-2.5 text-xs font-medium text-white hover:bg-emerald-600"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Property: <span className="font-medium text-foreground">{contactShareExport?.property_name ?? `#${contactShareExport?.property_id}`}</span>
            </p>
            <FormField label="Phone numbers" htmlFor="contact-phones" hint="One per line or comma-separated, e.g. +254712345678">
              <textarea
                id="contact-phones"
                value={contactPhones}
                onChange={(e) => setContactPhones(e.target.value)}
                rows={4}
                placeholder={'+254712345678\n+254798765432'}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </FormField>
            {contactShareError && <p className="text-xs text-destructive">{contactShareError}</p>}
          </div>
        )}
      </Modal>

      <Modal
        open={!!paymentInvite}
        onClose={closePaymentModal}
        title="Record Last Payment"
        description="This tenant self-onboarded and was not charged a deposit. Enter when and how much they last paid so the system can calculate any arrears."
        size="sm"
        footer={
          paymentResult ? (
            <Button className="w-full" onClick={closePaymentModal}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={closePaymentModal}>Cancel</Button>
              <Button
                loading={recordingPayment}
                disabled={!paidAmount}
                onClick={() => {
                  const leaseUuid = paymentInvite?.used_by?.lease_uuid
                  if (!leaseUuid) return
                  recordPayment(
                    { id: leaseUuid, last_paid_date: paidDate, last_paid_amount: Number(paidAmount), notes: paidNotes || undefined },
                    {
                      onSuccess: (res) => { setPaymentResult(res.data); success('Last payment recorded') },
                      onError: (err) => handleLockedError(err, 'Failed to record payment'),
                    }
                  )
                }}
              >
                Save
              </Button>
            </>
          )
        }
      >
        {paymentResult ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Unpaid months</p>
              <p className="text-sm font-semibold text-foreground">{paymentResult.unpaid_months}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Total owed</p>
              <p className="text-sm font-semibold text-foreground">{formatCurrency(paymentResult.total_owed)}</p>
            </div>
            {paymentResult.excess_applied > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Overpayment applied to arrears</p>
                <p className="text-sm font-semibold text-emerald-600">{formatCurrency(paymentResult.excess_applied)}</p>
              </div>
            )}
            <div className={`rounded-lg border p-3 ${paymentResult.arrears_balance > 0 ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'}`}>
              <p className="text-xs text-muted-foreground">Arrears balance</p>
              <p className={`text-lg font-bold ${paymentResult.arrears_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(paymentResult.arrears_balance)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {paymentResult.arrears_balance > 0
                  ? "This is due immediately and shows on the tenant's portal now."
                  : 'Tenant is fully paid up to date.'}
              </p>
            </div>
          </div>
        ) : (
          <form className="space-y-4">
            <FormField label="Last Paid Date" htmlFor="inv-pplast_date" required>
              <Input id="inv-pplast_date" type="date" max={new Date().toISOString().slice(0, 10)} value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </FormField>
            <FormField label="Amount Last Paid" htmlFor="inv-pplast_amount" required>
              <Input id="inv-pplast_amount" type="number" min={0} step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
            </FormField>
            <FormField label="Notes" htmlFor="inv-ppnotes" hint="Optional">
              <Textarea id="inv-ppnotes" rows={2} value={paidNotes} onChange={(e) => setPaidNotes(e.target.value)} />
            </FormField>
          </form>
        )}
      </Modal>

      <PermissionDeniedModal block={permissionDenied} onClose={() => setPermissionDenied(null)} />
    </>
  )
}
