import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listingsApi, type ListingFilters } from '@/api/listings'
import { QK } from '@/constants/queryKeys'
import { useAuthStore } from '@/store/auth.store'

function useOrgId() {
  return useAuthStore((s) => s.user?.org?.id?.toString() ?? 'unknown')
}

export function useAdminListings(params?: ListingFilters) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.adminListings(orgId, params),
    queryFn: () => listingsApi.list(params).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}

export function usePublishListing() {
  const qc = useQueryClient()
  const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ propertyId, data }: { propertyId: number | string; data: { title?: string; description?: string; address_display?: string } }) =>
      listingsApi.publish(propertyId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'listings', orgId] }),
  })
}

export function useUnpublishListing() {
  const qc = useQueryClient()
  const orgId = useOrgId()
  return useMutation({
    mutationFn: listingsApi.unpublish,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'listings', orgId] }),
  })
}

export function useSyncListing() {
  const qc = useQueryClient()
  const orgId = useOrgId()
  return useMutation({
    mutationFn: listingsApi.sync,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'listings', orgId] }),
  })
}

export function useFeatureListing() {
  const qc = useQueryClient()
  const orgId = useOrgId()
  return useMutation({
    mutationFn: ({ uuid, featured, featured_until, boost_score }: { uuid: string; featured: boolean; featured_until?: string; boost_score?: number }) =>
      listingsApi.feature(uuid, { featured, featured_until, boost_score }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'listings', orgId] }),
  })
}

export function useListingInquiries(params?: { status?: string; page?: number; per_page?: number }) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: QK.adminListingInquiries(orgId, params),
    queryFn: () => listingsApi.inquiries(params).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
}
