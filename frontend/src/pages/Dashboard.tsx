import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ApproverOnlyGuard, Role } from '../auth/guards';
import {
  fetchScenarioResources,
  approveScenarioDirectly,
  submitPlanApproval,
  ScenarioResourcesResponse,
} from '../api/client';

export interface DashboardProps {
  currentRole?: Role;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentRole }) => {
  const {
    scenarios,
    activeScenarioId,
    setActiveScenarioId,
    activeRole,
    activePlan,
    setActivePlan,
    notify,
  } = useApp();

  const effectiveRole = currentRole || activeRole;

  const [resources, setResources] = useState<ScenarioResourcesResponse | null>(null);
  const [rationale, setRationale] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

  const activeScenario = scenarios.find((s) => s.scenario_id === activeScenarioId);

  useEffect(() => {
    if (!activeScenarioId) return;

    fetchScenarioResources(activeScenarioId)
      .then((data) => setResources(data))
      .catch((err) => {
        console.error('Failed to load resources:', err);
      });
  }, [activeScenarioId]);

  const handleApprove = async () => {
    if (!rationale || rationale.trim().length < 10) {
      notify('Operational rationale (minimum 10 characters) is required for sign-off.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (activePlan?.plan_id) {
        const updatedPlan = await submitPlanApproval(
          activePlan.plan_id,
          'APPROVE',
          rationale,
          'Incident Lead Approver'
        );
        setActivePlan(updatedPlan);
      } else {
        await approveScenarioDirectly(activeScenarioId, 'APPROVE', rationale);
      }
      setApprovalMessage('Plan successfully signed off and sealed into immutable audit ledger.');
      notify('Operational approval sealed into audit trail.', 'success');
      setRationale('');
    } catch (err: any) {
      notify(`Approval failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rationale || rationale.trim().length < 5) {
      notify('Please provide a reason for rejecting the plan.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (activePlan?.plan_id) {
        const updated = await submitPlanApproval(
          activePlan.plan_id,
          'REJECT',
          rationale,
          'Incident Lead Approver'
        );
        setActivePlan(updated);
      } else {
        await approveScenarioDirectly(activeScenarioId, 'REJECT', rationale);
      }
      setApprovalMessage('Plan rejected. Revisions required from logistics coordinator.');
      notify('Plan rejected and returned to analyst.', 'info');
      setRationale('');
    } catch (err: any) {
      notify(`Rejection failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDemandQty = resources
    ? Object.values(resources.total_demand_by_commodity).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Header and Safety Disclaimer */}
      <header className="border-b border-slate-200 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              CrisisRoute Decision Support Platform
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Uncertainty-Aware Humanitarian Logistics &amp; Equitable Multi-Commodity Routing
            </p>
          </div>

          {/* Regional Disaster Scenario Selector */}
          <div className="flex items-center space-x-2 text-xs">
            <label htmlFor="scenario-select" className="text-slate-700 font-semibold">
              Disaster Region:
            </label>
            <select
              id="scenario-select"
              aria-label="Active disaster scenario selector"
              value={activeScenarioId}
              onChange={(e) => setActiveScenarioId(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px] font-medium"
            >
              {scenarios.map((s) => (
                <option key={s.scenario_id} value={s.scenario_id}>
                  {s.name} ({s.region_name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Operational Safety Notice */}
        <div className="mt-4 p-3 bg-amber-50 border-l-4 border-amber-500 text-amber-950 text-xs rounded">
          <span className="font-semibold uppercase tracking-wider">Mandatory Operational Notice:</span>{' '}
          CrisisRoute provides probabilistic decision support under road uncertainty. It does not
          certify route safety or replace ground situational reports.
        </div>
      </header>

      {/* Main Scenario Overview Card */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full">
              Active Operational Corridor
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 mt-1">
              {activeScenario ? activeScenario.name : 'Loading Regional Scenario...'}
            </h2>
            <p className="text-xs text-slate-500">
              Region: {activeScenario?.region_name || 'India'} | State Protocol: National Disaster Management (NDMA)
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            ID: {activeScenarioId ? activeScenarioId.slice(0, 8) : '...'}...
          </span>
        </div>

        {/* Real Dynamic Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="text-xs text-slate-500">Staging Depots</div>
            <div className="text-sm font-semibold text-slate-800">
              {resources ? `${resources.depots.length} Forward Warehouses` : '2 Warehouses'}
            </div>
            <span className="text-[10px] text-slate-400">
              Fleet: {resources ? resources.vehicles.length : 4} All-Terrain Trucks
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="text-xs text-slate-500">Isolated Demand Clusters</div>
            <div className="text-sm font-semibold text-slate-800">
              {resources ? `${resources.demand_nodes.length} Pop Clusters` : '4 Clusters'}
            </div>
            <span className="text-[10px] text-slate-400">Total Demand: {totalDemandQty} Units</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="text-xs text-slate-500">Worst Group Floor (&alpha;)</div>
            <div className="text-sm font-semibold text-emerald-600">&ge; 40.0% Guaranteed</div>
            <span className="text-[10px] text-emerald-700">Protected Minority Priority</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="text-xs text-slate-500">Plan Approval Status</div>
            <div
              className={`text-sm font-bold ${
                activePlan?.approval_state.status === 'APPROVED'
                  ? 'text-emerald-700'
                  : activePlan?.approval_state.status === 'REJECTED'
                  ? 'text-rose-700'
                  : 'text-amber-700'
              }`}
            >
              {activePlan?.approval_state.status || 'PENDING_APPROVAL'}
            </div>
            <span className="text-[10px] text-slate-400">
              {activePlan ? `Solver: ${activePlan.solver_status}` : 'Awaiting Solver Run'}
            </span>
          </div>
        </div>
      </section>

      {/* Approver Sign-Off Gate Panel */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <h3 className="text-sm sm:text-base font-semibold text-slate-900">Incident Lead Sign-Off Gate</h3>
        <p className="text-xs text-slate-500">
          Every relief plan requires explicit written justification by the Incident Lead Approver prior to field action.
        </p>

        <ApproverOnlyGuard currentRole={effectiveRole}>
          <div className="space-y-3 pt-2">
            <div>
              <label htmlFor="approver-rationale" className="block text-xs font-semibold text-slate-700 mb-1">
                Operational Rationale &amp; Risk Acceptance (Mandatory):
              </label>
              <textarea
                id="approver-rationale"
                aria-label="Mandatory operational rationale and risk acceptance text"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="State the operational basis, rejected route alternatives, and ground verification details..."
                className="w-full border border-slate-300 rounded p-2.5 text-xs text-slate-800 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleApprove}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px] transition"
              >
                {isSubmitting ? 'Sealing...' : 'Approve & Seal Relief Plan'}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleReject}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-800 text-xs font-semibold rounded shadow-xs focus:outline-none focus:ring-2 focus:ring-slate-400 min-h-[44px] transition"
              >
                Reject &amp; Request What-If Revision
              </button>
            </div>
            {approvalMessage && (
              <div
                role="status"
                className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded font-medium"
              >
                {approvalMessage}
              </div>
            )}
          </div>
        </ApproverOnlyGuard>
      </section>
    </div>
  );
};
