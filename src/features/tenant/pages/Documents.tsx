// src/features/tenant/pages/Documents.tsx
import React, { memo } from 'react'
import { Helmet } from 'react-helmet-async'
import { FileText } from 'lucide-react'
import { useTenantDocuments } from '../hooks/index'
import { PageHeader } from '@/components/ui'
import { openSignedDocument } from '@/api/documentDownloads'
import { useToast } from '@/hooks'
import { ToastContainer } from '@/components/forms'

interface TenantDocument {
  id: number
  uuid?: string | null
  title?: string | null
  file_name?: string | null
  document_type?: string | null
  size?: number | null
  created_at?: string | null
}

const SKELETON_ROWS = Array.from({ length: 6 }, (_, i) => i)

const DocumentsSkeleton = memo(function DocumentsSkeleton(): React.ReactElement {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {SKELETON_ROWS.map((i) => (
        <div key={i} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 animate-pulse">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="h-2.5 w-3/4 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
})

const DocumentCard = memo(function DocumentCard({
  doc,
  onView,
}: {
  doc: TenantDocument
  onView: (doc: TenantDocument) => void
}): React.ReactElement {
  const filename = doc.file_name ?? doc.title ?? 'document'

  return (
    <button
      type="button"
      onClick={() => onView(doc)}
      title={filename}
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-colors hover:bg-muted/40 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/30">
        <FileText className="h-6 w-6 text-red-500" aria-hidden />
      </div>
      <p className="w-full truncate text-xs font-medium text-foreground">{filename}</p>
    </button>
  )
})

export default function Documents(): React.ReactElement {
  const { data, isLoading } = useTenantDocuments()
  const { toasts, info, error: toastError, dismiss } = useToast()
  const docs = (data as TenantDocument[] | undefined) ?? []

  const viewDocument = (doc: TenantDocument) => {
    const id = doc.uuid ?? doc.id
    void openSignedDocument(`/tenant/documents/${encodeURIComponent(String(id))}`, {
      onPending: (message) => info(message),
    }).catch((err) => toastError(err, 'Failed to open document'))
  }

  return (
    <>
      <Helmet><title>Documents - StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6 max-w-[900px]">
        <PageHeader
          title="Documents"
          subtitle="Click any document to view it."
        />

        {isLoading ? (
          <DocumentsSkeleton />
        ) : docs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" aria-hidden />
            <p className="text-sm font-medium text-foreground">No documents yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Your lease agreements and receipts will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {docs.map((doc) => (
              <DocumentCard key={doc.uuid ?? doc.id} doc={doc} onView={viewDocument} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
