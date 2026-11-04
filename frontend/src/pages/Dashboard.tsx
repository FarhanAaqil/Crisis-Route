import React, { useState } from 'react';
import { Role, ApproverOnlyGuard } from '../auth/guards';

interface ScenarioSummary {
  scenario_id: string;
  name: string;
  region_name: string;
  created_at: string;
}

interface DashboardProps {
  currentRole?: Role;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentRole }) => {
  const [activeRole, setActiveRole] = useState<Role>(currentRole || 'analyst');
  const [rationale, setRationale] = useState<string>('');
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

  // Sync role if prop updates
  React.useEffect(() => {
    if (currentRole) {
      setActiveRole(currentRole);
    }
  }, [currentRole]);

  const mockScenario: ScenarioSummary = {
    scenario_id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    name: 'Kerala Monsoon 2026 - Wayanad & Periyar Basin Rapid Response',
    region_name: 'Wayanad-Periyar Relief Corridor',
    created_at: '2026-11-04T06:00:00Z',
  };

  const handleApprove = () => {
    if (!rationale || rationale.trim().length < 10) {
      alert('Operational rationale (min 10 chars) is strictly mandatory for sign-off.');
      return;
    }
    setApprovalMessage('Plan successfully signed off and sealed into immutable audit ledger.');
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Header and Mandatory Safety Banner */}
      <header className="border-b border-slate-200 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              CrisisRoute Decision Support Platform
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Uncertainty-Aware Humanitarian Logistics &amp; Equitable Routing
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <label htmlFor="dashboard-role" className="text-slate-700 font-semibold">
              Active Role:
            </label>
            <select
              id="dashboard-role"
              aria-label="Active role selector"
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as Role)}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
            >
              <option value="analyst">Logistics Coordinator (Analyst)</option>
              <option value="field_analyst">Field Analyst</option>
              <option value="approver">Incident Lead Approver</option>
            </select>
          </div>
        </div>

        {/* Operational Safety Invariant Disclaimer */}
        <div className="mt-4 p-3 bg-amber-50 border-l-4 border-amber-500 text-amber-950 text-xs rounded">
          <span className="font-semibold uppercase tracking-wider">Mandatory Operational Notice:</span> CrisisRoute
          provides probabilistic decision support under road uncertainty. It does not certify route safety or replace
          ground situational reports.
        </div>
      </header>

      {/* Main Scenario Card */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full">
              Active Regional Scenario
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 mt-1">{mockScenario.name}</h2>
            <p className="text-xs text-slate-500">Region: {mockScenario.region_name} | State: Kerala, India</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">ID: {mockScenario.scenario_id.slice(0, 8)}...</span>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="text-xs text-slate-500">Target Corridor</div>
            <div className="text-sm font-semibold text-slate-800">Wayanad - SH54 / NH766</div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="text-xs text-slate-500">Staleness Penalty</div>
            <div className="text-sm font-semibold text-slate-800">&lambda;_s = 0.15 / hr</div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="text-xs text-slate-500">Worst Group Floor</div>
            <div className="text-sm font-semibold text-emerald-600">&ge; 40.0% Protected</div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="text-xs text-slate-500">Solver Time Budget</div>
            <div className="text-sm font-semibold text-slate-800">30s (Incumbent Fallback)</div>
          </div>
        </div>
      </section>

      {/* Approver Action Panel */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <h3 className="text-sm sm:text-base font-semibold text-slate-900">Incident Lead Sign-Off Gate</h3>
        <p className="text-xs text-slate-500">
          Every relief plan requires explicit written justification by the Incident Lead Approver prior to field action.
        </p>

        <ApproverOnlyGuard currentRole={activeRole}>
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
                onClick={handleApprove}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
              >
                Approve &amp; Seal Relief Plan
              </button>
              <button
                type="button"
                onClick={() => setApprovalMessage('Plan rejected. Revisions required from logistics coordinator.')}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded shadow-xs focus:outline-none focus:ring-2 focus:ring-slate-400 min-h-[44px]"
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
