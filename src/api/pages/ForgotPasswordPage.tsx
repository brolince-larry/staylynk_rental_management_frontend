import React, { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Building2, CheckCircle, Loader2, MailCheck } from 'lucide-react'
import { authApi } from '@/api/auth'
import { PasswordStrengthMeter } from '@/components/shared/PasswordStrengthMeter'
import { forgotPasswordSchema, resetPasswordSchema, type ForgotPasswordSchema, type ResetPasswordSchema } from '@/schemas/auth.schema'
import { getErrorMessage } from '@/utils/errors'

type Step = 'email' | 'reset' | 'done'

export default function ForgotPasswordPage(): React.ReactElement {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const emailForm = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const resetForm = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '', code: '', password: '', password_confirmation: '' },
  })

  const newPassword = resetForm.watch('password', '')
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const digitRefs = useRef<(HTMLInputElement | null)[]>([])

  const onSubmitEmail = async (data: ForgotPasswordSchema) => {
    setLoading(true)
    setServerError(null)
    try {
      // A success response here always means the same generic message,
      // whether or not the email exists — that ambiguity is intentional
      // and handled server-side. A thrown error means the request itself
      // failed (network/rate-limit/server error), worth showing.
      await authApi.forgotPassword(data.email)
      setEmail(data.email)
      resetForm.setValue('email', data.email)
      setStep('reset')
    } catch (err: unknown) {
      setServerError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDigitChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = char
    setDigits(next)
    resetForm.setValue('code', next.join(''), { shouldValidate: true })
    if (char && index < 5) {
      digitRefs.current[index + 1]?.focus()
    }
  }

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus()
    }
  }

  const onSubmitReset = async (data: ResetPasswordSchema) => {
    setLoading(true)
    setServerError(null)
    try {
      await authApi.resetPassword({
        email: email,
        code: data.code,
        password: data.password,
        password_confirmation: data.password_confirmation,
      })
      setStep('done')
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
            {step === 'done' ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <MailCheck className="h-6 w-6 text-emerald-400" />
                </div>
                <h1 className="text-xl font-bold text-white">Password reset</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Your password has been changed. You can now sign in with your new password.
                </p>
                <Link
                  to="/login"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-400 transition-colors hover:text-violet-300"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </Link>
              </div>
            ) : step === 'reset' ? (
              <>
                <div className="mb-7">
                  <h1 className="text-2xl font-bold text-white">Enter verification code</h1>
                  <p className="mt-1 text-sm text-slate-400">
                    We sent a 6-digit code to <span className="text-slate-300">{email}</span>. It expires in 5 minutes.
                  </p>
                </div>

                {serverError && (
                  <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <p className="text-sm text-red-300">{serverError}</p>
                  </div>
                )}

                <form onSubmit={resetForm.handleSubmit(onSubmitReset)} noValidate className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-300">Verification code</label>
                    <div className="flex justify-between gap-2">
                      {digits.map((d, i) => (
                        <input
                          key={i}
                          ref={(el) => { digitRefs.current[i] = el }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={d}
                          autoFocus={i === 0}
                          onChange={(e) => handleDigitChange(i, e.target.value)}
                          onKeyDown={(e) => handleDigitKeyDown(i, e)}
                          className="h-12 w-11 rounded-xl border border-white/[0.1] bg-white/[0.06] text-center text-lg font-semibold text-white outline-none transition-all hover:border-white/[0.18] focus:border-violet-500/60 focus:bg-white/[0.09] focus:ring-1 focus:ring-violet-500/20"
                        />
                      ))}
                    </div>
                    {resetForm.formState.errors.code && (
                      <p role="alert" className="text-xs text-red-400">{resetForm.formState.errors.code.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="new-password" className="block text-sm font-medium text-slate-300">
                      New password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className={[
                        'h-11 w-full rounded-xl border bg-white/[0.06] px-4 text-sm text-white outline-none',
                        'placeholder:text-slate-600 transition-all',
                        'focus:bg-white/[0.09] focus:ring-1',
                        resetForm.formState.errors.password
                          ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20'
                          : 'border-white/[0.1] hover:border-white/[0.18] focus:border-violet-500/60 focus:ring-violet-500/20',
                      ].join(' ')}
                      {...resetForm.register('password')}
                    />
                    <PasswordStrengthMeter password={newPassword} />
                    {resetForm.formState.errors.password && (
                      <p role="alert" className="text-xs text-red-400">{resetForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="confirm-new-password" className="block text-sm font-medium text-slate-300">
                      Confirm new password
                    </label>
                    <input
                      id="confirm-new-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className={[
                        'h-11 w-full rounded-xl border bg-white/[0.06] px-4 text-sm text-white outline-none',
                        'placeholder:text-slate-600 transition-all',
                        'focus:bg-white/[0.09] focus:ring-1',
                        resetForm.formState.errors.password_confirmation
                          ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20'
                          : 'border-white/[0.1] hover:border-white/[0.18] focus:border-violet-500/60 focus:ring-violet-500/20',
                      ].join(' ')}
                      {...resetForm.register('password_confirmation')}
                    />
                    {resetForm.formState.errors.password_confirmation && (
                      <p role="alert" className="text-xs text-red-400">{resetForm.formState.errors.password_confirmation.message}</p>
                    )}
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
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Resetting…</>
                      : <><CheckCircle className="h-4 w-4" /> Reset password</>}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-500">
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setServerError(null) }}
                    className="inline-flex items-center gap-1.5 font-semibold text-violet-400 transition-colors hover:text-violet-300"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
                  </button>
                </p>
              </>
            ) : (
              <>
                <div className="mb-7">
                  <h1 className="text-2xl font-bold text-white">Forgot password?</h1>
                  <p className="mt-1 text-sm text-slate-400">Enter your email and we&apos;ll send you a verification code.</p>
                </div>

                {serverError && (
                  <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <p className="text-sm text-red-300">{serverError}</p>
                  </div>
                )}

                <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} noValidate className="space-y-4">
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
                        emailForm.formState.errors.email
                          ? 'border-red-500/40 focus:border-red-500/60 focus:ring-red-500/20'
                          : 'border-white/[0.1] hover:border-white/[0.18] focus:border-violet-500/60 focus:ring-violet-500/20',
                      ].join(' ')}
                      {...emailForm.register('email')}
                    />
                    {emailForm.formState.errors.email && (
                      <p role="alert" className="text-xs text-red-400">{emailForm.formState.errors.email.message}</p>
                    )}
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
                      : <><CheckCircle className="h-4 w-4" /> Send verification code</>}
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
