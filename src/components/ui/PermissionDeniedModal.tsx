import React from 'react'
import { ShieldAlert } from 'lucide-react'
import { Modal, Button } from '@/components/forms'
import type { PermissionDeniedBlock } from '@/utils/errors'

interface PermissionDeniedModalProps {
  block: PermissionDeniedBlock | null
  onClose: () => void
}

/**
 * Shown whenever a manager-scoped action is blocked by a per-property
 * permission the admin hasn't granted them. Reuse this instead of a plain
 * error toast so the manager gets an actionable "contact your admin" path
 * rather than a dead-end failure.
 */
export function PermissionDeniedModal({ block, onClose }: PermissionDeniedModalProps): React.ReactElement {
  return (
    <Modal
      open={!!block}
      onClose={onClose}
      title="Action not permitted"
      size="sm"
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {block && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/40 dark:bg-red-950/20">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                You don't have access to <span className="font-bold text-primary">{block.permission.replace(/[._]/g, ' ')}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {block.role === 'manager'
                  ? 'Your admin has not enabled this permission for your account on this property. Contact your admin to request access.'
                  : 'You do not have permission to perform this action.'}
              </p>
            </div>
          </div>
          {block.steps.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Steps to resolve</p>
              <ol className="space-y-2">
                {block.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
