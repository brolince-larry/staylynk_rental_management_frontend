import React, { useId, useMemo, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { ALLOWED_IMAGE_TYPES, MAX_BULK_IMAGES, validateMediaFiles, type MediaType } from '@/services/media'

interface MediaUploadFieldProps {
  label: string
  mediaType: MediaType
  files: File[]
  onChange: (files: File[]) => void
  multiple?: boolean
  accept?: string
  disabled?: boolean
  hint?: string
  maxFiles?: number
  progress?: number | null
}

export function MediaUploadField({
  label,
  mediaType,
  files,
  onChange,
  multiple = false,
  accept = ALLOWED_IMAGE_TYPES.join(','),
  disabled = false,
  hint,
  maxFiles = multiple ? MAX_BULK_IMAGES : 1,
  progress,
}: MediaUploadFieldProps): React.ReactElement {
  const inputId = useId()
  const [error, setError] = useState<string | null>(null)
  const fileSummary = useMemo(() => files.map((file) => file.name).join(', '), [files])

  const updateFiles = (selected: FileList | null) => {
    const nextFiles = Array.from(selected ?? []).slice(0, maxFiles)
    const validation = validateMediaFiles(nextFiles, mediaType)
    setError(validation)
    onChange(validation ? [] : nextFiles)
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <label
          htmlFor={inputId}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-muted-foreground/40 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        >
          <ImagePlus className="h-4 w-4 text-primary" />
          {files.length ? `${files.length} selected` : 'Choose file'}
        </label>
        {files.length > 0 && (
          <button
            type="button"
            onClick={() => { onChange([]); setError(null) }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => updateFiles(event.target.files)}
      />
      {fileSummary && <p className="truncate text-xs text-muted-foreground">{fileSummary}</p>}
      {progress !== null && progress !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {(hint || !error) && !error && <p className="text-xs text-muted-foreground">{hint ?? (multiple ? 'Upload up to 25 images, 8MB combined.' : 'JPEG, PNG, WebP, or HEIC up to 5MB.')}</p>}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  )
}
