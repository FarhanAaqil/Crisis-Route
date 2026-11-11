import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../src/auth/AuthContext';
import { AppRoutes } from '../src/App';
import type { Role, Session } from '../src/auth/session';
import { ObservationEditor } from '../src/components/ObservationEditor';
import { useAsync } from '../src/hooks/useAsync';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';

const SCENARIO_ID = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

function session(role: Role, userId = `${role}-1`): Session {
  return {
    token: 'tok-123',
    expiresAt: Date.now() + 3_600_000,
    user: { user_id: userId, username: role, display_name: `Test ${role}`, role },
  };
}

type Plan = {
  plan_id: string;
  scenario_id: string;
  snapshot_id: string;
  solver_status: string;
  solve_time_seconds: number;
  generated_by: string;
  vehicle_routes: unknown[];
  allocations: unknown[];
  unmet_demands: unknown[];
  equity_evaluation: Record<string, number | boolean>;
  reconnaissance_recommendations: unknown[];
  approval_state: { status: string; reviewed_by?: string; rationale?: string };
};

function plan(status: string, generatedBy = 'analyst-1'): Plan {
  return {
    plan_id: 'plan-0001-aaaa',
    scenario_id: SCENARIO_ID,
    snapshot_id: 'f'.repeat(64),
    solver_status: 'OPTIMAL',
    solve_time_seconds: 0.4,
    generated_by: generatedBy,
    vehicle_routes: [],
    allocations: [],
    unmet_demands: [],
    equity_evaluation: {},
    reconnaissance_recommendations: [],
    approval_state: { status },
  };
}

/** Route-based fetch mock. Returns the calls so tests can assert on them. */
function mockApi(opts: { plan?: Plan | null; edges?: string[] } = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith('/auth/login')) {
        const body = JSON.parse(String(init?.body));
        return body.password === 'right'
          ? json({ access_token: 't', token_type: 'bearer', expires_in: 3600, user: session('analyst').user })
          : json({ detail: 'Incorrect username or password' }, 401);
      }
      if (/\/scenarios$/.test(url)) {
        return json([{ scenario_id: SCENARIO_ID, name: 'Kerala Test Corridor', region_name: 'Wayanad', created_at: '2026-01-01T00:00:00Z', active_plan_id: null }]);
      }
      if (url.endsWith(`/scenarios/${SCENARIO_ID}`)) {
        return json({
          scenario_id: SCENARIO_ID,
          snapshot_id: 'e'.repeat(64),
          name: 'Kerala Test Corridor',
          description: '',
          region: { name: 'Wayanad', country: 'India', bbox: [75.9, 11.45, 76.4, 11.95], crs: 'EPSG:4326' },
          time_horizon_hours: 24,
          commodities: [],
          depots: [],
          vehicles: [],
          demand_nodes: [],
          equity_parameters: { min_group_service_floor_alpha: 0.35, beta_tail_risk_weight: 0.3 },
          solver_parameters: { time_limit_seconds: 30, scenario_samples_s: 50, random_seed: 42 },
          created_at: '2026-01-01T00:00:00Z',
        });
      }
      if (url.endsWith('/resources')) {
        return json({
          scenario_id: SCENARIO_ID,
          depots: [{ id: 'D1' }, { id: 'D2' }],
          demand_nodes: [{ id: 'N1' }, { id: 'N2' }, { id: 'N3' }],
          vehicles: [{ id: 'V1' }],
          commodities: [],
          total_demand_by_commodity: { WATER: 100, FOOD: 50 },
          total_supply_by_commodity: {},
          total_fleet_capacity_kg: 3500,
        });
      }
      if (url.endsWith('/plans/active')) {
        return opts.plan ? json(opts.plan) : json({ detail: 'none' }, 404);
      }
      if (url.includes('/passability')) {
        const ids = opts.edges ?? ['EDGE-A-01', 'EDGE-B-02', 'EDGE-C-03'];
        return json({
          scenario_id: SCENARIO_ID,
          region_name: 'Wayanad',
          graph_source: 'synthetic_corridor',
          edges: ids.map((id) => ({
            edge_id: id, u_node: 'a', v_node: 'b', u_coord: [76, 11], v_coord: [76.1, 11.1], road_class: 'primary',
            bridge: false, length_m: 1000, free_flow_sec: 60, passability_prob: 0.9, credible_interval: [0.8, 0.95],
            stale_age_hours: 1, risk_class: 'PASSABLE',
          })),
          nodes: [],
          calibration_metrics: null,
          summary: { total_edges: ids.length, passable_count: ids.length, moderate_count: 0, critical_count: 0, bridges_count: 0, average_passability: 0.9 },
        });
      }
      if (url.includes('/observations')) return json([]);
      if (url.includes('/submit')) return json(plan('PENDING_APPROVAL'));
      if (url.includes('/approval')) {
        const body = JSON.parse(String(init?.body));
        return json(plan(body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'));
      }
      return json({});
    }),
  );
  return calls;
}

function renderApp(role: Role, userId?: string) {
  return render(
    <AuthProvider initialSession={session(role, userId)}>
      <AppRoutes />
    </AuthProvider>,
  );
}

beforeEach(() => {
  window.location.hash = '';
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sign-in', () => {
  it('shows the form without a session and reports a wrong password', async () => {
    mockApi();
    render(
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>,
    );
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'analyst' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password');
  });

  it('signs in with valid credentials and shows the console', async () => {
    mockApi();
    render(
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>,
    );
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'analyst' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'right' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  });
});

