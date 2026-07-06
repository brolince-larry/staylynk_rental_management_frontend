// src/features/manager/pages/CheckInOut.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { useCheckInOutList, useManagerCheckIn, useManagerCheckOut } from '../hooks/index'
import { useToast } from '@/hooks'
import { FilterBar, Select, ToastContainer } from '@/components/forms'
import { PageHeader, StatusBadge } from '@/components/ui'
import { formatDate, formatDatetime } from '@/utils/format'

type Booking = Record<string, unknown>

export default function CheckInOut(): React.ReactElement {
  const [typeFilter, setTypeFilter] = useState('all')
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, refetch } = useCheckInOutList({ type: typeFilter !== 'all' ? typeFilter : undefined })
  const { mutate: checkIn,  isPending: checkingIn }  = useManagerCheckIn()
  const { mutate: checkOut, isPending: checkingOut } = useManagerCheckOut()

  const result   = data as Record<string, unknown> | undefined
  const bookings = (result?.bookings as Booking[]) ?? []

  const ICONS = {
    confirmed:  { icon: ArrowDownToLine, label: 'Check In',  color: 'text-blue-600',   bg: 'hover:bg-blue-50 dark:hover:bg-blue-950/30' },
    checked_in: { icon: ArrowUpFromLine, label: 'Check Out', color: 'text-violet-600', bg: 'hover:bg-violet-50 dark:hover:bg-violet-950/30' },
  }

  return (
    <>
      <Helmet><title>Check-In / Check-Out — Manager</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader title="Check-In / Check-Out" subtitle={`Today: ${formatDate(new Date().toISOString())}`} />

        <FilterBar>
          <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} placeholder="All" className="w-40 text-xs"
            options={[{ value:'all', label:'All Today' }, { value:'check_in', label:'Arrivals' }, { value:'check_out', label:'Departures' }]} />
        </FilterBar>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
        ) : bookings.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm font-medium text-foreground">No check-ins or check-outs today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => {
              const id     = b.id as number
              const status = b.status as string
              const action = ICONS[status as keyof typeof ICONS]
              const tenant = b.tenant as Record<string, string> | null
              const room   = b.room   as Record<string, string> | null
              const prop   = b.property as Record<string, string> | null

              return (
                <div key={id} className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
                  {/* Status icon */}
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${status === 'confirmed' ? 'bg-blue-100 dark:bg-blue-950/40' : 'bg-violet-100 dark:bg-violet-950/40'}`}>
                    {status === 'confirmed'
                      ? <ArrowDownToLine className="h-4 w-4 text-blue-600" />
                      : <ArrowUpFromLine className="h-4 w-4 text-violet-600" />}
                  </div>

                  {/* Guest info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{tenant?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{prop?.name ?? '—'} • Room {room?.room_number ?? '—'}</p>
                  </div>

                  {/* Booking # */}
                  <div className="hidden sm:block text-center">
                    <p className="text-xs text-muted-foreground">Booking</p>
                    <p className="text-xs font-mono font-medium text-foreground">{b.booking_number as string}</p>
                  </div>

                  {/* Date */}
                  <div className="hidden md:block text-center">
                    <p className="text-xs text-muted-foreground">{status === 'confirmed' ? 'Check-in' : 'Check-out'}</p>
                    <p className="text-xs font-medium text-foreground whitespace-nowrap">
                      {formatDate(status === 'confirmed' ? b.check_in_date as string : b.check_out_date as string ?? '')}
                    </p>
                  </div>

                  {/* Status badge */}
                  <StatusBadge status={status} />

                  {/* Action button */}
                  {action && (
                    <button
                      disabled={checkingIn || checkingOut}
                      onClick={() => {
                        if (status === 'confirmed') {
                          checkIn(id, {
                            onSuccess: () => { success(`${tenant?.name ?? 'Guest'} checked in`); void refetch() },
                            onError: (err) => toastError(err, 'Check-in failed'),
                          })
                        } else {
                          checkOut(id, {
                            onSuccess: () => { success(`${tenant?.name ?? 'Guest'} checked out`); void refetch() },
                            onError: (err) => toastError(err, 'Check-out failed'),
                          })
                        }
                      }}
                      className={`flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold shrink-0 transition-colors disabled:opacity-50 ${action.color} ${action.bg}`}
                    >
                      <action.icon className="h-3.5 w-3.5" />
                      {action.label}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}