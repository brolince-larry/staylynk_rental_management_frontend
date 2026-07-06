import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/api/client'
import { QK } from '@/constants/queryKeys'
import { useAuthStore } from '@/store/auth.store'

interface AdminStats {
  total_properties: number
  new_properties_month: number
  total_rooms: number
  new_rooms_month: number
  occupied_rooms: number
  occupancy_rate: number
  monthly_revenue: number
  revenue_change_pct: number
  pending_invoices_count: number
  pending_invoices_amount: number
}

interface AdminActivity {
  id: number | string
  event: string
  description: string
  model?: string | null
  model_id?: number | string | null
  created_at: string
}

interface AdminBooking {
  id: number | string
  tenant_name?: string | null
  property_name?: string | null
  room?: string | null
  check_in_date: string
  check_out_date?: string | null
  amount: number
  status: string
}

interface PropertyStatus {
  id: number | string
  name: string
  occupied_rooms: number
  total_rooms: number
  occupancy_rate: number
}

interface RevenueSegment {
  label: string
  amount: number
  percent: number
}

interface AdminDashboardData {
  stats: AdminStats
  occupancy_chart: Array<{ date: string; occupancy_rate: number }>
  revenue_breakdown: {
    total: number
    room_rent: RevenueSegment
    late_fees: RevenueSegment
    utilities: RevenueSegment
    other_fees: RevenueSegment
  }
  recent_activity: AdminActivity[]
  recent_bookings: AdminBooking[]
  property_status: PropertyStatus[]
}

export function useAdminDashboard(filters?: { from?: string; to?: string }) {
  const orgId      = useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
  const propertyId = useAuthStore((s) => s.user?.current_property?.uuid ?? null)

  const params: Record<string, unknown> = { ...(filters ?? {}) }
  if (propertyId) params.property_id = propertyId

  return useQuery({
    queryKey: QK.adminDashboard(orgId, { ...filters, property_id: propertyId ?? undefined }),
    queryFn: () =>
      apiGet<AdminDashboardData>('/admin/dashboard', params).then((res) => res.data),
  })
}
