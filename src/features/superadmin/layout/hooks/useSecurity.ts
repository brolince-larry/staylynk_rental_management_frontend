// src/features/superadmin/layout/hooks/useSecurity.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { securityApi, type BlockIPPayload } from '@/api/security'
import { QK } from '@/constants/queryKeys'

export function useTraceSecurityEvent(id: number | null) {
  return useQuery({
    queryKey: ['superadmin', 'security', 'trace', id],
    queryFn: () => securityApi.traceEvent(id!),
    enabled: id !== null,
    staleTime: 30_000,
  })
}

export function useSuspendUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) => securityApi.suspendUser(userId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['superadmin', 'security'] }),
  })
}

export function useSecurityDashboard() {
  return useQuery({
    queryKey: QK.secDashboard(),
    queryFn: () => securityApi.dashboard(),
    refetchInterval: 60_000,
    staleTime: 0,
  })
}

export function useSecurityEvents(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: QK.secEvents(params),
    queryFn: () => securityApi.events(params),
    placeholderData: (prev) => prev,
    staleTime: 0,
  })
}

export function useSecurityThreats() {
  return useQuery({
    queryKey: QK.secThreats(),
    queryFn: () => securityApi.threats(),
    refetchInterval: 30_000,
    staleTime: 0,
  })
}

export function useSecurityHeatmap() {
  return useQuery({
    queryKey: QK.secHeatmap(),
    queryFn: () => securityApi.heatmap(),
  })
}

export function useSecurityBruteForce() {
  return useQuery({
    queryKey: QK.secBruteForce(),
    queryFn: () => securityApi.bruteForce(),
    staleTime: 0,
  })
}

export function useSecurityRiskyUsers() {
  return useQuery({
    queryKey: QK.secRiskyUsers(),
    queryFn: () => securityApi.riskyUsers(),
    staleTime: 0,
  })
}

export function useSecurityCategoryStats() {
  return useQuery({
    queryKey: QK.secCategoryStats(),
    queryFn: () => securityApi.categoryStats(),
  })
}

export function useSecurityBlockedIPs(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: QK.secBlockedIPs(params),
    queryFn: () => securityApi.blockedIPs(params),
    placeholderData: (prev) => prev,
    staleTime: 0,
  })
}

export function useBlockIP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BlockIPPayload) => securityApi.blockIP(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['superadmin', 'security', 'blocked-ips'] })
      void qc.invalidateQueries({ queryKey: ['superadmin', 'security', 'brute-force'] })
    },
  })
}

export function useUnblockIP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ipHash: string) => securityApi.unblockIP(ipHash),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['superadmin', 'security', 'blocked-ips'] })
    },
  })
}

export function useResolveSecurityEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => securityApi.resolveEvent(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['superadmin', 'security', 'events'] })
      void qc.invalidateQueries({ queryKey: ['superadmin', 'security', 'threats'] })
    },
  })
}
