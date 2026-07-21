import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, BedDouble, Building2, CheckCircle, Eye, EyeOff, Loader2, MapPin } from 'lucide-react'
import { invitePublicApi, type InviteTokenData } from '@/api/invites'
import { useAuthStore } from '@/store/auth.store'
import { normalizeDashboardPath } from '@/auth/routeAccess'
import type { AuthUser } from '@/types'
import { formatCurrency } from '@/utils/format'

const schema = z.object({
  name:                  z.string().min(2, 'Full name is required'),
  email:                 z.string().email('Valid email required'),
  phone:                 z.string().min(7, 'Phone number required'),
  password:              z.string().min(8, 'Minimum 8 characters'),
  password_confirmation: z.string().min(1, 'Please confirm your password'),
  emergency_name:        z.string().optional(),
  emergency_phone:       z.string().optional(),
  terms_accepted:        z.boolean(),
}).refine((d) => d.password === d.password_confirmation, {
  message: 'Passwords do not match',
  path: ['password_confirmation'],
}).refine((d) => d.terms_accepted === true, {
  message: 'You must accept the Terms of Service and Privacy Policy to continue',
  path: ['terms_accepted'],
})

type FormValues = z.infer<typeof schema>

type ErrorState =
  | { type: 'not_found' }
  | { type: 'used' }
  | { type: 'expired' }
  | { type: 'unknown'; message: string }

