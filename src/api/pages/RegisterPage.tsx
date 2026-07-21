import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Helmet } from 'react-helmet-async'
import { Building2, Loader2, AlertCircle, Eye, EyeOff, CheckCircle, Shield, Globe, HeadphonesIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { normalizeDashboardPath } from '@/auth/routeAccess'
import { useAuthStore } from '@/store/auth.store'
import { registerSchema, type RegisterSchema } from '@/schemas/auth.schema'
import { isApiError } from '@/utils/errors'

export default function RegisterPage(): React.ReactElement {
  const [showPwd,     setShowPwd]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { setAuth } = useAuthStore()
  const navigate    = useNavigate()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterSchema>({ resolver: zodResolver(registerSchema) })

  const password = watch('password', '')
  const strength = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)]
  const strengthScore = strength.filter(Boolean).length

  const onSubmit = async (data: RegisterSchema) => {
    setLoading(true)
    setServerError(null)
    try {
      const res = await authApi.register(data)
      if (res.success && res.data) {
        setAuth(res.data.token, res.data.user)
        navigate(normalizeDashboardPath(res.data.user), { replace: true })
      }
    } catch (err: unknown) {
      setServerError(isApiError(err) ? err.message : 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Start Free Trial — StayLynk</title>
        <meta name="description" content="Create your StayLynk account and start managing properties today." />
      </Helmet>

      <div className="flex min-h-screen bg-[#07070f]">
        {/* ── Left visual panel ── */}
        <div className="relative hidden overflow-hidden lg:flex lg:w-[42%] flex-col">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1e0845] via-[#10052a] to-[#07070f]" />
          <div className="absolute -top-32 -left-16 h-[450px] w-[450px] rounded-full bg-violet-700/25 blur-[120px]" />
          <div className="absolute bottom-20 right-0 h-[300px] w-[300px] rounded-full bg-indigo-800/20 blur-[90px]" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }}
          />

          <div className="relative z-10 flex h-full flex-col justify-between p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/60">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">StayLynk</span>
            </div>

            <div className="space-y-8">
              <div>
                <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-violet-300">
                  30-day free trial
                </p>
                <h2 className="text-[2.4rem] font-extrabold leading-[1.1] tracking-tight text-white">
                  Start managing<br />
                  <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                    smarter
                  </span>
                  <br />today.
                </h2>
                <p className="mt-4 max-w-[17rem] text-[0.88rem] leading-relaxed text-slate-400">
                  Join hundreds of property managers who use StayLynk to automate rent collection and streamline operations.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { icon: CheckCircle, text: '30-day free trial, no credit card required' },
                  { icon: Shield,      text: 'Enterprise-grade security & data privacy' },
                  { icon: Globe,       text: 'M-Pesa and bank transfer support built in' },
                  { icon: HeadphonesIcon, text: 'Dedicated support from day one' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
                      <Icon className="h-3.5 w-3.5 text-violet-400" />
                    </div>
                    <p className="text-[0.85rem] text-slate-300">{text}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm">
                <div className="mb-1 flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="h-3.5 w-3.5 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
                <p className="mt-2 text-[0.83rem] italic leading-relaxed text-slate-300">
                  "Set up in under 10 minutes. Our rent collection went from manual WhatsApp follow-ups to fully automated."
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600">
                    <span className="text-[0.68rem] font-bold text-white">AK</span>
                  </div>
                  <div>
                    <p className="text-[0.8rem] font-semibold text-white">Alice Kamau</p>
                    <p className="text-[0.7rem] text-slate-500">Sunrise Apartments</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[0.7rem] text-slate-700">© {new Date().getFullYear()} StayLynk. All rights reserved.</p>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-12">
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-800/[0.07] blur-3xl" />

          <div className="relative z-10 w-full max-w-[440px]">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">StayLynk</span>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Create your account</h1>
              <p className="mt-1 text-sm text-slate-400">Start your 30-day free trial today.</p>
            </div>

            {serverError && (
              <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{serverError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
              {/* Organisation section */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 space-y-4 backdrop-blur-sm">
                <p className="text-[0.68rem] font-bold uppercase tracking-widest text-slate-500">Organisation</p>

                <F label="Organisation Name" id="org_name" error={errors.org_name?.message} required>
                  <DInput id="org_name" type="text" placeholder="City Hostel Management" hasError={!!errors.org_name} {...register('org_name')} />
                </F>

                <F label="Organisation Email" id="org_email" error={errors.org_email?.message} required hint="Used for billing and system notifications">
                  <DInput id="org_email" type="email" placeholder="admin@cityhoste.com" hasError={!!errors.org_email} {...register('org_email')} />
                </F>

                <F label="Organisation Phone" id="org_phone" error={errors.org_phone?.message} required hint="Contact number for your organisation">
                  <DInput id="org_phone" type="tel" placeholder="+254 700 000 000" hasError={!!errors.org_phone} {...register('org_phone')} />
                </F>
              </div>

              {/* Account section */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 space-y-4 backdrop-blur-sm">
                <p className="text-[0.68rem] font-bold uppercase tracking-widest text-slate-500">Your Account</p>

                <div className="grid grid-cols-2 gap-3">
                  <F label="Full Name" id="name" error={errors.name?.message} required>
                    <DInput id="name" type="text" placeholder="John Doe" hasError={!!errors.name} {...register('name')} />
                  </F>
                  <F label="Email Address" id="email" error={errors.email?.message} required>
                    <DInput id="email" type="email" placeholder="john@example.com" hasError={!!errors.email} {...register('email')} />
                  </F>
                </div>

                <F label="Password" id="password" error={errors.password?.message} required>
                  <div className="relative">
                    <DInput id="password" type={showPwd ? 'text' : 'password'} placeholder="••••••••" hasError={!!errors.password} className="pr-12" {...register('password')} />
                    <button type="button" onClick={() => setShowPwd(p => !p)} aria-label={showPwd ? 'Hide' : 'Show'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} className={['h-1 flex-1 rounded-full transition-all duration-300', i < strengthScore
                            ? strengthScore <= 1 ? 'bg-red-500' : strengthScore === 2 ? 'bg-amber-500' : strengthScore === 3 ? 'bg-blue-500' : 'bg-emerald-500'
                            : 'bg-white/10'].join(' ')} />
                        ))}
                      </div>
                      <p className="text-[0.7rem] text-slate-500">{['', 'Weak', 'Fair', 'Good', 'Strong'][strengthScore]} password</p>
                    </div>
                  )}
                </F>

                <F label="Confirm Password" id="password_confirmation" error={errors.password_confirmation?.message} required>
                  <div className="relative">
                    <DInput id="password_confirmation" type={showConfirm ? 'text' : 'password'} placeholder="••••••••" hasError={!!errors.password_confirmation} className="pr-12" {...register('password_confirmation')} />
                    <button type="button" onClick={() => setShowConfirm(p => !p)} aria-label={showConfirm ? 'Hide' : 'Show'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </F>
              </div>

              <div className="px-1">
                <label htmlFor="terms_accepted" className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    id="terms_accepted"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/[0.06] text-violet-600 focus:ring-2 focus:ring-violet-500/40 focus:ring-offset-0"
                    {...register('terms_accepted')}
                  />
                  <span className="text-xs text-slate-400">
                    I have read and agree to the{' '}
                    <Link to="/terms" target="_blank" className="text-violet-400 hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/privacy" target="_blank" className="text-violet-400 hover:underline">Privacy Policy</Link>.
                  </span>
                </label>
                {errors.terms_accepted && (
                  <p className="mt-1.5 text-xs text-red-400" role="alert">{errors.terms_accepted.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className={[
                  'flex h-12 w-full items-center justify-center gap-2 rounded-xl',
                  'bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white',
                  'shadow-lg shadow-violet-900/40 transition-all',
                  'hover:shadow-violet-700/50 hover:from-violet-500 hover:to-indigo-500',
                  'active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-violet-500/40',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                ].join(' ')}
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</> : 'Start free trial →'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-violet-400 hover:text-violet-300 transition-colors">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

function F({
  label, id, error, hint, required, children,
}: { label: string; id: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-300">
        {label}{required && <span className="ml-0.5 text-red-400" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[0.7rem] text-slate-600">{hint}</p>}
      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
    </div>
  )
}

const DInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }
>(({ hasError, className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={[
      'h-11 w-full rounded-xl border bg-white/[0.06] px-4 text-sm text-white outline-none',
      'placeholder:text-slate-600 transition-all',
      'focus:bg-white/[0.09] focus:ring-1',
      hasError
        ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20'
        : 'border-white/[0.1] hover:border-white/[0.18] focus:border-violet-500/60 focus:ring-violet-500/20',
      className,
    ].join(' ')}
    {...props}
  />
))
DInput.displayName = 'DInput'
