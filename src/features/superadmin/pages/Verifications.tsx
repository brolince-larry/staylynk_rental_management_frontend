import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { CheckCircle, Eye, FileCheck, FileText, Loader2, X, XCircle } from 'lucide-react'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { Button, FilterBar, FormField, Modal, Select, Textarea, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge, StatCard } from '@/components/ui'
import { usePagination, useToast } from '@/hooks'
import { formatDate } from '@/utils/format'
import type { VerificationReviewItem } from '@/api/verification'
import {
  useApproveVerification,
  useRejectVerification,
  useVerifications,
  useViewVerificationDocument,
} from '../hooks/useVerifications'

interface DocViewer {
  url: string
  name: string
  mimeType: string
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

function DocumentViewerOverlay({ doc, onClose }: { doc: DocViewer; onClose: () => void }): React.ReactElement {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${doc.name}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText className="h-4 w-4 text-red-400 shrink-0" aria-hidden />
          <p className="text-sm font-medium text-white truncate">{doc.name}</p>
          <span className="text-xs text-white/40 shrink-0">{doc.mimeType}</span>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Close viewer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/40" />
          </div>
        )}

        {isImage(doc.mimeType) ? (
          <img
            src={doc.url}
            alt={doc.name}
            onLoad={() => setLoaded(true)}
            className={`h-full w-full object-contain transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <iframe
            src={doc.url}
            title={doc.name}
            onLoad={() => setLoaded(true)}
            className={`h-full w-full border-0 transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
      </div>
    </div>
  )
}

export default function Verifications(): React.ReactElement {
  const [status, setStatus] = useState('pending')
  const [reviewTarget, setReviewTarget] = useState<{ row: VerificationReviewItem; action: 'approve' | 'reject' } | null>(null)
  const [docViewer, setDocViewer] = useState<DocViewer | null>(null)
  const [reason, setReason] = useState('')
  const { page, perPage, setPage, setPerPage } = usePagination()
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError } = useVerifications({ status: status || undefined, page, per_page: perPage })
  const { mutate: viewDocument, isPending: viewing } = useViewVerificationDocument()
  const { mutate: approve, isPending: approving } = useApproveVerification()
  const { mutate: reject, isPending: rejecting } = useRejectVerification()

  const rows = data?.data ?? []
  const meta = data?.meta

  const closeReview = () => {
    setReviewTarget(null)
    setReason('')
  }

  const openDocument = (row: VerificationReviewItem, index: number, docMeta?: Record<string, unknown>) => {
    viewDocument({ id: row.id, index, reason: 'Reviewing landlord verification' }, {
      onSuccess: (res) => {
        const mimeType = String(docMeta?.mime_type ?? 'application/pdf')
        const name = String(docMeta?.original_name ?? docMeta?.type ?? 'document').replace(/_/g, ' ')
        setDocViewer({ url: res.data.url, name, mimeType })
      },
      onError: (err) => toastError(err, 'Failed to access document'),
    })
  }

  const columns: ColumnDef<VerificationReviewItem>[] = [
    {
      key: 'landlord_name', header: 'Landlord',
      accessor: (row) => (
        <div>
          <p className="text-xs font-semibold text-foreground">{row.landlord_name}</p>
          <p className="text-xs text-muted-foreground">{row.landlord_email}</p>
        </div>
      ),
    },
    {
      key: 'org_id', header: 'Org',
      accessor: (row) => <span className="text-xs font-mono text-muted-foreground">#{row.org_id}</span>,
    },
    {
      key: 'document_types', header: 'Documents',
      accessor: (row) => (
        <div className="flex flex-wrap gap-2">
          {(row.documents?.length
            ? row.documents
            : row.document_types.map((type, index) => ({ name: null, type, index, original_name: null, mime_type: null }))
          ).map((document, fallbackIndex) => {
            const index = Number((document as Record<string, unknown>).index ?? fallbackIndex)
            const filename = String(
              (document as Record<string, unknown>).original_name ??
              (document as Record<string, unknown>).name ??
              document.type ??
              'document'
            ).replace(/_/g, ' ')
            return (
              <button
                key={`${document.type}-${index}`}
                onClick={() => openDocument(row, index, document as Record<string, unknown>)}
                disabled={viewing}
                title={`Click to view: ${filename}`}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs text-foreground hover:bg-primary/10 hover:border-primary/30 transition-colors max-w-[160px] disabled:opacity-50"
              >
                {viewing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-muted-foreground" aria-hidden />
                  : <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" aria-hidden />
                }
                <span className="truncate">{filename}</span>
              </button>
            )
          })}
        </div>
      ),
    },
    {
      key: 'document_count', header: 'Count',
      accessor: (row) => <span className="text-xs text-muted-foreground">{row.document_count}</span>,
    },
    {
      key: 'status', header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'submitted_at', header: 'Submitted',
      accessor: (row) => <span className="text-xs text-muted-foreground">{row.submitted_at ? formatDate(row.submitted_at) : '—'}</span>,
    },
    {
      key: 'actions', header: '', width: 'w-36',
      accessor: (row) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setReviewTarget({ row, action: 'approve' })} className="rounded px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
            Approve
          </button>
          <button
            onClick={() => {
              setReason('Document is unclear or does not match the landlord details.')
              setReviewTarget({ row, action: 'reject' })
            }}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Reject
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <Helmet><title>Landlord Verifications — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      <div className="p-6">
        <PageHeader
          title="Landlord Verifications"
          subtitle="Review Trusted Landlord submissions with audited document access."
        />

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Results" value={meta?.total ?? rows.length} icon={<FileCheck className="h-4 w-4 text-blue-600" />} iconBg="bg-blue-100" loading={isLoading} />
          <StatCard label="Pending on Page" value={rows.filter((row) => row.status === 'pending').length} icon={<Eye className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-100" loading={isLoading} />
          <StatCard label="Trusted on Page" value={rows.filter((row) => row.status === 'trusted' || row.status === 'approved').length} icon={<CheckCircle className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-100" loading={isLoading} />
        </div>

        <FilterBar>
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="w-44 text-xs"
            options={[
              { value: '', label: 'All statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'trusted', label: 'Trusted' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          loading={isLoading}
          error={isError ? 'Failed to load verifications.' : null}
          emptyTitle="No verifications"
          emptyDescription="Submitted landlord documents will appear here."
          pagination={meta}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          caption="Landlord verifications"
        />
      </div>

      {/* Document viewer overlay */}
      {docViewer && <DocumentViewerOverlay doc={docViewer} onClose={() => setDocViewer(null)} />}

      {/* Approve / Reject modal */}
      <Modal
        open={!!reviewTarget}
        onClose={closeReview}
        title={reviewTarget?.action === 'approve' ? 'Approve Verification' : 'Reject Verification'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={closeReview}>Cancel</Button>
            <Button
              variant={reviewTarget?.action === 'reject' ? 'destructive' : 'primary'}
              loading={approving || rejecting}
              disabled={reviewTarget?.action === 'reject' && reason.trim().length < 10}
              onClick={() => {
                if (!reviewTarget) return
                if (reviewTarget.action === 'approve') {
                  approve(reviewTarget.row.id, {
                    onSuccess: () => { success('Verification approved'); closeReview() },
                    onError: (err) => toastError(err, 'Failed to approve verification'),
                  })
                  return
                }
                reject({ id: reviewTarget.row.id, reason }, {
                  onSuccess: () => { success('Verification rejected'); closeReview() },
                  onError: (err) => toastError(err, 'Failed to reject verification'),
                })
              }}
            >
              {reviewTarget?.action === 'approve' ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {reviewTarget?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        {reviewTarget?.action === 'reject' ? (
          <FormField label="Rejection Reason" htmlFor="reject-reason" hint="Minimum 10 characters." required>
            <Textarea
              id="reject-reason"
              rows={3}
              value={reason}
              placeholder="Document is unclear or does not match the landlord details."
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
        ) : (
          <p className="text-sm text-muted-foreground">Approve this submission and grant the Trusted Landlord badge?</p>
        )}
      </Modal>
    </>
  )
}
