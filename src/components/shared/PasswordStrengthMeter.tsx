import React from 'react'

export function getPasswordStrengthScore(password: string): number {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  return checks.filter(Boolean).length
}

const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']

function segmentColor(score: number): string {
  if (score <= 1) return 'bg-red-500'
  if (score === 2) return 'bg-amber-500'
  if (score === 3) return 'bg-blue-500'
  return 'bg-emerald-500'
}

export interface PasswordStrengthMeterProps {
  password: string
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps): React.ReactElement | null {
  if (password.length === 0) return null

  const score = getPasswordStrengthScore(password)

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={[
              'h-1 flex-1 rounded-full transition-all duration-300',
              i < score ? segmentColor(score) : 'bg-white/10',
            ].join(' ')}
          />
        ))}
      </div>
      <p className="text-[0.7rem] text-slate-500">{LABELS[score]} password</p>
    </div>
  )
}
