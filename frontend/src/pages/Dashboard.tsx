import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Download,
  FileCheck2,
  Send,
  ShieldCheck,
  Truck,
  Users,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  PlanDetail,
  exportPlan,
  fetchScenarioResources,
  submitPlanApproval,
  submitPlanForApproval,
} from '../api/client';
import { useAsync, errorMessage } from '../hooks/useAsync';
import { CardSkeleton, Skeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StateViews';

type PlanStatus = PlanDetail['approval_state']['status'];

const STATUS_COLOR: Record<PlanStatus, string> = {
  DRAFT: 'text-palette-frost',
  PENDING_APPROVAL: 'text-amber-300',
  APPROVED: 'text-emerald-300',
  REJECTED: 'text-rose-300',
};

const STEPS = ['Optimize', 'Submit', 'Sign-off'] as const;

function currentStep(plan: PlanDetail | null): number {
  if (!plan) return 0;
  switch (plan.approval_state.status) {
    case 'DRAFT':
      return 1;
    case 'PENDING_APPROVAL':
      return 2;
    default:
      return 3;
  }
}

const Stepper: React.FC<{ step: number }> = ({ step }) => (
  <ol className="flex items-center gap-2 text-[11px] font-semibold" aria-label="Plan workflow">
    {STEPS.map((label, i) => {
      const done = i < step;
      const active = i === step;
      return (
        <li key={label} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center border text-[11px] ${
              done
                ? 'bg-emerald-500/80 border-emerald-300 text-slate-950'
                : active
                  ? 'bg-palette-frost text-palette-deep border-palette-cream'
                  : 'border-palette-slate/60 text-palette-slate'
            }`}
          >
            {done ? '✓' : i + 1}
          </span>
          <span className={active ? 'text-palette-cream' : 'text-palette-frost/80'}>{label}</span>
          {i < STEPS.length - 1 && <span className="w-6 h-px bg-palette-slate/50" aria-hidden="true" />}
        </li>
      );
    })}
  </ol>
);

export const Dashboard: React.FC = () => {
  const { activeScenarioId, activeScenario, scenarioDetail, activeRole, userId, activePlan, setActivePlan, notify } =
    useApp();
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resources = useAsync(
    () => (activeScenarioId ? fetchScenarioResources(activeScenarioId) : Promise.resolve(null)),
    [activeScenarioId],
  );

  const status = activePlan?.approval_state.status ?? null;
  const isAuthor = !!activePlan?.generated_by && activePlan.generated_by === userId;
  const canSubmit = activeRole === 'analyst' || activeRole === 'admin';
  const canDecide = activeRole === 'approver' || activeRole === 'admin';
  const rationaleOk = rationale.trim().length >= 10;
  const totalDemand = resources.data
    ? Object.values(resources.data.total_demand_by_commodity).reduce((a, b) => a + b, 0)
    : 0;
  const alpha = scenarioDetail?.equity_parameters.min_group_service_floor_alpha;

  const run = async (action: () => Promise<PlanDetail>, success: string) => {
    setBusy(true);
    setFormError(null);
    try {
      const updated = await action();
      setActivePlan(updated);
      setRationale('');
      notify(success, 'success');
    } catch (err) {
      const message = errorMessage(err);
      setFormError(message);
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const downloadPlan = async () => {
    if (!activePlan) return;
    try {
      const data = await exportPlan(activePlan.scenario_id, activePlan.plan_id);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `crisisroute-plan-${activePlan.plan_id.slice(0, 8)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify(errorMessage(err), 'error');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <section className="glass-card rounded-3xl p-6 shadow-glass-card space-y-5">
        <div className="flex flex-col lg:flex-row justify-between gap-4 border-b border-palette-slate/25 pb-5">
          <div className="space-y-1">
            <span className="text-xs font-bold px-3 py-1 bg-palette-steel/50 text-palette-cream border border-palette-frost/30 rounded-full">
              Active operational corridor
            </span>
            {activeScenario ? (
              <>
                <h1 className="text-xl font-extrabold text-palette-cream tracking-tight mt-2">{activeScenario.name}</h1>
                <p className="text-xs text-palette-frost">{activeScenario.region_name}</p>
              </>
            ) : (
              <Skeleton className="h-6 w-72 mt-2" />
            )}
          </div>
          <Stepper step={currentStep(activePlan)} />
        </div>

        {resources.error ? (
          <ErrorState message={resources.error} onRetry={resources.reload} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {resources.loading && !resources.data ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : (
              <>
                <div className="p-4 glass-card-subtle rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between text-palette-frost text-xs">
                    <span>Staging depots</span>
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="text-base font-bold text-palette-cream">{resources.data?.depots.length ?? 0} depots</div>
                  <span className="text-[11px] text-palette-frost block font-mono">
                    Fleet: {resources.data?.vehicles.length ?? 0} vehicles ·{' '}
                    {Math.round(resources.data?.total_fleet_capacity_kg ?? 0).toLocaleString()} kg
                  </span>
                </div>

                <div className="p-4 glass-card-subtle rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between text-palette-frost text-xs">
                    <span>Demand clusters</span>
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-base font-bold text-palette-cream">
                    {resources.data?.demand_nodes.length ?? 0} clusters
                  </div>
                  <span className="text-[11px] text-palette-frost block font-mono">
                    Total demand: {totalDemand.toLocaleString()} units
                  </span>
                </div>

                <div className="p-4 glass-card-subtle rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between text-palette-frost text-xs">
                    <span>Protected-group floor</span>
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-base font-bold text-emerald-300 font-mono">
                    {alpha !== undefined ? `≥ ${Math.round(alpha * 100)}%` : '--'}
                  </div>
                  <span className="text-[11px] text-emerald-300/80 block">of each commodity, per protected node</span>
                </div>

                <div className="p-4 glass-card-subtle rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between text-palette-frost text-xs">
                    <span>Plan status</span>
                    <FileCheck2 className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className={`text-base font-extrabold font-mono ${status ? STATUS_COLOR[status] : 'text-palette-frost'}`}>
                    {status ? status.replace('_', ' ') : 'NO PLAN'}
                  </div>
                  <span className="text-[11px] text-palette-frost block font-mono">
                    {activePlan ? `Solver: ${activePlan.solver_status.toLowerCase().replace(/_/g, ' ')}` : 'Run the optimizer first'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="glass-card rounded-3xl p-6 shadow-glass-card space-y-4" aria-labelledby="signoff-title">
        <div className="flex items-center space-x-2.5 border-b border-palette-slate/25 pb-3">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
          <h2 id="signoff-title" className="text-base font-bold text-palette-cream">
            Incident Lead sign-off
          </h2>
        </div>
        <p className="text-xs text-palette-frost leading-relaxed">
          A plan is generated by an analyst, submitted, and then approved or rejected by a different person with a
          written rationale. Approval is refused if field reports changed since the plan was made.
        </p>

        {formError && <ErrorState message={formError} />}

        {!activePlan && (
          <EmptyState title="No plan for this scenario yet" hint="Open Resource Allocation and run the optimizer." />
        )}

        {activePlan && status === 'DRAFT' && (
          <div className="space-y-3">
            <p className="text-xs text-palette-cream">This plan is a draft. Submit it so the Incident Lead can review it.</p>
            {canSubmit ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() => submitPlanForApproval(activePlan.plan_id), 'Plan submitted for approval.')
                }
                className="px-5 py-2.5 glass-btn-primary rounded-2xl text-xs font-bold min-h-[44px] flex items-center space-x-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{busy ? 'Submitting...' : 'Submit for approval'}</span>
              </button>
            ) : (
              <p className="text-xs text-palette-frost">Waiting for an analyst to submit this plan.</p>
            )}
          </div>
        )}

        {activePlan && status === 'PENDING_APPROVAL' && (
          <>
            {canDecide ? (
              isAuthor ? (
                <p role="status" className="text-xs p-3 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200">
                  You generated this plan, so someone else must sign it off.
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="approver-rationale" className="block text-xs font-semibold text-palette-cream mb-1.5">
                      Operational rationale and risk acceptance
                    </label>
                    <textarea
                      id="approver-rationale"
                      value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      maxLength={2000}
                      placeholder="State the operational basis, rejected alternatives and ground verification."
                      className="w-full glass-input rounded-2xl p-3.5 text-xs text-palette-cream placeholder-palette-slate h-24 focus:outline-none focus:ring-2 focus:ring-palette-frost"
                    />
                    <p className={`text-[11px] mt-1 ${rationaleOk ? 'text-emerald-300' : 'text-palette-frost'}`}>
                      {rationale.trim().length}/10 characters minimum
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      disabled={busy || !rationaleOk}
                      onClick={() =>
                        run(
                          () => submitPlanApproval(activePlan.plan_id, 'APPROVE', rationale),
                          'Plan approved and sealed in the audit ledger.',
                        )
                      }
                      className="px-6 py-2.5 bg-gradient-to-r from-emerald-600/90 to-emerald-500/90 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 text-white text-xs font-bold rounded-2xl border border-emerald-400/30 min-h-[44px] flex items-center justify-center space-x-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{busy ? 'Sealing...' : 'Approve plan'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy || !rationaleOk}
                      onClick={() =>
                        run(
                          () => submitPlanApproval(activePlan.plan_id, 'REJECT', rationale),
                          'Plan rejected and returned to the analyst.',
                        )
                      }
                      className="px-6 py-2.5 glass-card-subtle hover:bg-palette-steel/50 disabled:opacity-40 text-palette-cream text-xs font-semibold rounded-2xl border border-palette-frost/25 min-h-[44px] flex items-center justify-center space-x-2"
                    >
                      <XCircle className="w-4 h-4 text-palette-frost" />
                      <span>Reject plan</span>
                    </button>
                  </div>
                </div>
              )
            ) : (
              <p className="text-xs text-palette-frost">Submitted and waiting for the Incident Lead's decision.</p>
            )}
          </>
        )}

        {activePlan && (status === 'APPROVED' || status === 'REJECTED') && (
          <div
            role="status"
            className={`p-4 rounded-2xl border text-xs space-y-2 ${
              status === 'APPROVED'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            <p className="font-bold">
              {status === 'APPROVED' ? 'Approved' : 'Rejected'} by {activePlan.approval_state.reviewed_by ?? 'Incident Lead'}
              {activePlan.approval_state.reviewed_at && <> on {new Date(activePlan.approval_state.reviewed_at).toLocaleString()}</>}
            </p>
            {activePlan.approval_state.rationale && <p className="italic">"{activePlan.approval_state.rationale}"</p>}
            {status === 'APPROVED' && (
              <button
                type="button"
                onClick={downloadPlan}
                className="mt-1 px-4 py-2 glass-btn-primary rounded-xl text-xs font-bold min-h-[40px] flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download deployable plan (JSON)</span>
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
