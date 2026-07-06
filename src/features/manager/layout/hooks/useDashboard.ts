import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/api/client'
import { QK } from '@/constants/queryKeys'
import { useAuthStore } from '@/store/auth.store'

interface ManagerStats {
  total_properties: number
  total_rooms: number
  occupied_rooms: number
  occupancy_rate: number
  monthly_revenue: number
  pending_payments: number
}

interface RevenueSegment {
  label: string
  amount: number
  percent: number
}

interface ManagerDashboardData {
  stats: ManagerStats
  occupancy_chart: Array<{ date: string; occupancy_rate: number }>
  revenue_breakdown: {
    total: number
    room_rent: RevenueSegment
    late_fees: RevenueSegment
    utilities: RevenueSegment
    other_fees: RevenueSegment
  }
  rent_collection?: {
    collected: number
    pending: number
    overdue: number
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
    tenant_name: string
    room_number: string
    check_in_date: string
    check_out_date?: string | null
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
