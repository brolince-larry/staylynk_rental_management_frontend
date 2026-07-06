import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Pin, Globe, Eye, EyeOff, Trash2, Edit2, Plus, Send, ChevronLeft, ChevronRight } from 'lucide-react'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { Button, FormField, Input, Modal, Select, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge } from '@/components/ui'
import { usePagination, useToast } from '@/hooks'
import { formatDatetime } from '@/utils/format'
import {
  useSAnnouncements, useCreateSAnnouncement, useUpdateSAnnouncement,
  useDeleteSAnnouncement, usePublishSAnnouncement, useUnpublishSAnnouncement,
  type SAnnouncement,
} from '../hooks/useAnnouncements'

const AUDIENCE_OPTIONS = [
  { value: 'admins',   label: 'Admins only' },
  { value: 'all',      label: 'All (admins, managers, tenants)' },
  { value: 'managers', label: 'Managers only' },
  { value: 'tenants',  label: 'Tenants only' },
]

export default function SuperAdminAnnouncementsPage(): React.ReactElement {
  const [modalOpen, setModalOpen]       = useState(false)
  const [editing, setEditing]           = useState<SAnnouncement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SAnnouncement | null>(null)
  const { page, setPage, perPage, setPerPage } = usePagination()
  const { toasts, success, error: toastError, dismiss } = useToast()

  const [title, setTitle]         = useState('')
  const [content, setContent]     = useState('')
  const [audience, setAudience]   = useState('admins')
  const [isPinned, setIsPinned]   = useState(false)
  const [publishNow, setPublishNow] = useState(true)
  const [expiresAt, setExpiresAt] = useState('')

  const { data, isLoading } = useSAnnouncements({ page, per_page: perPage })
  const { mutate: create, isPending: creating } = useCreateSAnnouncement()
  const { mutate: update, isPending: updating } = useUpdateSAnnouncement()
  const { mutate: remove, isPending: deleting } = useDeleteSAnnouncement()
  const { mutate: publish }   = usePublishSAnnouncement()
  const { mutate: unpublish } = useUnpublishSAnnouncement()

  const rows = data?.data ?? []
  const meta = data?.meta as Record<string, number> | undefined

  const openCreate = () => {
    setEditing(null)
    setTitle(''); setContent(''); setAudience('admins')
    setIsPinned(false); setPublishNow(true); setExpiresAt('')
    setModalOpen(true)
  }

  const openEdit = (a: SAnnouncement) => {
    setEditing(a)
    setTitle(a.title); setContent(a.content); setAudience(a.audience)
    setIsPinned(a.is_pinned); setPublishNow(false)
    setExpiresAt(a.expires_at?.slice(0, 16) ?? '')
    setModalOpen(true)
  }

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      title, content, audience, is_pinned: isPinned,
      publish_now: publishNow ? true : undefined,
      expires_at: expiresAt || undefined,
    }

    if (editing) {
      update({ id: editing.id, data: payload }, {
        onSuccess: () => { success('Updated'); setModalOpen(false) },
        onError: (e) => toastError(e, 'Failed to update'),
      })
    } else {
      create(payload, {
        onSuccess: () => { success(publishNow ? 'Broadcast sent!' : 'Saved as draft'); setModalOpen(false) },
        onError: (e) => toastError(e, 'Failed to create'),
      })
    }
  }

  const isPublished = (a: SAnnouncement) => !!a.published_at

  const columns: ColumnDef<SAnnouncement>[] = [
    {
      key: 'title', header: 'Announcement',
      accessor: (row) => (
        <div className="max-w-xs">
          <div className="flex items-center gap-1.5">
            {row.is_pinned && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
            <p className="truncate text-xs font-semibold text-foreground">{row.title}</p>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.content.slice(0, 80)}…</p>
        </div>
      ),
    },
    {
      key: 'audience', header: 'Audience',
      accessor: (row) => (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs capitalize text-muted-foreground">
          <Globe className="h-3 w-3" />{row.audience}
        </span>
      ),
    },
    {
      key: 'scope', header: 'Scope',
      accessor: (row) => (
        <span className="text-xs text-muted-foreground">{row.org_id ? `Org #${row.org_id}` : 'Platform-wide'}</span>
      ),
    },
    {
      key: 'status', header: 'Status',
      accessor: (row) => <StatusBadge status={isPublished(row) ? 'published' : 'draft'} />,
    },
    {
      key: 'published_at', header: 'Sent',
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
          <button onClick={() => openEdit(row)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          {isPublished(row) ? (
            <button onClick={() => unpublish(row.id, { onSuccess: () => success('Unpublished'), onError: (e) => toastError(e, 'Failed') })} className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50">
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button onClick={() => publish(row.id, { onSuccess: () => success('Sent!'), onError: (e) => toastError(e, 'Failed') })} className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50">
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={() => setDeleteTarget(row)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <Helmet><title>Announcements — SuperAdmin</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="p-6">
        <PageHeader
          title="Platform Announcements"
          subtitle="Broadcast notices to admins, managers, tenants, or all users across the platform."
          actions={
            <Button onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> New Broadcast
            </Button>
          }
        />

        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          loading={isLoading}
          emptyTitle="No announcements"
          emptyDescription="Create a broadcast to notify all admins or specific audiences."
          pagination={meta ? {
            total: meta.total ?? rows.length,
            per_page: perPage,
            current_page: page,
            last_page: meta.last_page ?? 1,
          } : undefined}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          caption="Announcements"
        />
      </div>

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Announcement' : 'New Broadcast'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={creating || updating} disabled={!title || !content} onClick={handleSubmit}>
              <Send className="h-3.5 w-3.5" />
              {editing ? 'Save Changes' : publishNow ? 'Send Now' : 'Save Draft'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Title" htmlFor="sa-ann-title" required>
            <Input id="sa-ann-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} placeholder="e.g. Scheduled maintenance on Sunday" />
          </FormField>

          <FormField label="Message" htmlFor="sa-ann-content" required>
            <Textarea id="sa-ann-content" rows={4} value={content} onChange={(e) => setContent(e.target.value)} maxLength={5000} placeholder="Write your broadcast message…" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Audience" htmlFor="sa-ann-audience">
              <Select id="sa-ann-audience" value={audience} onChange={(e) => setAudience(e.target.value)} options={AUDIENCE_OPTIONS} />
            </FormField>
            <FormField label="Expires at" htmlFor="sa-ann-exp" hint="Optional">
              <Input id="sa-ann-exp" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </FormField>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="sa-ann-pin" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="rounded" />
            <label htmlFor="sa-ann-pin" className="cursor-pointer text-sm text-foreground">Pin this announcement</label>
          </div>

          {!editing && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
              <input type="checkbox" id="sa-ann-now" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} className="rounded" />
              <label htmlFor="sa-ann-now" className="cursor-pointer text-sm text-foreground">Send immediately after saving</label>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete confirm */}
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
              onClick={() => deleteTarget && remove(deleteTarget.id, {
                onSuccess: () => { success('Deleted'); setDeleteTarget(null) },
                onError: (e) => toastError(e, 'Failed to delete'),
              })}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          "<strong className="text-foreground">{deleteTarget?.title}</strong>" will be permanently deleted.
        </p>
      </Modal>
    </>
  )
}
