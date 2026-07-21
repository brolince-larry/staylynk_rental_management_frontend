import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Pin, Globe, Users, UserCog, Eye, EyeOff, Trash2, Edit2, Plus, Send, ChevronLeft, ChevronRight } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/providers/realtimeContext'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { Button, FormField, Input, Modal, Select, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge } from '@/components/ui'
import { useToast } from '@/hooks'
import { formatDatetime } from '@/utils/format'
import { propertiesApi } from '@/api/properties'
import { useAuthStore } from '@/store/auth.store'
import {
  useAnnouncements, useCreateAnnouncement, useUpdateAnnouncement,
  useDeleteAnnouncement, usePublishAnnouncement, useUnpublishAnnouncement,
  type Announcement,
} from '../layout/hooks/useAnnouncements'

const CATEGORY_OPTIONS = [
  { value: '',            label: 'No category' },
  { value: 'general',     label: 'General' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'event',       label: 'Event' },
  { value: 'urgent',      label: 'Urgent' },
]

const AUDIENCE_OPTIONS_ADMIN = [
  { value: 'tenants',  label: 'Tenants only' },
  { value: 'managers', label: 'Managers only' },
  { value: 'admins',   label: 'Admins only' },
  { value: 'all',      label: 'Everyone (tenants, managers & admins)' },
]

const AUDIENCE_OPTIONS_MANAGER = [
  { value: 'tenants', label: 'Tenants only' },
]

const CATEGORY_COLORS: Record<string, string> = {
  urgent:      'border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-400',
  maintenance: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-400',
  event:       'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/20 dark:text-blue-400',
  general:     'border-border bg-muted/40 text-muted-foreground',
}

function AudienceIcon({ audience }: { audience: string }) {
  if (audience === 'all')      return <Globe className="h-3 w-3" />
  if (audience === 'managers') return <UserCog className="h-3 w-3" />
  return <Users className="h-3 w-3" />
}

interface Props { role: 'admin' | 'manager' }

