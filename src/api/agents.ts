import { apiGet, apiPost } from './client'

export interface AgentChart {
  type: 'bar' | 'pie' | 'line' | 'donut'
  title: string
  labels: string[]
  datasets: Array<{ label: string; data: number[]; color: string | string[] }>
  summary?: string
}

export interface AgentDashboard {
  text: string
  pending_approvals: number
  charts: AgentChart[]
}

export interface AgentHealth {
  status: 'healthy' | 'warning' | 'critical'
  recent_failures: number
  running_workflows: number
  pending_approvals: Record<string, number>
  charts: AgentChart[]
}

export interface AgentApproval {
  id: string | number
  agent_name: string
  action: string
  rationale: string
  confidence: number
  created_at: string
}

export interface AgentApprovalList {
  approvals: AgentApproval[]
}

export interface AgentQueryResponse {
  text: string
  charts: AgentChart[]
  routed_to?: string
}

export interface RentCollectionData {
  text?: string
  stats: { overdue: number; collected_amount: number; overdue_amount: number }
  charts: AgentChart[]
}

export interface MaintenanceData {
  text?: string
  priority_counts: { P1: number; P2: number; P3: number; P4: number }
  charts: AgentChart[]
}

export interface FinancialData {
  text: string
  charts: AgentChart[]
}

export interface AuditEntry {
  id: string | number
  agent_name: string
  action: string
  entity: string
  confidence: number
  status: 'completed' | 'failed' | 'pending_approval' | 'approved' | 'rejected' | string
  rationale: string
  timestamp: string
}

export interface AuditList {
  data: AuditEntry[]
  meta?: { total: number; current_page: number; last_page: number }
}

export const agentsApi = {
  dashboard:      ()                    => apiGet<AgentDashboard>('/admin/agents/dashboard'),
  health:         ()                    => apiGet<AgentHealth>('/admin/agents/health'),
  approvals:      ()                    => apiGet<AgentApprovalList>('/admin/agents/approvals'),
  approve:        (id: string | number) => apiPost<void>(`/admin/agents/approvals/${id}/approve`, {}),
  reject:         (id: string | number) => apiPost<void>(`/admin/agents/approvals/${id}/reject`, {}),
  query:          (question: string)    => apiPost<AgentQueryResponse>('/admin/agents/query', { question }),
  rentCollection: ()                    => apiGet<RentCollectionData>('/admin/agents/rent-collection'),
  maintenance:    ()                    => apiGet<MaintenanceData>('/admin/agents/maintenance'),
  financial:      ()                    => apiGet<FinancialData>('/admin/agents/financial'),
  financialQuery: (question: string)    => apiPost<FinancialData>('/admin/agents/financial/query', { question }),
  audit:          (params?: { agent?: string; status?: string; entity_type?: string; org_id?: string }) =>
    apiGet<AuditList>('/admin/agents/audit', params as Record<string, unknown>),
}
