// src/components/forms/index.tsx
import React, {
  useEffect,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { Search, X, Loader2 } from 'lucide-react'
import { useBodyScrollLock } from '@/hooks'

// Shared field surface — works on both white cards (modal) and light/dark mode.
// --input-surface is white in light mode (pops inside cards) and a solid dark
// tone in dark mode (readable against the card background).
const FIELD_BASE =
  'w-full rounded-lg border bg-[hsl(var(--input-surface))] px-3 py-2 text-sm text-foreground shadow-sm'
const FIELD_STATES =
  'placeholder:text-muted-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed'
const FIELD_BORDER_NORMAL = 'border-border hover:border-border/60'
const FIELD_BORDER_ERROR  = 'border-destructive focus:ring-destructive/20'

// ─── FormField ────────────────────────────────────────────────────────────
interface FormFieldProps {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function FormField({
  label, htmlFor, error, hint, required, className, children,
}: FormFieldProps): React.ReactElement {
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p
          className="text-xs text-destructive"
          role="alert"
          id={htmlFor ? `${htmlFor}-error` : undefined}
        >
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, leftIcon, rightIcon, ...props }, ref) => (
    <div className="relative">
      {leftIcon && (
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {leftIcon}
        </div>
      )}
      <input
        ref={ref}
        className={clsx(
          FIELD_BASE,
          FIELD_STATES,
          error ? FIELD_BORDER_ERROR : FIELD_BORDER_NORMAL,
          leftIcon  && 'pl-9',
          rightIcon && 'pr-9',
          className,
        )}
        {...props}
      />
      {rightIcon && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {rightIcon}
        </div>
      )}
    </div>
  ),
)
Input.displayName = 'Input'

// ─── Select ───────────────────────────────────────────────────────────────
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  placeholder?: string
  options: Array<{ value: string | number; label: string; disabled?: boolean }>
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, placeholder, options, className, ...props }, ref) => (
    <select
      ref={ref}
      className={clsx(
        FIELD_BASE,
        FIELD_STATES,
        // Explicit foreground on <option> for browsers that inherit from <select>
        '[&>option]:bg-[hsl(var(--input-surface))] [&>option]:text-foreground',
        error ? FIELD_BORDER_ERROR : FIELD_BORDER_NORMAL,
        className,
      )}
      {...props}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  ),
)
Select.displayName = 'Select'

