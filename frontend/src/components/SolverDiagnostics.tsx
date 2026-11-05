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
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/50';
      case 'FEASIBLE':
        return 'bg-palette-steel/60 text-palette-cream border-palette-frost/40';
      case 'NON_OPTIMAL_INCUMBENT':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/50';
      case 'INFEASIBLE':
      case 'MODEL_INVALID':
        return 'bg-rose-950/80 text-rose-300 border-rose-800/50';
      default:
        return 'glass-card-subtle text-palette-frost border-palette-frost/25';
    }
  };

  return (
    <div className="glass-card rounded-3xl p-6 shadow-glass-card border border-palette-frost/25 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-palette-slate/25 gap-3">
        <div>
          <h3 className="text-base font-bold text-palette-cream">Solver Engine Diagnostics</h3>
          <p className="text-xs text-palette-frost mt-0.5">
            Constraint Satisfaction (OR-Tools CP-SAT) execution metrics and feasibility checks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-bold px-3 py-1 rounded-xl border ${getStatusBadge()}`}>
            {solverStatus}
          </span>
          <span className="text-xs text-palette-frost font-mono glass-card-subtle px-3 py-1 rounded-xl border border-palette-frost/25">
            {solveTimeSeconds.toFixed(2)}s
          </span>
        </div>
      </div>

      <div className="mt-3.5 text-xs text-palette-frost flex flex-wrap gap-5 items-center font-mono">
        <div>
          <span className="font-semibold text-palette-cream font-sans">Snapshot Integrity: </span>
          <span className="text-palette-frost">{snapshotId.slice(0, 16)}...</span>
        </div>
        <div>
          <span className="font-semibold text-palette-cream font-sans">Timeout Limit: </span>
          <span className="text-palette-frost">30s CPU Bound</span>
        </div>
        <div>
          <span className="font-semibold text-palette-cream font-sans">Search Strategy: </span>
          <span className="text-palette-frost">Deterministic Presolve + Multi-Threaded LNS</span>
        </div>
      </div>

      {/* Infeasibility Minimal Infeasible Subsystem (IIS) Diagnostic Details */}
      {infeasibilityDiagnostic && (
        <div className="mt-4 p-5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 space-y-3 shadow-glass-card">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <svg
              className="w-4 h-4 text-rose-400 shrink-0"
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
            <p className="text-xs text-rose-200 font-medium leading-relaxed">
              {infeasibilityDiagnostic.primary_cause}
            </p>
          )}

          {infeasibilityDiagnostic.isolated_demand_nodes && infeasibilityDiagnostic.isolated_demand_nodes.length > 0 && (
            <div className="text-xs">
              <span className="font-bold text-rose-300">Isolated Demand Nodes: </span>
              <span className="font-mono text-rose-200">
                {infeasibilityDiagnostic.isolated_demand_nodes.join(', ')}
              </span>
            </div>
          )}

          {infeasibilityDiagnostic.commodity_deficits && Object.keys(infeasibilityDiagnostic.commodity_deficits).length > 0 && (
            <div>
              <span className="text-xs font-bold text-rose-300 block mb-1">Stock Deficits:</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(infeasibilityDiagnostic.commodity_deficits).map(([cid, deficit]) => (
                  <span
                    key={cid}
                    className="text-xs bg-rose-900/60 text-rose-200 font-mono px-2.5 py-1 rounded-xl border border-rose-700/50"
                  >
                    {cid}: -{String(deficit)} units
                  </span>
                ))}
              </div>
            </div>
          )}

          {infeasibilityDiagnostic.remediation_suggestions && infeasibilityDiagnostic.remediation_suggestions.length > 0 && (
            <div className="pt-3 border-t border-rose-800/40 text-xs">
              <span className="font-bold text-rose-300 block mb-1.5">Recommended Remediation:</span>
              <ul className="list-disc list-inside space-y-1 text-rose-200/90 font-sans">
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
