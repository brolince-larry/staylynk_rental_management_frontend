// src/features/superadmin/pages/BlockedIPs.tsx
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSecurityBlockedIPs, useUnblockIP, useBlockIP } from '../hooks/useSecurity'
import { usePagination, useToast } from '@/hooks'
import { DataTable, type ColumnDef } from '@/components/tables/DataTable'
import { FilterBar, Modal, Button, FormField, Input, Select, ToastContainer } from '@/components/forms'
import { PageHeader } from '@/components/ui'
import { formatDatetime } from '@/utils/format'
import type { BlockedIP } from '@/api/security'
import { ShieldOff, ShieldPlus } from 'lucide-react'

export default function BlockedIPsPage(): React.ReactElement {
  const { page, perPage, setPage, setPerPage } = usePagination()
  const [typeFilter, setTypeFilter]       = useState('')
  const [unblockTarget, setUnblockTarget] = useState<BlockedIP | null>(null)
  const [addOpen, setAddOpen]             = useState(false)
  const [ipAddress, setIpAddress]         = useState('')
  const [reason, setReason]               = useState('')
  const [blockType, setBlockType]         = useState<'temporary' | 'permanent'>('temporary')
  const [duration, setDuration]           = useState('24')
  const { toasts, success, error: toastError, dismiss } = useToast()

  const { data, isLoading, isError } = useSecurityBlockedIPs({
    page, per_page: perPage,
    ...(typeFilter && { type: typeFilter }),
  })
  const { mutate: unblock, isPending: unblocking } = useUnblockIP()
  const { mutate: blockIP, isPending: blocking }   = useBlockIP()

  const rows = (data?.data ?? []) as BlockedIP[]
  const meta = data?.meta as { total: number; per_page: number; current_page: number; last_page: number } | undefined

  const columns: ColumnDef<BlockedIP>[] = [
    {
      key: 'ip_address', header: 'IP Address',
      accessor: (r) => <span className="font-mono text-xs text-foreground">{r.ip_address}</span>,
    },
    {
      key: 'type', header: 'Type',
      accessor: (r) => (
        <span className={[
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
          r.type === 'permanent'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        ].join(' ')}>
          {r.type}
        </span>
      ),
    },
    {
      key: 'reason', header: 'Reason',
      accessor: (r) => <span className="max-w-[200px] truncate text-xs text-muted-foreground">{r.reason}</span>,
    },
    {
      key: 'offense_count', header: 'Offenses',
      accessor: (r) => <span className="text-xs font-semibold tabular-nums">{r.offense_count}</span>,
    },
    {
      key: 'blocked_until', header: 'Expires',
      accessor: (r) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {r.blocked_until ? formatDatetime(r.blocked_until) : 'Permanent'}
        </span>
      ),
    },
    {
      key: 'blocked_by', header: 'Blocked By',
      accessor: (r) => <span className="text-xs text-muted-foreground">{r.blocked_by ?? 'System'}</span>,
    },
    {
      key: 'actions', header: '', width: 'w-24',
      accessor: (r) => (
        <button
          onClick={() => setUnblockTarget(r)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
        >
          <ShieldOff className="h-3 w-3" />
          Unblock
        </button>
      ),
    },
  ]

  return (
    <>
      <Helmet><title>Blocked IPs — Security — StayLynk</title></Helmet>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
      <div className="p-6">
        <PageHeader
          title="Blocked IPs"
          subtitle="IPs and devices currently blocked. Blocks are enforced at the Redis level."
          actions={
            <Button onClick={() => setAddOpen(true)}>
              <ShieldPlus className="mr-1.5 h-4 w-4" />
              Block IP
            </Button>
          }
        />

        <FilterBar>
          <Select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
            placeholder="All types"
            className="w-36 text-xs"
            options={[
              { value: '',           label: 'All types' },
              { value: 'temporary',  label: 'Temporary' },
              { value: 'permanent',  label: 'Permanent' },
            ]}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          keyField="id"
          loading={isLoading}
          error={isError ? 'Failed to load blocked IPs.' : null}
          emptyTitle="No blocked IPs"
          emptyDescription="No IP addresses are currently blocked."
          pagination={meta}
          onPageChange={setPage}
          onPerPageChange={setPerPage}
          caption="Blocked IPs"
        />
      </div>

      {/* Unblock confirm modal */}
      <Modal
        open={unblockTarget !== null}
        onClose={() => setUnblockTarget(null)}
        title="Unblock IP Address"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setUnblockTarget(null)}>Cancel</Button>
            <Button
              loading={unblocking}
              onClick={() => {
                if (!unblockTarget) return
                unblock(unblockTarget.ip_hash, {
                  onSuccess: () => {
                    success(`${unblockTarget.ip_address} has been unblocked`)
                    setUnblockTarget(null)
                  },
                  onError: (err) => toastError(err, 'Failed to unblock IP'),
                })
              }}
            >
              Confirm Unblock
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Remove the block on <span className="font-mono font-semibold text-foreground">{unblockTarget?.ip_address}</span>?
          This removes it from Redis and the database immediately.
        </p>
      </Modal>

      {/* Add block modal */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setIpAddress(''); setReason(''); setBlockType('temporary') }}
        title="Block IP Address"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={blocking}
              onClick={() => {
                if (!ipAddress.trim() || !reason.trim()) return
                blockIP(
                  {
                    ip_address: ipAddress.trim(),
                    reason: reason.trim(),
                    type: blockType,
                    ...(blockType === 'temporary' && { duration_hours: parseInt(duration, 10) || 24 }),
                  },
                  {
                    onSuccess: () => {
                      success(`${ipAddress} has been blocked`)
                      setAddOpen(false)
                      setIpAddress('')
                      setReason('')
                    },
                    onError: (err) => toastError(err, 'Failed to block IP'),
                  },
                )
              }}
            >
              Block
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="IP Address" htmlFor="new-ip" required>
            <Input id="new-ip" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="192.168.1.1" />
          </FormField>
          <FormField label="Reason" htmlFor="new-reason" required>
            <Input id="new-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brute force attack…" />
          </FormField>
          <FormField label="Type" htmlFor="new-type">
            <Select id="new-type" value={blockType}
              onChange={(e) => setBlockType(e.target.value as 'temporary' | 'permanent')}
              options={[
                { value: 'temporary', label: 'Temporary' },
                { value: 'permanent', label: 'Permanent' },
              ]}
            />
          </FormField>
          {blockType === 'temporary' && (
            <FormField label="Duration (hours)" htmlFor="new-duration">
              <Input id="new-duration" type="number" min={1} value={duration}
                onChange={(e) => setDuration(e.target.value)} />
            </FormField>
          )}
        </div>
      </Modal>
    </>
  )
}
