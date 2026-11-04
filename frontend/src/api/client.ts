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

export interface PlanDetail {
  plan_id: string;
  scenario_id: string;
  snapshot_id: string;
  solver_status: string;
  solve_time_seconds: number;
  vehicle_routes: Array<{
    vehicle_id: string;
    chosen_path: string[];
    survival_probability: number;
    estimated_travel_time_min: number;
  }>;
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