export default function InviteRegister(): React.ReactElement {
  const { token } = useParams<{ token: string }>()
  const navigate  = useNavigate()
  const setAuth   = useAuthStore((s) => s.setAuth)

  const [inviteData, setInviteData]   = useState<InviteTokenData | null>(null)
  const [loadError, setLoadError]     = useState<ErrorState | null>(null)
  const [loading, setLoading]         = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({})
  const [done, setDone]               = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  // Load invite data
  useEffect(() => {
    if (!token) { setLoadError({ type: 'not_found' }); setLoading(false); return }
    invitePublicApi.get(token).then((res) => {
      if (res.success && res.data) {
        setInviteData(res.data)
      } else {
        setLoadError({ type: 'unknown', message: res.message ?? 'Failed to load invite.' })
      }
    }).catch((err: { status?: number; message?: string }) => {
      if (err?.status === 404) setLoadError({ type: 'not_found' })
      else if (err?.status === 410) {
        const msg = err?.message ?? ''
        setLoadError(msg.toLowerCase().includes('used') ? { type: 'used' } : { type: 'expired' })
      } else {
        setLoadError({ type: 'unknown', message: err?.message ?? 'Failed to load invite.' })
      }
    }).finally(() => setLoading(false))
  }, [token])

  // Derive branding colors (with safe fallbacks)
  const branding  = inviteData?.branding
  const primary   = branding?.primary_color ?? '#6d28d9'
  const secondary = branding?.secondary_color ?? '#4338ca'

  const onSubmit = async (values: FormValues) => {
    if (!token) return
    setSubmitError(null)
    setFieldErrors({})
    try {
      const res = await invitePublicApi.register(token, {
        name:                  values.name,
        email:                 values.email,
        phone:                 values.phone,
        password:              values.password,
        password_confirmation: values.password_confirmation,
        emergency_name:        values.emergency_name || undefined,
        emergency_phone:       values.emergency_phone || undefined,
        terms_accepted:        values.terms_accepted,
      })
      if (res.success && res.data) {
        setDone(true)
        setAuth(res.data.token, res.data.user as unknown as AuthUser)
        window.setTimeout(() => {
          navigate(normalizeDashboardPath(res.data!.user as unknown as AuthUser), { replace: true })
        }, 1500)
      } else {
        setSubmitError(res.message ?? 'Registration failed.')
      }
    } catch (err: unknown) {
      const apiErr = err as { status?: number; data?: { errors?: Record<string, string[]>; message?: string }; message?: string }
      if (apiErr?.status === 422 && apiErr?.data?.errors) {
        const flat: Record<string, string> = {}
        for (const [key, msgs] of Object.entries(apiErr.data.errors)) {
          flat[key] = Array.isArray(msgs) ? msgs[0] : String(msgs)
        }
        setFieldErrors(flat)
      } else if (apiErr?.status === 410) {
        setLoadError({ type: 'expired' })
      } else {
        setSubmitError(apiErr?.data?.message ?? apiErr?.message ?? 'Registration failed.')
      }
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Error states ───────────────────────────────────────────────────────────

  if (loadError) {
    const config = {
      not_found: { icon: '🔗', title: 'Invalid Link',       body: 'This invite link does not exist or has been removed.' },
      used:      { icon: '✅', title: 'Already Registered', body: 'This invite link has already been used to create an account.' },
      expired:   { icon: '⏰', title: 'Link Expired',       body: 'This invite link has expired or been revoked. Please contact your property manager.' },
      unknown:   { icon: '⚠️', title: 'Something went wrong', body: loadError.type === 'unknown' ? loadError.message : 'An unexpected error occurred.' },
    }[loadError.type]

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="rounded-full bg-muted p-5 text-3xl">{config.icon}</div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">{config.title}</h1>
          <p className="max-w-sm text-sm text-muted-foreground">{config.body}</p>
        </div>
      </div>
    )
  }

  const room     = inviteData!.room
  const property = inviteData!.property

  // ── Success state ──────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">Welcome aboard!</h1>
          <p className="text-sm text-muted-foreground">Account created. Redirecting to your dashboard…</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Main registration page ─────────────────────────────────────────────────

  return (
    <>
      <Helmet>
        <title>Join {branding?.property_name ?? property.name} — StayLynk</title>
      </Helmet>

      <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[420px_1fr]">

        {/* ── Left panel: branding + room info ── */}
        <div
          className="flex flex-col gap-6 p-8 text-white lg:min-h-dvh"
          style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}
        >
          {/* Logo / property name */}
          <div className="flex items-center gap-3">
            {branding?.logo_url ? (
              <img src={branding.logo_url} alt="Logo" className="h-10 w-10 rounded-lg object-contain bg-white/10 p-1" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-lg font-bold">
                {(branding?.property_name ?? property.name).charAt(0)}
              </div>
            )}
            <div>
              <p className="text-sm font-bold leading-tight">{branding?.property_name ?? property.name}</p>
              {branding?.tagline && <p className="text-xs text-white/70">{branding.tagline}</p>}
            </div>
          </div>

          {/* Room card */}
          <div className="rounded-2xl bg-white/15 p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/70">
              <BedDouble className="h-3.5 w-3.5" />
              Your Room
            </div>
            <p className="mb-1 text-3xl font-bold">Room {room.number}</p>
            {(room.floor || room.block) && (
              <p className="mb-3 text-sm text-white/80">
                {room.floor && `Floor ${room.floor}`}{room.floor && room.block && ' · '}{room.block && `Block ${room.block}`}
              </p>
            )}
            {room.type && (
              <div className="mb-3 inline-flex rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium">
                {room.type}
              </div>
            )}
            <div className="border-t border-white/20 pt-3">
              <p className="text-2xl font-bold">{formatCurrency(room.rent, 'KES')}<span className="ml-1 text-sm font-normal text-white/70">/month</span></p>
            </div>
            {Array.isArray(room.amenities) && room.amenities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {room.amenities.slice(0, 6).map((a) => (
                  <span key={a} className="rounded-full bg-white/15 px-2 py-0.5 text-xs text-white/90">{a}</span>
                ))}
              </div>
            )}
          </div>

          {/* Property info */}
          <div className="flex items-start gap-2 text-sm text-white/80">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
            <span>{[property.address, property.city].filter(Boolean).join(', ')}</span>
          </div>

          <div className="mt-auto flex items-center gap-1.5 text-xs text-white/50">
            <Building2 className="h-3.5 w-3.5" />
            Powered by StayLynk
          </div>
        </div>

        {/* ── Right panel: registration form ── */}
        <div className="flex items-start justify-center px-4 py-10 lg:items-center">
          <div className="w-full max-w-md">
            <h1 className="mb-1 text-2xl font-bold text-foreground">Create your account</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              You&apos;ve been invited to Room {room.number} at {branding?.property_name ?? property.name}.
            </p>

            {submitError && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-xs text-destructive">{submitError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Personal info */}
              <div className="space-y-3">
                <Field label="Full Name" error={errors.name?.message ?? fieldErrors.name} required>
                  <input {...register('name')} placeholder="Jane Tenant" className={inputCls(!!errors.name || !!fieldErrors.name)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email" error={errors.email?.message ?? fieldErrors.email} required>
                    <input {...register('email')} type="email" placeholder="jane@example.com" className={inputCls(!!errors.email || !!fieldErrors.email)} />
                  </Field>
                  <Field label="Phone" error={errors.phone?.message ?? fieldErrors.phone} required>
                    <input {...register('phone')} type="tel" placeholder="+254712345678" className={inputCls(!!errors.phone || !!fieldErrors.phone)} />
                  </Field>
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Password" error={errors.password?.message ?? fieldErrors.password} required>
                  <div className="relative">
                    <input {...register('password')} type={showPassword ? 'text' : 'password'} placeholder="Min. 8 characters" className={`${inputCls(!!errors.password || !!fieldErrors.password)} pr-9`} />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm Password" error={errors.password_confirmation?.message ?? fieldErrors.password_confirmation} required>
                  <div className="relative">
                    <input {...register('password_confirmation')} type={showConfirm ? 'text' : 'password'} placeholder="Repeat password" className={`${inputCls(!!errors.password_confirmation)} pr-9`} />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
              </div>

              {/* Emergency contact (optional) */}
              <details className="group">
                <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">
                  + Emergency Contact <span className="font-normal">(optional)</span>
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Emergency Name">
                    <input {...register('emergency_name')} placeholder="John Doe" className={inputCls(false)} />
                  </Field>
                  <Field label="Emergency Phone">
                    <input {...register('emergency_phone')} type="tel" placeholder="+254798..." className={inputCls(false)} />
                  </Field>
                </div>
              </details>

              <div>
                <label htmlFor="terms_accepted" className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    id="terms_accepted"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-2 focus:ring-primary/40 focus:ring-offset-0"
                    {...register('terms_accepted')}
                  />
                  <span className="text-xs text-muted-foreground">
                    I have read and agree to the{' '}
                    <a href="/terms" target="_blank" rel="noopener" className="font-medium text-primary hover:underline">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" target="_blank" rel="noopener" className="font-medium text-primary hover:underline">Privacy Policy</a>.
                  </span>
                </label>
                {errors.terms_accepted && (
                  <p className="mt-1.5 text-[11px] text-destructive" role="alert">{errors.terms_accepted.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Creating account…' : 'Create Account & Join'}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{' '}
                <a href="/login" className="font-medium text-primary hover:underline">Sign in</a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  )
}

function inputCls(hasError: boolean): string {
  return [
    'block w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground',
    'focus:ring-2 focus:ring-offset-0',
    hasError
      ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
      : 'border-border focus:border-primary focus:ring-primary/20',
  ].join(' ')
}
