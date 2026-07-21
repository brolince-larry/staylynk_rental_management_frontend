import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Modal, Button } from '@/components/forms'
import { useAuthStore } from '@/store/auth.store'
import { subscriptionsApi } from '@/api/subscriptions'

export function PlanIntroModal(): React.ReactElement | null {
  const user       = useAuthStore((s) => s.user)
  const setUser    = useAuthStore((s) => s.setUser)
  const navigate    = useNavigate()
  const [dismissing, setDismissing] = useState(false)

  const shouldShow = user?.role === 'admin' && !!user.org && user.org.plan_intro_seen === false

  const acknowledge = async () => {
    if (!user) return
    setDismissing(true)
    try {
      await subscriptionsApi.markPlanIntroSeen()
    } finally {
      setUser({ ...user, org: user.org ? { ...user.org, plan_intro_seen: true } : user.org })
      setDismissing(false)
    }
  }

  const goToBilling = () => {
    void acknowledge()
    navigate('/admin/billing')
  }

  if (!shouldShow) return null

  return (
    <Modal
      open
      onClose={() => void acknowledge()}
      title="Welcome to StayLynk!"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => void acknowledge()} loading={dismissing}>
            Got it
          </Button>
          <Button onClick={goToBilling}>
            View Subscription Plans
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs font-medium text-foreground">
            You've been automatically started on the <span className="font-bold">Basic plan</span> with a 30-day free trial — no payment needed yet.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Basic covers rent collection, tenant management, and room management. If you need public listings,
          AI-powered tenant matching, or advanced analytics, you can switch plans anytime from Subscription Billing —
          your trial days carry over.
        </p>
      </div>
    </Modal>
  )
}
