import React, { useRef, useState } from 'react'
import { Modal } from '@/components/forms'
import { isApiError } from '@/utils/errors'

export interface OtpVerifyModalProps {
  title: string
  description: string
  onSubmit: (code: string) => Promise<void>
  onClose: () => void
  digitCount?: number
}

export function OtpVerifyModal({
  title,
  description,
  onSubmit,
  onClose,
  digitCount = 6,
}: OtpVerifyModalProps): React.ReactElement {
  const [digits, setDigits] = useState<string[]>(Array(digitCount).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const submit = async (code: string) => {
    setVerifying(true)
    setError(null)
    try {
      await onSubmit(code)
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Verification failed. Please try again.')
      setDigits(Array(digitCount).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setVerifying(false)
    }
  }

  const handleChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = char
    setDigits(next)
    if (char && index < digitCount - 1) {
      inputRefs.current[index + 1]?.focus()
    }
    if (char && index === digitCount - 1) {
      const code = next.join('')
      if (code.length === digitCount) void submit(code)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <Modal open onClose={onClose} title={title} size="sm">
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <div className="flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            disabled={verifying}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="h-12 w-10 rounded-lg border border-border bg-background text-center text-lg font-semibold text-foreground disabled:opacity-50"
          />
        ))}
      </div>
      {error && <p className="mt-3 text-center text-sm text-red-500">{error}</p>}
      {verifying && <p className="mt-3 text-center text-sm text-muted-foreground">Verifying…</p>}
    </Modal>
  )
}
