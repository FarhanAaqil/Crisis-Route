import React, { useState } from 'react';
import { Role, ApproverOnlyGuard } from '../auth/guards';

interface ScenarioSummary {
  scenario_id: string;
  name: string;
  region_name: string;
  created_at: string;
}

export const Dashboard: React.FC = () => {
  const [activeRole, setActiveRole] = useState<Role>('analyst');
  const [rationale, setRationale] = useState<string>('');
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

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
    <div className="max-w-6xl mx-auto p-6 space-y-6 font-sans">
      {/* Header and Mandatory Safety Banner */}
      <header className="border-b pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">CrisisRoute Decision Support Platform</h1>
            <p className="text-sm text-slate-500">Uncertainty-Aware Humanitarian Logistics & Equitable Routing</p>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-slate-600 font-medium">Active Role:</span>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as Role)}
              className="border border-slate-300 rounded px-2 py-1 bg-white"
            >
              <option value="analyst">Logistics Coordinator (Analyst)</option>
              <option value="field_analyst">Field Analyst</option>
              <option value="approver">Incident Lead Approver</option>
            </select>
          </div>
        </div>

        {/* Operational Safety Invariant Disclaimer */}
        <div className="mt-4 p-3 bg-amber-50 border-l-4 border-amber-500 text-amber-900 text-xs rounded">
          <span className="font-semibold uppercase tracking-wider">Mandatory Operational Notice:</span> CrisisRoute provides probabilistic decision support under road uncertainty. It does not certify route safety or replace ground situational reports.
        </div>
      </header>

      {/* Main Scenario Card */}
      <section className="bg-white border rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
              Active Regional Scenario
            </span>
            <h2 className="text-lg font-bold text-slate-800 mt-1">{mockScenario.name}</h2>
            <p className="text-sm text-slate-500">Region: {mockScenario.region_name} | State: Kerala, India</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">ID: {mockScenario.scenario_id.slice(0, 8)}...</span>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-4 gap-4 pt-2">
          <div className="p-3 bg-slate-50 border rounded">
            <div className="text-xs text-slate-500">Target Corridor</div>
            <div className="text-sm font-semibold text-slate-800">Wayanad - SH54 / NH766</div>
          </div>
          <div className="p-3 bg-slate-50 border rounded">
            <div className="text-xs text-slate-500">Staleness Penalty</div>
            <div className="text-sm font-semibold text-slate-800">&lambda;_s = 0.15 / hr</div>
          </div>
          <div className="p-3 bg-slate-50 border rounded">
            <div className="text-xs text-slate-500">Worst Group Floor</div>
            <div className="text-sm font-semibold text-emerald-600">&ge; 40.0% Protected</div>
          </div>
          <div className="p-3 bg-slate-50 border rounded">
            <div className="text-xs text-slate-500">Solver Time Budget</div>
            <div className="text-sm font-semibold text-slate-800">30s (Incumbent Fallback)</div>
          </div>
        </div>
      </section>

      {/* Approver Action Panel */}
      <section className="bg-white border rounded-lg p-5 shadow-sm space-y-4">
        <h3 className="text-md font-semibold text-slate-900">Incident Lead Sign-Off Gate</h3>
        <p className="text-xs text-slate-500">
          Every relief plan requires explicit written justification by the Incident Lead Approver prior to field action.
        </p>

        <ApproverOnlyGuard currentRole={activeRole}>
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Operational Rationale &amp; Risk Acceptance (Mandatory):
              </label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="State the operational basis, rejected route alternatives, and ground verification details..."
                className="w-full border rounded p-2 text-sm h-20"
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded"
              >
                Approve &amp; Seal Relief Plan
              </button>
              <button
                onClick={() => setApprovalMessage('Plan rejected. Revisions required from logistics coordinator.')}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-medium rounded"
              >
                Reject &amp; Request What-If Revision
              </button>
            </div>
            {approvalMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded">
                {approvalMessage}
              </div>
            )}
          </div>
        </ApproverOnlyGuard>
      </section>
    </div>
  );
};
