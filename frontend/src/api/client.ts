/**
 * Typed API Client for CrisisRoute Backend
 */
import { getToken, UNAUTHORIZED_EVENT, SessionUser } from '../auth/session';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: SessionUser;
}

export interface ScenarioSummary {
  scenario_id: string;
  name: string;
  region_name: string;
  created_at: string;
  active_plan_id: string | null;
}

export interface RegionModel {
  name: string;
  country: string;
  bbox: [number, number, number, number];
  crs: string;
}

export interface CommodityModel {
  id: string;
  name: string;
  unit_weight_kg: number;
  priority_weight: number;
}

export interface DepotModel {
  id: string;
  name: string;
  coordinates: [number, number];
  inventory: Record<string, number>;
}

export interface VehicleModel {
  id: string;
  name: string;
  depot_id: string;
  capacity_kg: number;
  average_speed_kmh: number;
}

export interface DemandNodeModel {
  id: string;
  name: string;
  vulnerable_group: string;
  population: number;
  coordinates: [number, number];
  demand: Record<string, number>;
}

export interface ScenarioDetail {
  scenario_id: string;
  snapshot_id: string;
  name: string;
  description: string;
  region: RegionModel;
  time_horizon_hours: number;
  commodities: CommodityModel[];
  depots: DepotModel[];
  vehicles: VehicleModel[];
  demand_nodes: DemandNodeModel[];
  equity_parameters: {
    min_group_service_floor_alpha: number;
    beta_tail_risk_weight: number;
  };
  solver_parameters: {
    time_limit_seconds: number;
    scenario_samples_s: number;
    random_seed: number;
  };
  created_at: string;
  active_plan_id?: string | null;
}

export interface ScenarioResourcesResponse {
  scenario_id: string;
  depots: DepotModel[];
  demand_nodes: DemandNodeModel[];
  vehicles: VehicleModel[];
  commodities: CommodityModel[];
  total_demand_by_commodity: Record<string, number>;
  total_supply_by_commodity: Record<string, number>;
  total_fleet_capacity_kg: number;
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
  generated_by?: string | null;
  vehicle_routes: Array<{
    vehicle_id: string;
    depot_id?: string | null;
    destination_node_id?: string | null;
    payload_kg?: number | null;
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
    reviewed_at?: string | null;
    rationale?: string;
  };
}

export interface AuditEventRecord {
  event_id: string;
  timestamp: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  prev_hash?: string;
  event_hash?: string;
}

export interface PassabilityEdgeItem {
  edge_id: string;
  u_node: string;
  v_node: string;
  u_coord: [number, number];
  v_coord: [number, number];
  road_class: string;
  bridge: boolean;
  length_m: number;
  free_flow_sec: number;
  passability_prob: number;
  credible_interval: [number, number];
  stale_age_hours: number;
  risk_class: 'PASSABLE' | 'MODERATE' | 'CRITICAL';
}

export interface PassabilityNodeItem {
  node_id: string;
  name: string;
  node_type: 'depot' | 'demand' | 'junction';
  coordinates: [number, number];
  vulnerable_group?: string | null;
  population?: number | null;
}

export interface CalibrationBin {
  bin_index: number;
  bin_range: [number, number];
  confidence: number;
  accuracy: number;
  count: number;
  calibration_gap: number;
}

export interface ModelMetricsSummary {
  evaluation?: string;
  model_version: string;
  model_type: string;
  brier_score: number;
  expected_calibration_error: number;
  roc_auc: number;
  total_samples: number;
  reliability_diagram: CalibrationBin[];
}

export interface PassabilitySummary {
  total_edges: number;
  passable_count: number;
  moderate_count: number;
  critical_count: number;
  bridges_count: number;
  average_passability: number;
}

export interface PassabilityResponse {
  scenario_id: string;
  region_name: string;
  edges: PassabilityEdgeItem[];
  nodes: PassabilityNodeItem[];
  calibration_metrics: ModelMetricsSummary | null;
  graph_source: string;
  summary: PassabilitySummary;
}

