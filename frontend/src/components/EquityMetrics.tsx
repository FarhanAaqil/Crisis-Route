import React from 'react';
import { EquityEvaluation } from '../api/client';

export interface EquityMetricsProps {
  equity: EquityEvaluation;
}

export const EquityMetrics: React.FC<EquityMetricsProps> = ({ equity }) => {
  if (!equity) return null;

  const giniPct = Math.round(equity.gini_coefficient * 100);
  const vulnRatioPct = Math.round(equity.vulnerable_group_fulfillment_ratio * 100);
  const meanRatioPct = Math.round(equity.mean_fulfillment_ratio * 100);
  const alphaFloorPct = Math.round(equity.alpha_service_floor * 100);

  return (
    <div className="glass-card rounded-3xl p-6 shadow-glass-card border border-palette-frost/25 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 border-b border-palette-slate/25 pb-3 gap-2">
        <div>
          <h3 className="text-base font-bold text-palette-cream">Equitable Relief Metrics</h3>
          <p className="text-xs text-palette-frost mt-0.5">
            Fairness audits, deprivation penalties, and vulnerable group protection floors.
          </p>
        </div>
        <span
          className={`text-xs font-mono font-bold px-3 py-1 rounded-xl border self-start sm:self-auto ${
            equity.alpha_floor_satisfied
              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/40'
              : 'bg-rose-950/70 text-rose-300 border-rose-800/40'
          }`}
        >
          {equity.alpha_floor_satisfied ? 'α-Floor Satisfied' : 'α-Floor Deficit'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Gini Coefficient */}
        <div className="glass-card-subtle rounded-2xl p-4 border border-palette-frost/20">
          <div className="flex items-center justify-between text-xs text-palette-frost mb-1.5 font-mono">
            <span className="font-semibold text-palette-cream">Gini Inequality</span>
            <span>{equity.gini_coefficient.toFixed(3)}</span>
          </div>
          <div className="w-full bg-palette-deep/80 rounded-full h-2 mb-2 overflow-hidden border border-palette-frost/20">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                equity.gini_coefficient <= 0.25
                  ? 'bg-emerald-400'
                  : equity.gini_coefficient <= 0.45
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              }`}
              style={{ width: `${Math.min(100, giniPct)}%` }}
            />
          </div>
          <p className="text-[11px] text-palette-frost/80">
            {equity.gini_coefficient <= 0.25
              ? 'Near-equal distribution'
              : 'Moderate distribution skew'}
          </p>
        </div>

        {/* Vulnerable Group Fulfillment */}
        <div className="glass-card-subtle rounded-2xl p-4 border border-palette-frost/20">
          <div className="flex items-center justify-between text-xs text-palette-frost mb-1.5 font-mono">
            <span className="font-semibold text-palette-cream">Vulnerable Groups</span>
            <span>{vulnRatioPct}%</span>
          </div>
          <div className="w-full bg-palette-deep/80 rounded-full h-2 mb-2 overflow-hidden border border-palette-frost/20">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                equity.alpha_floor_satisfied ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
              style={{ width: `${Math.min(100, vulnRatioPct)}%` }}
            />
          </div>
          <p className="text-[11px] text-palette-frost/80">Floor target: ≥ {alphaFloorPct}%</p>
        </div>

        {/* Mean Network Fulfillment */}
        <div className="glass-card-subtle rounded-2xl p-4 border border-palette-frost/20">
          <div className="flex items-center justify-between text-xs text-palette-frost mb-1.5 font-mono">
            <span className="font-semibold text-palette-cream">Overall Delivery</span>
            <span>{meanRatioPct}%</span>
          </div>
          <div className="w-full bg-palette-deep/80 rounded-full h-2 mb-2 overflow-hidden border border-palette-frost/20">
            <div
              className="h-2 rounded-full bg-palette-frost transition-all duration-300"
              style={{ width: `${Math.min(100, meanRatioPct)}%` }}
            />
          </div>
          <p className="text-[11px] text-palette-frost/80">
            Min cluster fulfillment: {(equity.min_fulfillment_ratio * 100).toFixed(0)}%
          </p>
        </div>

        {/* Deprivation Loss Penalty */}
        <div className="glass-card-subtle rounded-2xl p-4 border border-palette-frost/20">
          <div className="flex items-center justify-between text-xs text-palette-frost mb-1.5 font-mono">
            <span className="font-semibold text-palette-cream">Deprivation Loss</span>
            <span className="font-mono font-bold text-amber-300">
              {equity.total_deprivation_penalty.toFixed(1)}
            </span>
          </div>
          <p className="text-xs font-semibold text-palette-cream mt-1">
            {equity.unmet_demand_count} Unmet Demands
          </p>
          <p className="text-[11px] text-palette-frost/80">Convex priority-weighted penalty</p>
        </div>
      </div>
    </div>
  );
};
