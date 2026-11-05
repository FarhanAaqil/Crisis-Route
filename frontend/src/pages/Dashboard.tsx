import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ApproverOnlyGuard, Role } from '../auth/guards';
import {
  fetchScenarioResources,
  approveScenarioDirectly,
  submitPlanApproval,
  ScenarioResourcesResponse,
} from '../api/client';
import { ThreeTacticalRadar } from '../components/ThreeTacticalRadar';
import {
  ShieldCheck,
  Truck,
  Users,
  Activity,
  CheckCircle2,
  XCircle,
  FileCheck2,
} from 'lucide-react';

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
      <header className="border-b border-palette-slate/25 pb-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-palette-steel via-palette-deep to-palette-frost p-0.5 shadow-glass-card">
              <div className="w-full h-full bg-palette-deep/90 rounded-[14px] flex items-center justify-center text-palette-cream font-extrabold text-base tracking-tight">
                CR
              </div>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-palette-cream tracking-tight">
                CrisisRoute Decision Support Platform
              </h1>
              <p className="text-xs sm:text-sm text-palette-frost">
                Uncertainty-Aware Humanitarian Logistics &amp; Equitable Multi-Commodity Routing
              </p>
            </div>
          </div>

          {/* Regional Disaster Scenario Selector */}
          <div className="flex items-center space-x-2 text-xs self-stretch sm:self-auto glass-card-subtle p-1.5 rounded-2xl border border-palette-frost/25">
            <label htmlFor="scenario-select" className="text-palette-frost font-semibold pl-2">
              Disaster Region:
            </label>
            <select
              id="scenario-select"
              aria-label="Active disaster scenario selector"
              value={activeScenarioId}
              onChange={(e) => setActiveScenarioId(e.target.value)}
              className="glass-input rounded-xl px-3 py-1.5 text-xs text-palette-cream font-medium shadow-inner focus:outline-none focus:ring-2 focus:ring-palette-frost min-h-[36px]"
            >
              {scenarios.map((s) => (
                <option key={s.scenario_id} value={s.scenario_id} className="bg-palette-deep text-palette-cream">
                  {s.name} ({s.region_name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Operational Safety Notice */}
        <div className="mt-4 p-4 bg-amber-500/90 text-slate-950 text-xs rounded-2xl flex items-center space-x-2.5 shadow-glass-card backdrop-blur-md">
          <span className="bg-slate-950 text-amber-400 px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider shrink-0">
            Mandatory Operational Notice:
          </span>
          <span className="font-semibold leading-relaxed">
            CrisisRoute provides probabilistic decision support under road uncertainty. It does not
            certify route safety or replace ground situational reports.
          </span>
        </div>
      </header>

      {/* Main Scenario Overview Card with Frosted Glassmorphism */}
      <section className="glass-card rounded-3xl p-6 sm:p-7 shadow-glass-card relative overflow-hidden space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-palette-slate/25 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold px-3 py-1 bg-palette-steel/50 text-palette-cream border border-palette-frost/30 rounded-full tracking-wide">
                Active Operational Corridor
              </span>
              <span className="text-xs font-mono text-palette-sage bg-palette-deep/70 px-2.5 py-0.5 rounded-md border border-palette-slate/40">
                NDMA Protocol Phase II
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-palette-cream tracking-tight mt-1">
              {activeScenario ? activeScenario.name : 'Loading Regional Scenario...'}
            </h2>
            <p className="text-xs text-palette-frost">
              Region: {activeScenario?.region_name || 'India'} | State Protocol: National Disaster Management (NDMA)
            </p>
          </div>

          <div className="flex items-center space-x-4 self-end lg:self-auto">
            <span className="text-xs text-palette-frost font-mono glass-card-subtle px-3 py-1.5 rounded-xl border border-palette-frost/25">
              ID: {activeScenarioId ? activeScenarioId.slice(0, 8) : '...'}...
            </span>
            <div className="hidden sm:block">
              <ThreeTacticalRadar size={84} activeRegion={activeScenario?.region_name} />
            </div>
          </div>
        </div>

        {/* Real Dynamic Tactical Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Warehouses Card */}
          <div className="p-4 glass-card-subtle rounded-2xl space-y-1.5 hover:-translate-y-1 hover:border-palette-frost/40 hover:shadow-glass-glow transition-all duration-300 group">
            <div className="flex items-center justify-between text-palette-frost text-xs">
              <span>Staging Depots</span>
              <Truck className="w-4 h-4 text-palette-frost group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-base font-bold text-palette-cream">
              {resources ? `${resources.depots.length} Warehouses` : '2 Warehouses'}
            </div>
            <span className="text-[11px] text-palette-frost block font-mono">
              Fleet: {resources ? resources.vehicles.length : 4} All-Terrain Trucks
            </span>
          </div>

          {/* Demand Clusters Card */}
          <div className="p-4 glass-card-subtle rounded-2xl space-y-1.5 hover:-translate-y-1 hover:border-palette-frost/40 hover:shadow-glass-glow transition-all duration-300 group">
            <div className="flex items-center justify-between text-palette-frost text-xs">
              <span>Isolated Demand Clusters</span>
              <Users className="w-4 h-4 text-palette-frost group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-base font-bold text-palette-cream">
              {resources ? `${resources.demand_nodes.length} Clusters` : '4 Clusters'}
            </div>
            <span className="text-[11px] text-palette-frost block font-mono">
              Total Demand: {totalDemandQty} Units
            </span>
          </div>

          {/* Worst-Group Floor Guarantee */}
          <div className="p-4 glass-card-subtle rounded-2xl space-y-1.5 hover:-translate-y-1 hover:border-palette-frost/40 hover:shadow-glass-glow transition-all duration-300 group">
            <div className="flex items-center justify-between text-palette-frost text-xs">
              <span>Worst Group Floor (α)</span>
              <Activity className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-base font-bold text-emerald-300 font-mono">
              ≥ 40.0% Guaranteed
            </div>
            <span className="text-[11px] text-emerald-300/80 block font-medium">
              Protected Minority Priority
            </span>
          </div>

          {/* Approval Status Card */}
          <div className="p-4 glass-card-subtle rounded-2xl space-y-1.5 hover:-translate-y-1 hover:border-palette-frost/40 hover:shadow-glass-glow transition-all duration-300 group">
            <div className="flex items-center justify-between text-palette-frost text-xs">
              <span>Plan Approval Status</span>
              <FileCheck2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <div
              className={`text-base font-extrabold font-mono ${
                activePlan?.approval_state.status === 'APPROVED'
                  ? 'text-emerald-300'
                  : activePlan?.approval_state.status === 'REJECTED'
                  ? 'text-rose-300'
                  : 'text-amber-300'
              }`}
            >
              {activePlan?.approval_state.status || 'PENDING_APPROVAL'}
            </div>
            <span className="text-[11px] text-palette-frost block font-mono">
              {activePlan ? `Solver: ${activePlan.solver_status}` : 'Awaiting Solver Run'}
            </span>
          </div>
        </div>
      </section>

      {/* Approver Sign-Off Gate Panel */}
      <section className="glass-card rounded-3xl p-6 sm:p-7 shadow-glass-card space-y-4">
        <div className="flex items-center space-x-2.5 border-b border-palette-slate/25 pb-3">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
          <h3 className="text-base sm:text-lg font-bold text-palette-cream">Incident Lead Sign-Off Gate</h3>
        </div>
        <p className="text-xs text-palette-frost leading-relaxed">
          Every relief plan requires explicit written justification by the Incident Lead Approver prior to field action.
        </p>

        <ApproverOnlyGuard currentRole={effectiveRole}>
          <div className="space-y-4 pt-2">
            <div>
              <label htmlFor="approver-rationale" className="block text-xs font-semibold text-palette-cream mb-1.5">
                Operational Rationale &amp; Risk Acceptance (Mandatory):
              </label>
              <textarea
                id="approver-rationale"
                aria-label="Mandatory operational rationale and risk acceptance text"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="State the operational basis, rejected route alternatives, and ground verification details..."
                className="w-full glass-input rounded-2xl p-3.5 text-xs text-palette-cream placeholder-palette-slate h-24 focus:outline-none focus:ring-2 focus:ring-palette-frost shadow-inner font-sans"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleApprove}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600/90 to-emerald-500/90 hover:from-emerald-500 hover:to-emerald-400 active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-2xl shadow-glass-card border border-emerald-400/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[44px] transition-all flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Sealing...' : 'Approve & Seal Relief Plan'}</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleReject}
                className="px-6 py-2.5 glass-card-subtle hover:bg-palette-steel/50 active:scale-95 disabled:opacity-50 text-palette-cream text-xs font-semibold rounded-2xl border border-palette-frost/25 shadow-glass-card focus:outline-none focus:ring-2 focus:ring-palette-frost min-h-[44px] transition-all flex items-center justify-center space-x-2"
              >
                <XCircle className="w-4 h-4 text-palette-frost" />
                <span>Reject &amp; Request What-If Revision</span>
              </button>
            </div>
            {approvalMessage && (
              <div
                role="status"
                className="p-3.5 bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs rounded-2xl font-medium flex items-center space-x-2 shadow-glass-card"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{approvalMessage}</span>
              </div>
            )}
          </div>
        </ApproverOnlyGuard>
      </section>
    </div>
  );
};
