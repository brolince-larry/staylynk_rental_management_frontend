import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/api/client'
import { QK } from '@/constants/queryKeys'
import { useAuthStore } from '@/store/auth.store'

interface ManagerStats {
  total_properties: number
  new_properties_month: number
  total_rooms: number
  new_rooms_month: number
  occupied_rooms: number
  occupancy_rate: number
  monthly_revenue: number
  revenue_change_pct: number
  pending_payments: number
}

interface RevenueSegment {
  amount: number
  percent: number
}

interface ManagerDashboardData {
  stats: ManagerStats
  occupancy_overview: Array<{ date: string; occupancy_rate: number }>
  revenue_overview: {
    total: number
    expenses: RevenueSegment
    salaries: RevenueSegment
    profit: RevenueSegment
    period?: { year: number }
  }
  recent_activities: Array<{
    id: number | string
    event: string
    model: string
    model_id: number | string | null
    actor: string
    created_at: string
  }>
  rent_collection_summary: {
    expected: number
    collected: number
    pending: number
    overdue: number
    collection_rate: number
    collected_change_pct: number
    pending_change_pct: number
    overdue_change_pct: number
  }
  property_status: Array<{
    id: number | string
    name: string
    occupied_rooms: number
    total_rooms: number
    occupancy_rate: number
  }>
  recent_bookings: Array<{
    id: number | string
    booking_number: string
    guest_name: string
    room: string
    check_in: string
    check_out?: string | null
    amount: number
    status: string
  }>
}

export function useManagerDashboard() {
  const orgId = useAuthStore((state) => state.user?.org?.id?.toString() ?? 'unknown')

  return useQuery({
    queryKey: QK.managerDashboard(orgId),
    queryFn: () => apiGet<ManagerDashboardData>('/manager/dashboard').then((res) => res.data),
  })
}
