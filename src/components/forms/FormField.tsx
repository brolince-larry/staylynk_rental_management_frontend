// src/components/forms/FormField.tsx
// Wraps any input with accessible label, hint text, and error message.

import React, { type ReactNode } from 'react'
import { clsx } from 'clsx'

interface FormFieldProps {
  label:     string
  htmlFor?:  string
  error?:    string
  hint?:     string
  required?: boolean
  className?: string
  children:  ReactNode
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FormFieldProps): React.ReactElement {
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-foreground"
      >
        {label}
        {required && (
          <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
        )}
      </label>

      {children}

      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
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