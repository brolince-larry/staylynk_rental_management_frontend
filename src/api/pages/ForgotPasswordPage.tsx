import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Building2, CheckCircle, Loader2, MailCheck } from 'lucide-react'
import { authApi } from '@/api/auth'
import { forgotPasswordSchema, type ForgotPasswordSchema } from '@/schemas/auth.schema'
import { getErrorMessage } from '@/utils/errors'

export default function ForgotPasswordPage(): React.ReactElement {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordSchema) => {
    setLoading(true)
    setServerError(null)
    try {
      // A 200 here always means the same generic message, whether or not
      // the email exists — that ambiguity is intentional and handled
      // server-side. A thrown error means the request itself failed
      // (network/rate-limit/server error), which is worth telling the user
      // about rather than silently showing "check your email".
      await authApi.forgotPassword(data.email)
      setSent(true)
    } catch (err: unknown) {
      setServerError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Reset Password — StayLynk</title>
      </Helmet>

      <div className="relative flex min-h-screen items-center justify-center bg-[#07070f] px-6 py-12">
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-800/[0.08] blur-3xl" />

        <div className="relative z-10 w-full max-w-[400px]">
          <div className="mb-8 flex items-center justify-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">StayLynk</span>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 shadow-2xl shadow-black/40 backdrop-blur-2xl">
            {sent ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <MailCheck className="h-6 w-6 text-emerald-400" />
                </div>
                <h1 className="text-xl font-bold text-white">Check your email</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  If an account exists for that email, we&apos;ve sent a link to reset your password. It expires in 60 minutes.
                </p>
                <Link
                  to="/login"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-400 transition-colors hover:text-violet-300"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-7">
                  <h1 className="text-2xl font-bold text-white">Forgot password?</h1>
                  <p className="mt-1 text-sm text-slate-400">Enter your email and we&apos;ll send you a reset link.</p>
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

                  <button
                    type="submit"
                    disabled={loading}
                    className={[
                      'flex h-11 w-full items-center justify-center gap-2 rounded-xl',
                      'bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white',
                      'shadow-lg shadow-violet-900/40 transition-all',
                      'hover:shadow-violet-700/50 hover:from-violet-500 hover:to-indigo-500',
                      'active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-violet-500/40',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    ].join(' ')}
                  >
                    {loading
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                      : <><CheckCircle className="h-4 w-4" /> Send reset link</>}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-500">
                  <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-violet-400 transition-colors hover:text-violet-300">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
