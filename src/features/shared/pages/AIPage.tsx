import React from 'react'
import { useLocation } from 'react-router-dom'
import AIAssistant from '@/components/ai'

function roleFromPath(pathname: string): string {
  if (pathname.startsWith('/superadmin')) return 'superadmin'
  if (pathname.startsWith('/manager')) return 'manager'
  if (pathname.startsWith('/tenant')) return 'tenant'
  return 'admin'
}

export default function AIPage(): React.ReactElement {
  const location = useLocation()
  const role = roleFromPath(location.pathname)

  return <AIAssistant role={role} variant="page" />
}