// ─── Textarea ─────────────────────────────────────────────────────────────
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={clsx(
        FIELD_BASE,
        FIELD_STATES,
        'resize-none',
        error ? FIELD_BORDER_ERROR : FIELD_BORDER_NORMAL,
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

// ─── SearchInput ──────────────────────────────────────────────────────────
interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function SearchInput({
  value, onChange, placeholder = 'Search…', className, autoFocus,
}: SearchInputProps): React.ReactElement {
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={clsx(
          'w-full rounded-lg border bg-[hsl(var(--input-surface))] py-2 pl-8 pr-8 text-sm text-foreground shadow-sm',
          'placeholder:text-muted-foreground transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40',
          FIELD_BORDER_NORMAL,
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── FilterBar ────────────────────────────────────────────────────────────
interface FilterBarProps {
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export function FilterBar({ children, actions, className }: FilterBarProps): React.ReactElement {
  return (
    <div className={clsx('mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
        {children}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'drawer'
}

const MODAL_SM_SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  drawer: '',
}

const MODAL_ANIMATION_MS = 260

export function Modal({
  open, onClose, title, description, children, footer, size = 'md',
}: ModalProps): React.ReactElement | null {
  const [shouldRender, setShouldRender] = useState(open)
  const [isClosing, setIsClosing] = useState(false)
  const isDrawer = size === 'drawer'

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      setIsClosing(false)
      return
    }
    if (!shouldRender) return
    setIsClosing(true)
    const t = window.setTimeout(() => {
      setShouldRender(false)
      setIsClosing(false)
    }, MODAL_ANIMATION_MS)
    return () => window.clearTimeout(t)
  }, [open, shouldRender])

  // Lock body scroll to prevent page shift when the modal/drawer is open (shared
  // with every other overlay in the app via useBodyScrollLock — same reserved
  // scrollbar-width trick, no position:fixed so file-picker dialogs don't flash blank).
  useBodyScrollLock(shouldRender)

  if (!shouldRender) return null

  const panelHeader = (
    <div className="flex shrink-0 items-start justify-between border-b border-border p-5">
      <div>
        <h2 id="modal-title" className="text-base font-semibold text-foreground">
          {title}
        </h2>
        {description && (
          <p id="modal-desc" className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="ml-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )

  const panelBody = (
    <div className={clsx(
      'min-h-0 flex-1 overflow-y-auto overscroll-contain p-5',
      !footer && 'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
    )}>
      {children}
    </div>
  )

  const panelFooter = footer ? (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {footer}
    </div>
  ) : null

  // Portal to document.body so the overlay is always fixed to the real viewport —
  // never at the mercy of a transformed/animated ancestor (e.g. the page-level
  // slide-in wrapper) turning "fixed" into "fixed relative to that ancestor" instead.
  if (isDrawer) {
    return createPortal(
      <div
        className="fixed inset-0 z-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-desc' : undefined}
      >
        {/* Subtle scrim — click to close, no heavy black overlay */}
        <div
          className={clsx(
            'absolute inset-0 bg-black/20',
            isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade-in',
          )}
          onClick={onClose}
          aria-hidden
        />

        {/* Drawer panel — full height, anchored to right edge */}
        <div className={clsx(
          'app-card absolute inset-y-0 right-0 flex w-[min(92vw,44rem)] flex-col rounded-none border-l border-border shadow-2xl',
          isClosing ? 'animate-drawer-slide-out' : 'animate-drawer-slide-in',
        )}>
          {panelHeader}
          {panelBody}
          {panelFooter}
        </div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-desc' : undefined}
    >
      {/* Backdrop */}
      <div
        className={clsx(
          'absolute inset-0 bg-slate-950/50 backdrop-blur-sm',
          isClosing ? 'animate-overlay-fade-out' : 'animate-overlay-fade-in',
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel — bottom-sheet on mobile, centred dialog on sm+ */}
      <div className={clsx(
        'app-card relative flex w-full flex-col',
        'rounded-t-2xl rounded-b-none sm:rounded-2xl',
        'max-h-[90svh] sm:max-h-[90dvh]',
        isClosing
          ? 'animate-modal-sheet-down sm:animate-modal-zoom-out'
          : 'animate-modal-sheet-up sm:animate-modal-zoom-in',
        MODAL_SM_SIZES[size],
      )}>
        {/* Drag handle pill — mobile only */}
        <div className="flex shrink-0 justify-center pb-1 pt-3 sm:hidden" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
        </div>
        {panelHeader}
        {panelBody}
        {panelFooter}
      </div>
    </div>,
    document.body,
  )
}

// ─── Button ───────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  children,
  className,
  ...props
}: ButtonProps): React.ReactElement {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary:
      'app-gradient-primary text-white shadow-sm shadow-violet-500/20 hover:opacity-90 active:scale-[0.98]',
    outline:
      'border border-border bg-[hsl(var(--input-surface))] text-foreground shadow-sm hover:bg-muted hover:border-border/60',
    ghost:
      'bg-transparent text-foreground hover:bg-muted',
    destructive:
      'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  }

  return (
    <button
      disabled={disabled || loading}
      className={clsx(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
      {children}
    </button>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────
interface BadgePillProps {
  children: ReactNode
  color?: 'gray' | 'violet' | 'blue' | 'green' | 'amber' | 'red'
}

const BADGE_COLORS = {
  gray:   'bg-muted text-muted-foreground',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  amber:  'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  red:    'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
}

export function BadgePill({ children, color = 'gray' }: BadgePillProps): React.ReactElement {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
      BADGE_COLORS[color],
    )}>
      {children}
    </span>
  )
}

// ─── DateRangePicker ──────────────────────────────────────────────────────
interface DateRangePickerProps {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  className?: string
  presets?: Array<{ label: string; days: number }>
}

const DEFAULT_PRESETS = [
  { label: 'Last 7 days',  days: 7   },
  { label: 'Last 30 days', days: 30  },
  { label: 'Last 90 days', days: 90  },
  { label: 'This year',    days: 365 },
]

export function DateRangePicker({
  from, to, onFromChange, onToChange, className, presets = DEFAULT_PRESETS,
}: DateRangePickerProps): React.ReactElement {
  const applyPreset = (days: number) => {
    const toDate   = new Date()
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    onFromChange(fromDate.toISOString().slice(0, 10))
    onToChange(toDate.toISOString().slice(0, 10))
  }

  const dateInputCls =
    'rounded-lg border border-border bg-[hsl(var(--input-surface))] px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15'

  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      {presets.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => applyPreset(p.days)}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className={dateInputCls}
          aria-label="From date"
        />
        <span className="text-xs text-muted-foreground">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className={dateInputCls}
          aria-label="To date"
        />
      </div>
    </div>
  )
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'Confirm', variant = 'default', loading,
}: ConfirmDialogProps): React.ReactElement | null {
  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{description}</p>
    </Modal>
  )
}

// ─── ToastContainer ───────────────────────────────────────────────────────
import { type Toast } from '@/hooks'
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

const TOAST_STYLES = {
  success: {
    bg: 'border-emerald-200/80 bg-emerald-50/90 dark:bg-emerald-950/60 dark:border-emerald-800',
    icon: CheckCircle,
    iconCls: 'text-emerald-500',
  },
  error: {
    bg: 'border-red-200/80 bg-red-50/90 dark:bg-red-950/60 dark:border-red-800',
    icon: AlertCircle,
    iconCls: 'text-red-500',
  },
  warning: {
    bg: 'border-amber-200/80 bg-amber-50/90 dark:bg-amber-950/60 dark:border-amber-800',
    icon: AlertTriangle,
    iconCls: 'text-amber-500',
  },
  info: {
    bg: 'border-blue-200/80 bg-blue-50/90 dark:bg-blue-950/60 dark:border-blue-800',
    icon: Info,
    iconCls: 'text-blue-500',
  },
}

interface ToastContainerProps {
  toasts: Toast[]
  dismiss: (id: string) => void
}

export function ToastContainer({ toasts, dismiss }: ToastContainerProps): React.ReactElement {
  // Render into document.body via a portal so toasts are never trapped inside a
  // modal/drawer stacking context. z-[9999] ensures they float above every overlay.
  return createPortal(
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:right-5 sm:top-5"
    >
      {toasts.map((t) => {
        const { bg, icon: Icon, iconCls } = TOAST_STYLES[t.type]
        return (
          <div
            key={t.id}
            role="alert"
            className={clsx(
              'pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border p-3.5 shadow-lg backdrop-blur-sm',
              'animate-toast-slide-in motion-reduce:animate-none',
              t.type === 'success' && 'success-toast-banner',
              bg,
            )}
          >
            {t.type === 'success' && (
              <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 via-violet-500 to-amber-300" />
            )}
            <span className={clsx(
              'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              t.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/70' : 'bg-background/70',
            )}>
              {t.type === 'success' && (
                <span className="absolute h-full w-full animate-toast-celebrate rounded-full bg-emerald-400/25 motion-reduce:animate-none" />
              )}
              <Icon className={clsx('relative h-4 w-4', iconCls)} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug text-foreground">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
