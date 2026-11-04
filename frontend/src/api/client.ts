/**
 * Typed API Client for CrisisRoute Backend
 */

export interface ScenarioSummary {
  scenario_id: string;
  name: string;
  region_name: string;
  created_at: string;
  active_plan_id: string | null;
}

export interface SystemHealth {
  status: string;
  version: string;
  environment: string;
  graph_engine: string;
  solver_engine: string;
}

export interface AllocationItem {
  demand_node_id: string;
  commodity_id: string;
  vehicle_id: string;
  quantity_delivered: number;
}

export interface UnmetDemandItem {
  demand_node_id: string;
  commodity_id: string;
  unmet_quantity: number;
  vulnerable_group: string;
}

export interface ReconnaissanceRecommendation {
  edge_id: string;
  expected_regret_reduction: number;
  inspection_cost: number;
  voi_score: number;
  priority_rank: number;
}

export interface EquityEvaluation {
  total_deprivation_penalty: number;
  mean_fulfillment_ratio: number;
  min_fulfillment_ratio: number;
  vulnerable_group_fulfillment_ratio: number;
  alpha_service_floor: number;
  alpha_floor_satisfied: boolean;
  gini_coefficient: number;
  unmet_demand_count: number;
}

export interface InfeasibilityDiagnostic {
  status: string;
  primary_cause?: string;
  detail: string;
  explanations: string[];
  remediation_suggestions: string[];
  isolated_demand_nodes: string[];
  commodity_deficits: Record<string, number>;
  capacity_deficit_kg: number;
}

export interface PlanDetail {
  plan_id: string;
  scenario_id: string;
  snapshot_id: string;
  solver_status: 'OPTIMAL' | 'FEASIBLE' | 'NON_OPTIMAL_INCUMBENT' | 'INFEASIBLE' | 'MODEL_INVALID';
  solve_time_seconds: number;
  vehicle_routes: Array<{
    vehicle_id: string;
    chosen_path: string[];
    survival_probability: number;
    estimated_travel_time_min: number;
  }>;
  allocations: AllocationItem[];
  unmet_demands: UnmetDemandItem[];
  equity_evaluation: EquityEvaluation;
  reconnaissance_recommendations: ReconnaissanceRecommendation[];
  approval_state: {
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
    reviewed_by?: string;
    rationale?: string;
  };
}

const BASE_URL = 'http://localhost:8000/api/v1';

export async function fetchHealth(): Promise<SystemHealth> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchScenarios(): Promise<ScenarioSummary[]> {
  const res = await fetch(`${BASE_URL}/scenarios`);
  if (!res.ok) throw new Error('Failed to fetch scenarios');
  return res.json();
}

export async function generatePlan(scenarioId: string): Promise<PlanDetail> {
  const res = await fetch(`${BASE_URL}/scenarios/${scenarioId}/plans`, {
    method: 'POST',
    headers: {
      'X-User-Role': 'analyst',
      'X-User-Id': 'analyst-frontend',
    },
  });
  if (!res.ok) throw new Error('Failed to generate relief plan');
  return res.json();
}

export async function optimizePlan(
  scenarioId: string,
  mode: 'robust' | 'baseline' = 'robust'
): Promise<PlanDetail> {
  const res = await fetch(`${BASE_URL}/scenarios/${scenarioId}/plans/optimize?mode=${mode}`, {
    method: 'POST',
    headers: {
      'X-User-Role': 'analyst',
      'X-User-Id': 'analyst-frontend',
    },
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(JSON.stringify(errorData.detail || errorData));
  }
  return res.json();
}

export async function fetchActivePlan(scenarioId: string): Promise<PlanDetail> {
  const res = await fetch(`${BASE_URL}/scenarios/${scenarioId}/plans/active`);
  if (!res.ok) throw new Error('Failed to fetch active relief plan');
  return res.json();
}

export async function submitPlanApproval(
  planId: string,
  decision: 'APPROVE' | 'REJECT',
  rationale: string,
  approverName: string
): Promise<PlanDetail> {
  const res = await fetch(`${BASE_URL}/scenarios/plans/${planId}/approval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': 'approver',
      'X-User-Id': 'lead-approver',
      'X-Username': approverName,
    },
    body: JSON.stringify({ decision, rationale }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || 'Approval submission failed');
  }
  return res.json();
}

export async function exportPlan(scenarioId: string, planId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/scenarios/${scenarioId}/plans/${planId}/export`);
  if (!res.ok) throw new Error('Export plan failed');
  return res.json();
}