export interface VoiRankingsResponse {
  scenario_id: string;
  targets: ReconnaissanceRecommendation[];
  total_candidates_evaluated: number;
}

export interface ScenarioFanResponse {
  scenario_id: string;
  num_samples: number;
  mean_passability: number;
  worst_case_p05: number;
  best_case_p95: number;
  sampling_duration_ms: number;
  sample_survival_rates: number[];
  deterministic_loss: number;
  recourse_loss: number;
  expected_shortfall_95: number;
}

export interface RouteOption {
  rank: number;
  node_path: string[];
  edge_path: string[];
  travel_time_min: number;
  survival_prob: number;
  jaccard_overlap_with_primary: number;
  eta_inflation_pct: number;
}

export interface RouteAlternativesResponse {
  scenario_id: string;
  origin_id: string;
  destination_id: string;
  vehicle_id?: string | null;
  destination_name?: string | null;
  routes: RouteOption[];
}

export interface ObservationResponse {
  observation_id: string;
  scenario_id: string;
  edge_id: string;
  status: 'passable' | 'impassable' | 'partially_blocked' | 'debris_cleared';
  source_type: string;
  source_credibility: number;
  notes?: string;
  observed_at: string;
}

export interface PreviewEdge {
  edge_id: string;
  road_class: string;
  length_m: number;
  free_flow_sec: number;
  passability_prob: number;
  bridge: boolean;
}

export interface QuarantineRecord {
  quarantine_id: string;
  file_name: string;
  row_index: number;
  raw_data: Record<string, unknown>;
  errors: Array<{ column: string; error_code: string; message: string; invalid_value?: unknown }>;
}

export interface ScenarioApprovalResult {
  status: string;
  approver_id: string;
  rationale: string;
  scenario_id: string;
  plan_id: string | null;
}

export interface IngestUploadResponse {
  file_name: string;
  snapshot_hash: string;
  total_rows: number;
  valid_rows: number;
  quarantined_rows: number;
  quarantine_records: QuarantineRecord[];
  valid_edges_preview: PreviewEdge[];
}

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/** fetch wrapper that attaches the bearer token and signals the app when the session lapses. */
async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 && token) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  return res;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await apiFetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Sign-in failed');
  }
  return res.json();
}

