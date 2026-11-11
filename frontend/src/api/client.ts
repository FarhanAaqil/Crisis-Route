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
  edge_id: string;
  status: 'passable' | 'impassable' | 'partially_blocked' | 'debris_cleared';
  source_type: string;
  source_credibility: number;
  water_depth_cm?: number;
  reported_by?: string;
  notes?: string;
  timestamp: string;
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

/** Error carrying the HTTP status and the server's structured `detail` (if it sent one). */
export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

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

function messageFromDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') {
    const d = detail as { detail?: unknown; primary_cause?: unknown };
    if (typeof d.primary_cause === 'string') return d.primary_cause;
    if (typeof d.detail === 'string') return d.detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return first.msg;
  }
  return fallback;
}

/** Call the API, parse JSON and turn failures into ApiError with the server's explanation. */
async function request<T>(path: string, init: RequestInit = {}, fallbackError = 'Request failed'): Promise<T> {
  const res = await apiFetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = (body as { detail?: unknown }).detail ?? body;
    throw new ApiError(messageFromDetail(detail, fallbackError), res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const login = (username: string, password: string): Promise<LoginResponse> =>
  request('/auth/login', jsonInit('POST', { username, password }), 'Sign-in failed');

export const fetchHealth = (): Promise<SystemHealth> => request('/health', {}, 'Health check failed');

export const fetchScenarios = (): Promise<ScenarioSummary[]> =>
  request('/scenarios', {}, 'Failed to fetch scenarios');

export const fetchScenarioDetail = (scenarioId: string): Promise<ScenarioDetail> =>
  request(`/scenarios/${scenarioId}`, {}, `Failed to fetch scenario ${scenarioId}`);

export const fetchScenarioResources = (scenarioId: string): Promise<ScenarioResourcesResponse> =>
  request(`/scenarios/${scenarioId}/resources`, {}, 'Failed to fetch scenario resources');

export const fetchPassability = (scenarioId: string): Promise<PassabilityResponse> =>
  request(`/scenarios/${scenarioId}/passability`, {}, 'Failed to fetch road passability data');

export const fetchVoiRankings = (scenarioId: string, topK: number = 5): Promise<VoiRankingsResponse> =>
  request(`/scenarios/${scenarioId}/voi-rankings?top_k=${topK}`, {}, 'Failed to fetch Value-of-Information rankings');

export const fetchScenarioFan = (scenarioId: string, numSamples: number = 50): Promise<ScenarioFanResponse> =>
  request(`/scenarios/${scenarioId}/scenario-fan?num_samples=${numSamples}`, {}, 'Failed to fetch scenario fan');

export const fetchRouteAlternatives = (
  scenarioId: string,
  originId: string,
  destinationId: string,
  k: number = 3,
  vehicleId?: string,
): Promise<RouteAlternativesResponse> => {
  const params = new URLSearchParams({ origin_id: originId, destination_id: destinationId, k: String(k) });
  if (vehicleId) params.set('vehicle_id', vehicleId);
  return request(`/scenarios/${scenarioId}/routes?${params.toString()}`, {}, 'Failed to fetch route alternatives');
};

export const optimizePlan = (scenarioId: string, mode: 'robust' | 'baseline' = 'robust'): Promise<PlanDetail> =>
  request(`/scenarios/${scenarioId}/plans/optimize?mode=${mode}`, { method: 'POST' }, 'Optimization failed');

export const submitPlanForApproval = (planId: string): Promise<PlanDetail> =>
  request(`/scenarios/plans/${planId}/submit`, { method: 'POST' }, 'Could not submit plan');

export const fetchActivePlan = (scenarioId: string): Promise<PlanDetail> =>
  request(`/scenarios/${scenarioId}/plans/active`, {}, 'No active plan');

export const submitPlanApproval = (
  planId: string,
  decision: 'APPROVE' | 'REJECT',
  rationale: string,
): Promise<PlanDetail> =>
  request(`/scenarios/plans/${planId}/approval`, jsonInit('POST', { decision, rationale }), 'Approval submission failed');

export interface ObservationPayload {
  edge_id: string;
  status: string;
  source_type: string;
  source_credibility: number;
  water_depth_cm?: number;
  notes?: string;
}

export const fetchObservations = (scenarioId: string, limit = 50, offset = 0): Promise<ObservationResponse[]> =>
  request(`/scenarios/${scenarioId}/observations?limit=${limit}&offset=${offset}`, {}, 'Failed to fetch observations');

export const submitObservation = (scenarioId: string, payload: ObservationPayload): Promise<ObservationResponse> =>
  request(`/scenarios/${scenarioId}/observations`, jsonInit('POST', payload), 'Observation submission failed');

export const uploadNetworkData = (formData: FormData): Promise<IngestUploadResponse> =>
  request('/ingest/upload', { method: 'POST', body: formData }, 'File ingestion failed');

export const exportPlan = (scenarioId: string, planId: string): Promise<Record<string, unknown>> =>
  request(`/scenarios/${scenarioId}/plans/${planId}/export`, {}, 'Export plan failed');

export interface AuditPage {
  items: AuditEventRecord[];
  total: number;
}

export async function fetchAuditLogs(limit = 50, offset = 0, action?: string): Promise<AuditPage> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (action) params.set('action', action);
  const res = await apiFetch(`${BASE_URL}/audit?${params.toString()}`);
  if (!res.ok) throw new ApiError('Failed to fetch audit trail', res.status, null);
  const items = (await res.json()) as AuditEventRecord[];
  return { items, total: Number(res.headers.get('X-Total-Count') ?? items.length) };
}

export interface AuditIntegrity {
  intact: boolean;
  event_count: number;
  head_hash: string | null;
}

export const fetchAuditIntegrity = (): Promise<AuditIntegrity> =>
  request('/audit/verify', {}, 'Could not verify the audit ledger');