describe('application shell', () => {
  it('has links for every screen, a skip link and the mandatory safety notice', async () => {
    mockApi();
    renderApp('analyst');
    const nav = await screen.findByRole('navigation', { name: /main navigation/i });
    expect(nav.querySelectorAll('a')).toHaveLength(6);
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
    expect(screen.getByText(/does not certify route safety/i)).toBeInTheDocument();
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent('Overview');
  });

  it('follows the URL hash and sets the page title', async () => {
    mockApi();
    window.location.hash = '#/audit';
    renderApp('approver');
    await waitFor(() => expect(document.title).toContain('Audit Trail'));
    act(() => {
      window.location.hash = '#/observations';
    });
    await waitFor(() => expect(document.title).toContain('Field Observations'));
  });

  it('attaches the bearer token to API calls', async () => {
    const calls = mockApi();
    renderApp('analyst');
    await screen.findByRole('navigation', { name: /main navigation/i });
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/scenarios'))).toBe(true));
    const call = calls.find((c) => c.url.endsWith('/scenarios'));
    expect(new Headers(call?.init?.headers).get('Authorization')).toBe('Bearer tok-123');
  });
});

describe('sign-off workflow on the Overview', () => {
  it('lets an analyst submit a draft plan', async () => {
    const calls = mockApi({ plan: plan('DRAFT') });
    renderApp('analyst');
    fireEvent.click(await screen.findByRole('button', { name: /submit for approval/i }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/submit'))).toBe(true));
  });

  it('keeps Approve disabled until the rationale has 10 characters, then approves', async () => {
    const calls = mockApi({ plan: plan('PENDING_APPROVAL') });
    renderApp('approver');
    const approve = await screen.findByRole('button', { name: /approve plan/i });
    expect(approve).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/operational rationale/i), { target: { value: 'Verified with district control room.' } });
    expect(approve).toBeEnabled();
    fireEvent.click(approve);
    await waitFor(() => {
      const call = calls.find((c) => c.url.includes('/approval'));
      expect(JSON.parse(String(call?.init?.body))).toMatchObject({ decision: 'APPROVE' });
    });
  });

  it('tells the plan author they cannot sign off their own plan', async () => {
    mockApi({ plan: plan('PENDING_APPROVAL', 'admin-1') });
    renderApp('admin', 'admin-1');
    expect(await screen.findByText(/someone else must sign it off/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve plan/i })).not.toBeInTheDocument();
  });

  it('hides decisions from analysts and shows loaded numbers, not placeholders', async () => {
    mockApi({ plan: plan('PENDING_APPROVAL') });
    renderApp('analyst');
    expect(await screen.findByText(/waiting for the incident lead/i)).toBeInTheDocument();
    expect(await screen.findByText('2 depots')).toBeInTheDocument();
    expect(screen.getByText('≥ 35%')).toBeInTheDocument(); // alpha comes from the scenario
  });

  it('shows who approved and offers the deployable download', async () => {
    const approved = plan('APPROVED');
    approved.approval_state.reviewed_by = 'Incident Lead';
    approved.approval_state.rationale = 'Convoy cleared by patrol.';
    mockApi({ plan: approved });
    renderApp('analyst');
    expect(await screen.findByText(/approved by incident lead/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download deployable plan/i })).toBeInTheDocument();
  });
});

describe('field observations', () => {
  it('is read-only for approvers', async () => {
    mockApi();
    window.location.hash = '#/observations';
    renderApp('approver');
    expect(await screen.findByText(/read-only role/i)).toBeInTheDocument();
  });

  it('filters the link list with a debounced search', async () => {
    mockApi({ edges: ['ROAD-NORTH-1', 'ROAD-SOUTH-2', 'BRIDGE-EAST-3'] });
    window.location.hash = '#/observations';
    renderApp('field_analyst');
    const select = await screen.findByLabelText('Road link');
    await waitFor(() => expect(select.querySelectorAll('option')).toHaveLength(3));
    fireEvent.change(screen.getByLabelText(/find a road link/i), { target: { value: 'bridge' } });
    await waitFor(() => expect(select.querySelectorAll('option')).toHaveLength(1));
    expect(select).toHaveDisplayValue(/BRIDGE-EAST-3/);
  });
});

describe('observation form accessibility', () => {
  it('labels every control', () => {
    render(<ObservationEditor edgeId="EDGE-1" onSubmit={() => {}} />);
    for (const label of [
      'Observed road passability status',
      'Observation reporting source',
      'Source credibility weight slider',
      'Standing water depth in centimeters',
      'Field verification notes',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('disables saving while a request is in flight', () => {
    render(<ObservationEditor edgeId="EDGE-1" onSubmit={() => {}} disabled />);
    expect(screen.getByRole('button', { name: /save observation/i })).toBeDisabled();
  });
});

describe('hooks', () => {
  it('useAsync reports loading, data, then a retryable error', async () => {
    let attempt = 0;
    const { result } = renderHook(() =>
      useAsync(async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('boom');
        return 'ok';
      }, []),
    );
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.error).toBe('boom'));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe('ok'));
    expect(result.current.error).toBeNull();
  });

  it('useDebouncedValue waits for typing to pause', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 200), { initialProps: { v: 'a' } });
    rerender({ v: 'ab' });
    rerender({ v: 'abc' });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe('abc');
    vi.useRealTimers();
  });
});

describe('session expiry', () => {
  it('returns to the sign-in screen when the API answers 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ detail: 'expired' }), { status: 401 }))),
    );
    renderApp('analyst');
    expect(await screen.findByText(/your session expired/i)).toBeInTheDocument();
  });
});