export default function AnnouncementsPage({ role }: Props): React.ReactElement {
  const isAdmin = role === 'admin'

  const [modalOpen, setModalOpen]       = useState(false)
  const [editing, setEditing]           = useState<Announcement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const { toasts, success, error: toastError, dismiss } = useToast()

  // Cursor-based navigation stack
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const [cursorIdx, setCursorIdx]     = useState(0)
  const currentCursor                 = cursorStack[cursorIdx]

  // Form state
  const [title, setTitle]           = useState('')
  const [content, setContent]       = useState('')
  const [audience, setAudience]     = useState('tenants')
  const [category, setCategory]     = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [isPinned, setIsPinned]     = useState(false)
  const [publishNow, setPublishNow] = useState(true)
  const [publishAt, setPublishAt]   = useState('')
  const [expiresAt, setExpiresAt]   = useState('')

  const queryParams = {
    per_page: 20,
    ...(currentCursor ? { cursor: currentCursor } : {}),
  }

  const { data, isLoading } = useAnnouncements(role, queryParams)
  const orgId = useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
  const { data: propertiesRes } = useQuery({
    queryKey: [role, 'announcements', 'properties', orgId],
    queryFn: () => (isAdmin ? propertiesApi.list() : propertiesApi.managerList()).then((r) => r.data),
    staleTime: Infinity,
  })
  const properties = (propertiesRes?.data ?? []) as { id: number; name: string }[]

  // Real-time: refresh the list the instant a new announcement is published,
  // instead of only picking it up on the next manual page load/refresh.
  const qc = useQueryClient()
  const { token, user } = useAuthStore()
  const { subscribePrivate } = useRealtime()
  const notificationsChannel = useMemo(() => (
    token && user?.id ? `notifications.${String(user.id)}` : null
  ), [token, user?.id])

  useEffect(() => {
    if (!notificationsChannel) return

    return subscribePrivate<{ category?: string }>(notificationsChannel, '.new.notification', (payload) => {
      if (payload.category !== 'announcement') return
      void qc.invalidateQueries({ queryKey: [role, 'announcements', orgId] })
    })
  }, [notificationsChannel, subscribePrivate, qc, role, orgId])

  const { mutate: create, isPending: creating } = useCreateAnnouncement(role)
  const { mutate: update, isPending: updating } = useUpdateAnnouncement(role)
  const { mutate: remove, isPending: deleting } = useDeleteAnnouncement(role)
  const { mutate: publish }   = usePublishAnnouncement(role)
  const { mutate: unpublish } = useUnpublishAnnouncement(role)

  const rows = data?.data ?? []
  const meta = data?.meta

  const goNext = () => {
    if (!meta?.next_cursor) return
    const next = [...cursorStack.slice(0, cursorIdx + 1), meta.next_cursor]
    setCursorStack(next)
    setCursorIdx(next.length - 1)
  }

  const goPrev = () => {
    if (cursorIdx === 0) return
    setCursorIdx((i) => i - 1)
  }

  const resetCursor = () => {
    setCursorStack([null])
    setCursorIdx(0)
  }

  const openCreate = () => {
    setEditing(null)
    setTitle(''); setContent(''); setAudience('tenants'); setCategory('')
    setPropertyId(''); setIsPinned(false); setPublishNow(true)
    setPublishAt(''); setExpiresAt('')
    setModalOpen(true)
  }

  const openEdit = (a: Announcement) => {
    setEditing(a)
    setTitle(a.title); setContent(a.content); setAudience(a.audience)
    setCategory(a.category ?? ''); setPropertyId(a.property?.id ? String(a.property.id) : '')
    setIsPinned(a.is_pinned); setPublishNow(false)
    setPublishAt(a.published_at?.slice(0, 16) ?? ''); setExpiresAt(a.expires_at?.slice(0, 16) ?? '')
    setModalOpen(true)
  }

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      title, content, audience, is_pinned: isPinned,
      category: category || undefined,
      property_id: propertyId || undefined,
      publish_now: publishNow ? true : undefined,
      published_at: !publishNow && publishAt ? publishAt : undefined,
      expires_at: expiresAt || undefined,
    }

    if (editing) {
      update({ id: editing.id, data: payload }, {
        onSuccess: () => { success('Announcement updated'); setModalOpen(false); resetCursor() },
        onError: (err) => toastError(err, 'Failed to update'),
      })
    } else {
      create(payload, {
        onSuccess: () => {
          success(publishNow ? 'Announcement published!' : 'Announcement saved as draft')
          setModalOpen(false)
          resetCursor()
        },
        onError: (err) => toastError(err, 'Failed to create'),
      })
    }
  }

  const columns: ColumnDef<Announcement>[] = [
    {
      key: 'title', header: 'Announcement',
      accessor: (row) => (
        <div className="max-w-xs">
          <div className="flex items-center gap-1.5">
            {row.is_pinned && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
            <p className="truncate text-xs font-semibold text-foreground">{row.title}</p>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.content.slice(0, 80)}…</p>
          {row.category && (
            <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${CATEGORY_COLORS[row.category] ?? CATEGORY_COLORS.general}`}>
              {row.category}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'audience', header: 'Audience',
      accessor: (row) => (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs capitalize text-muted-foreground">
          <AudienceIcon audience={row.audience} />{row.audience}
        </span>
      ),
    },
    {
      key: 'property', header: 'Property',
      accessor: (row) => <span className="text-xs text-muted-foreground">{row.property?.name ?? 'Org-wide'}</span>,
    },
    {
      key: 'status', header: 'Status',
      accessor: (row) => <StatusBadge status={row.is_published ? (row.is_expired ? 'expired' : 'published') : 'draft'} />,
    },
    {
      key: 'published_at', header: 'Published',
      accessor: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {row.published_at ? formatDatetime(row.published_at) : '—'}
        </span>
      ),
    },
    {
      key: 'actions', header: '', width: 'w-40',
      accessor: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => openEdit(row)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          {row.is_published ? (
            <button
              onClick={() => unpublish(row.id, { onSuccess: () => success('Unpublished'), onError: (e) => toastError(e, 'Failed') })}
              className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50"
              title="Unpublish"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => publish(row.id, { onSuccess: () => success('Published!'), onError: (e) => toastError(e, 'Failed') })}
              className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50"
              title="Publish"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={() => setDeleteTarget(row)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <Helmet><title>Announcements — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="p-6">
        <PageHeader
          title="Announcements"
          subtitle={isAdmin ? 'Send announcements to managers, tenants, or everyone.' : 'Send announcements to your tenants.'}
          actions={
            <Button onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> New Announcement
            </Button>
          }
        />

        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          loading={isLoading}
          emptyTitle="No announcements yet"
          emptyDescription="Create your first announcement to notify your team."
          caption="Announcements"
        />

        {/* Cursor pagination controls */}
        {(cursorIdx > 0 || meta?.has_more) && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={goPrev}
              disabled={cursorIdx === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              onClick={goNext}
              disabled={!meta?.has_more}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Create / Edit modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Announcement' : 'New Announcement'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={creating || updating} disabled={!title || !content} onClick={handleSubmit}>
              <Send className="h-3.5 w-3.5" />
              {editing ? 'Save Changes' : publishNow ? 'Publish Now' : 'Save Draft'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Title" htmlFor="ann-title" required>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              placeholder="e.g. Water supply maintenance notice"
            />
          </FormField>

          <FormField label="Message" htmlFor="ann-content" required>
            <Textarea
              id="ann-content"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
              placeholder="Write your announcement…"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Audience" htmlFor="ann-audience">
              <Select
                id="ann-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                options={isAdmin ? AUDIENCE_OPTIONS_ADMIN : AUDIENCE_OPTIONS_MANAGER}
              />
            </FormField>
            <FormField label="Category" htmlFor="ann-category">
              <Select
                id="ann-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={CATEGORY_OPTIONS}
              />
            </FormField>
          </div>

          <FormField label="Property (optional)" htmlFor="ann-property" hint="Leave blank for org-wide announcement.">
            <Select
              id="ann-property"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              options={[
                { value: '', label: 'All properties (org-wide)' },
                ...properties.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            />
          </FormField>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ann-pin"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="ann-pin" className="cursor-pointer text-sm text-foreground">
              Pin this announcement (shows at top)
            </label>
          </div>

          {!editing && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ann-now"
                  checked={publishNow}
                  onChange={(e) => setPublishNow(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="ann-now" className="cursor-pointer text-sm text-foreground">
                  Publish immediately
                </label>
              </div>
              {!publishNow && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Publish at" htmlFor="ann-pub">
                    <Input id="ann-pub" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
                  </FormField>
                  <FormField label="Expires at" htmlFor="ann-exp" hint="Optional">
                    <Input id="ann-exp" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  </FormField>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Delete confirm ── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete announcement?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              loading={deleting}
              className="bg-red-500 hover:bg-red-600"
              onClick={() =>
                deleteTarget &&
                remove(deleteTarget.id, {
                  onSuccess: () => { success('Deleted'); setDeleteTarget(null); resetCursor() },
                  onError: (e) => toastError(e, 'Failed to delete'),
                })
              }
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          "<strong className="text-foreground">{deleteTarget?.title}</strong>" will be permanently removed and recipients will no longer see it.
        </p>
      </Modal>
    </>
  )
}
