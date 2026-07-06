import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Building2, Loader2, AlertCircle, TrendingUp, Users, Zap } from 'lucide-react'
import { useLogin } from '@/providers/AuthProvider'
import { loginSchema, type LoginSchema } from '@/schemas/auth.schema'
import { getErrorMessage } from '@/utils/errors'

export default function LoginPage(): React.ReactElement {
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const login = useLogin()

  const { register, handleSubmit, formState: { errors } } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginSchema) => {
    setLoading(true)
    setServerError(null)
    try {
      await login(data.email, data.password)
    } catch (err: unknown) {
      setServerError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Sign In — StayLynk</title>
        <meta name="description" content="Sign in to your StayLynk account" />
      </Helmet>

      <div className="flex min-h-screen bg-[#07070f]">
        {/* ── Left visual panel ── */}
        <div className="relative hidden overflow-hidden lg:flex lg:w-[48%] flex-col">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1e0845] via-[#10052a] to-[#07070f]" />
          <div className="absolute -top-40 -left-20 h-[500px] w-[500px] rounded-full bg-violet-700/25 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[350px] w-[350px] rounded-full bg-indigo-800/20 blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[200px] w-[200px] rounded-full bg-violet-500/10 blur-[60px]" />

          {/* Mesh grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }}
          />

          <div className="relative z-10 flex h-full flex-col justify-between p-12">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/60">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">StayLynk</span>
            </div>

            <div className="space-y-8">
              <div>
                <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-violet-300">
                  Property Management Platform
                </p>
                <h2 className="text-[2.6rem] font-extrabold leading-[1.1] tracking-tight text-white">
                  Manage your<br />
                  <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                    properties
                  </span>
                  <br />smarter.
                </h2>
                <p className="mt-5 max-w-[17rem] text-[0.9rem] leading-relaxed text-slate-400">
                  Streamline rent collection, tenant management, and property operations — all in one place.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: TrendingUp, value: '94%',  label: 'Collection rate' },
                  { icon: Zap,        value: '3×',   label: 'Faster invoicing' },
                  { icon: Users,      value: '24h',  label: 'Onboarding' },
                ].map(({ icon: Icon, value, label }) => (
                  <div key={label} className="group rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm transition-all hover:border-violet-500/30 hover:bg-violet-500/[0.08]">
                    <Icon className="mb-2 h-4 w-4 text-violet-400/70" />
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <p className="mt-0.5 text-[0.68rem] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm">
                <div className="mb-1 flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="h-3.5 w-3.5 fill-amber-400" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
                <p className="mt-2 text-[0.85rem] italic leading-relaxed text-slate-300">
                  "Collections went from 68% to 94% in the first month. StayLynk completely transformed how we operate."
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600">
                    <span className="text-[0.68rem] font-bold text-white">JM</span>
                  </div>
                  <div>
                    <p className="text-[0.8rem] font-semibold text-white">John Mwangi</p>
                    <p className="text-[0.7rem] text-slate-500">City Hostel Management</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[0.7rem] text-slate-700">© {new Date().getFullYear()} StayLynk. All rights reserved.</p>
          </div>
        </div>

        {/* ── Right form panel ── */}
        <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0e0920]/0 via-[#0e0920]/0 to-violet-950/20" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-800/[0.07] blur-3xl" />

          <div className="relative z-10 w-full max-w-[400px]">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">StayLynk</span>
            </div>

            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 shadow-2xl shadow-black/40 backdrop-blur-2xl">
              <div className="mb-7">
                <h1 className="text-2xl font-bold text-white">Welcome back</h1>
                <p className="mt-1 text-sm text-slate-400">Sign in to continue to StayLynk</p>
              </div>

              {serverError && (
                <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-sm text-red-300">{serverError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@example.com"
                    className={[
                      'h-11 w-full rounded-xl border bg-white/[0.06] px-4 text-sm text-white outline-none',
                      'placeholder:text-slate-600 transition-all',
                      'focus:bg-white/[0.09] focus:ring-1',
                      errors.email
                        ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20'
                        : 'border-white/[0.1] hover:border-white/[0.18] focus:border-violet-500/60 focus:ring-violet-500/20',
                    ].join(' ')}
                    {...register('email')}
                  />
                  {errors.email && <p role="alert" className="text-xs text-red-400">{errors.email.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-300">Password</label>
                    <Link to="/forgot-password" className="text-xs font-medium text-violet-400 transition-colors hover:text-violet-300">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className={[
                        'h-11 w-full rounded-xl border bg-white/[0.06] px-4 pr-12 text-sm text-white outline-none',
                        'placeholder:text-slate-600 transition-all',
                        'focus:bg-white/[0.09] focus:ring-1',
                        errors.password
                          ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20'
                          : 'border-white/[0.1] hover:border-white/[0.18] focus:border-violet-500/60 focus:ring-violet-500/20',
                      ].join(' ')}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(p => !p)}
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p role="alert" className="text-xs text-red-400">{errors.password.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={[
                    'relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl',
                    'bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white',
                    'shadow-lg shadow-violet-900/40 transition-all',
                    'hover:shadow-violet-700/50 hover:from-violet-500 hover:to-indigo-500',
                    'active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-violet-500/40',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  ].join(' ')}
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
                    : 'Sign in'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="font-semibold text-violet-400 transition-colors hover:text-violet-300">
                  Start free trial
                </Link>
              </p>
            </div>

            {import.meta.env.VITE_SHOW_DEMO_PANEL === 'true' && (
              <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
                <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-widest text-slate-600">Demo credentials</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {[
                    { role: 'Super Admin', email: 'superadmin@hostelhub.com' },
                    { role: 'Admin',       email: 'john.doe@cityhostel.com'  },
                    { role: 'Manager',     email: 'manager@cityhostel.com'   },
                    { role: 'Tenant',      email: 'jane.smith@demo.com'      },
                  ].map(({ role, email }) => (
                    <div key={role}>
                      <p className="text-[0.72rem] font-semibold text-violet-400">{role}</p>
                      <p className="truncate text-[0.68rem] text-slate-600">{email}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[0.67rem] text-slate-600">
                  Password: <code className="font-mono text-slate-500">password</code>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