export async function fetchHealth(): Promise<SystemHealth> {
  const res = await apiFetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchScenarios(): Promise<ScenarioSummary[]> {
  const res = await apiFetch(`${BASE_URL}/scenarios`);
  if (!res.ok) throw new Error('Failed to fetch scenarios');
  return res.json();
}

export async function fetchScenarioDetail(scenarioId: string): Promise<ScenarioDetail> {
  const res = await apiFetch(`${BASE_URL}/scenarios/${scenarioId}`);
  if (!res.ok) throw new Error(`Failed to fetch scenario ${scenarioId}`);
  return res.json();
}

export async function fetchScenarioResources(scenarioId: string): Promise<ScenarioResourcesResponse> {
  const res = await apiFetch(`${BASE_URL}/scenarios/${scenarioId}/resources`);
  if (!res.ok) throw new Error('Failed to fetch scenario resources');
  return res.json();
}

export async function fetchPassability(scenarioId: string): Promise<PassabilityResponse> {
  const res = await apiFetch(`${BASE_URL}/scenarios/${scenarioId}/passability`);
  if (!res.ok) throw new Error('Failed to fetch road passability data');
  return res.json();
}

export async function fetchVoiRankings(scenarioId: string, topK: number = 5): Promise<VoiRankingsResponse> {
  const res = await apiFetch(`${BASE_URL}/scenarios/${scenarioId}/voi-rankings?top_k=${topK}`);
  if (!res.ok) throw new Error('Failed to fetch Value-of-Information rankings');
  return res.json();
}

export async function fetchScenarioFan(scenarioId: string, numSamples: number = 50): Promise<ScenarioFanResponse> {
  const res = await apiFetch(`${BASE_URL}/scenarios/${scenarioId}/scenario-fan?num_samples=${numSamples}`);
  if (!res.ok) throw new Error('Failed to fetch stochastic scenario fan');
  return res.json();
}

export async function fetchRouteAlternatives(
  scenarioId: string,
  originId: string,
  destinationId: string,
  k: number = 3,
  vehicleId?: string
): Promise<RouteAlternativesResponse> {
  const url = `${BASE_URL}/scenarios/${scenarioId}/routes?origin_id=${encodeURIComponent(
    originId
  )}&destination_id=${encodeURIComponent(destinationId)}&k=${k}${
    vehicleId ? `&vehicle_id=${encodeURIComponent(vehicleId)}` : ''
  }`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Failed to fetch route alternatives');
  return res.json();
}

export async function optimizePlan(
  scenarioId: string,
  mode: 'robust' | 'baseline' = 'robust'
): Promise<PlanDetail> {
  const res = await apiFetch(`${BASE_URL}/scenarios/${scenarioId}/plans/optimize?mode=${mode}`, {
    method: 'POST',
    headers: {
    },
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(JSON.stringify(errorData.detail || errorData));
  }
  return res.json();
}

export async function submitPlanForApproval(planId: string): Promise<PlanDetail> {
  const res = await apiFetch(`${BASE_URL}/scenarios/plans/${planId}/submit`, { method: 'POST' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(typeof errorData.detail === 'string' ? errorData.detail : 'Could not submit plan');
  }
  return res.json();
}

export async function fetchActivePlan(scenarioId: string): Promise<PlanDetail> {
  const res = await apiFetch(`${BASE_URL}/scenarios/${scenarioId}/plans/active`);
  if (!res.ok) throw new Error('Failed to fetch active relief plan');
  return res.json();
}

export async function submitPlanApproval(
  planId: string,
  decision: 'APPROVE' | 'REJECT',
  rationale: string,
  _approverName?: string
): Promise<PlanDetail> {
  const res = await apiFetch(`${BASE_URL}/scenarios/plans/${planId}/approval`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ decision, rationale }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || 'Approval submission failed');
  }
  return res.json();
}

export async function approveScenarioDirectly(
  scenarioId: string,
  decision: 'APPROVE' | 'REJECT',
  rationale: string,
  _approverId?: string
): Promise<ScenarioApprovalResult> {
  const res = await apiFetch(`${BASE_URL}/scenarios/${scenarioId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ decision, rationale }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || 'Direct scenario approval failed');
  }
  return res.json();
}

export async function fetchObservations(scenarioId: string): Promise<ObservationResponse[]> {
  const res = await apiFetch(`${BASE_URL}/scenarios/${scenarioId}/observations`);
  if (!res.ok) throw new Error('Failed to fetch observations');
  return res.json();
}

export async function submitObservation(
  scenarioId: string,
  payload: {
    edge_id: string;
    status: string;
    source_type: string;
    source_credibility: number;
    notes?: string;
  },
  _role?: string
): Promise<ObservationResponse> {
  const res = await apiFetch(`${BASE_URL}/scenarios/${scenarioId}/observations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || 'Observation submission failed');
  }
  return res.json();
}

export async function uploadNetworkData(formData: FormData): Promise<IngestUploadResponse> {
  const res = await apiFetch(`${BASE_URL}/ingest/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || 'File ingestion failed');
  }
  return res.json();
}

export async function exportPlan(scenarioId: string, planId: string): Promise<Record<string, unknown>> {
  const res = await apiFetch(`${BASE_URL}/scenarios/${scenarioId}/plans/${planId}/export`);
  if (!res.ok) throw new Error('Export plan failed');
  return res.json();
}

export async function fetchAuditLogs(limit: number = 100, actionFilter?: string): Promise<AuditEventRecord[]> {
  const url = `${BASE_URL}/audit?limit=${limit}${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ''}`;
  const res = await apiFetch(url, {
    headers: {
    },
  });
  if (!res.ok) throw new Error('Failed to fetch audit trail');
  return res.json();
}
