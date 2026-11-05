import React from 'react';
import { InfeasibilityDiagnostic } from '../api/client';

export interface SolverDiagnosticsProps {
  solverStatus: string;
  solveTimeSeconds: number;
  snapshotId: string;
  infeasibilityDiagnostic?: InfeasibilityDiagnostic | null;
}

export const SolverDiagnostics: React.FC<SolverDiagnosticsProps> = ({
  solverStatus,
  solveTimeSeconds,
  snapshotId,
  infeasibilityDiagnostic,
}) => {
  const getStatusBadge = () => {
    switch (solverStatus) {
      case 'OPTIMAL':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'FEASIBLE':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'NON_OPTIMAL_INCUMBENT':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'INFEASIBLE':
      case 'MODEL_INVALID':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Solver Engine Diagnostics</h3>
          <p className="text-xs text-slate-500">
            Constraint Satisfaction (OR-Tools CP-SAT) execution metrics and feasibility checks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded border ${getStatusBadge()}`}>
            {solverStatus}
          </span>
          <span className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200">
            {solveTimeSeconds.toFixed(2)}s
          </span>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-600 flex flex-wrap gap-4 items-center">
        <div>
          <span className="font-semibold text-slate-700">Snapshot Integrity: </span>
          <span className="font-mono text-slate-500">{snapshotId.slice(0, 16)}...</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">Timeout Limit: </span>
          <span>30s CPU Bound</span>
        </div>
      </div>

      {/* Infeasibility Minimal Infeasible Subsystem (IIS) Diagnostic Details */}
      {infeasibilityDiagnostic && (
        <div className="mt-4 p-3.5 bg-rose-50/80 rounded-lg border border-rose-200 text-sm text-rose-900">
          <div className="flex items-center gap-2 mb-2 font-semibold">
            <svg
              className="w-4 h-4 text-rose-600 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>Infeasibility Explanation (Minimal Infeasible Subsystem)</span>
          </div>

          {infeasibilityDiagnostic.primary_cause && (
            <p className="text-xs text-rose-800 font-medium mb-3">
              {infeasibilityDiagnostic.primary_cause}
            </p>
          )}

          {infeasibilityDiagnostic.isolated_demand_nodes?.length > 0 && (
            <div className="mb-2.5 text-xs">
              <span className="font-bold">Isolated Demand Nodes: </span>
              <span className="font-mono text-rose-700">
                {infeasibilityDiagnostic.isolated_demand_nodes.join(', ')}
              </span>
            </div>
          )}

          {Object.keys(infeasibilityDiagnostic.commodity_deficits || {}).length > 0 && (
            <div className="mb-2.5">
              <span className="text-xs font-bold block mb-1">Stock Deficits:</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(infeasibilityDiagnostic.commodity_deficits).map(([cid, deficit]) => (
                  <span
                    key={cid}
                    className="text-xs bg-rose-100 text-rose-800 font-mono px-2 py-0.5 rounded border border-rose-300"
                  >
                    {cid}: -{String(deficit)} units
                  </span>
                ))}
              </div>
            </div>
          )}

          {infeasibilityDiagnostic.remediation_suggestions?.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-rose-200/70 text-xs text-slate-700">
              <span className="font-bold text-slate-800 block mb-1">Recommended Remediation:</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                {infeasibilityDiagnostic.remediation_suggestions.map((sug: string, i: number) => (
                  <li key={i}>{sug}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

