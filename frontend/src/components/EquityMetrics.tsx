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
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Equitable Relief Metrics</h3>
          <p className="text-xs text-slate-500">
            Fairness audits, deprivation penalties, and vulnerable group protection floors.
          </p>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
            equity.alpha_floor_satisfied
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {equity.alpha_floor_satisfied ? 'α-Floor Satisfied' : 'α-Floor Deficit'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Gini Coefficient */}
        <div className="bg-slate-50 rounded p-3 border border-slate-200/60">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span className="font-semibold">Gini Inequality</span>
            <span className="font-mono">{equity.gini_coefficient.toFixed(3)}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 mb-1.5 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                equity.gini_coefficient <= 0.25
                  ? 'bg-emerald-500'
                  : equity.gini_coefficient <= 0.45
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, giniPct)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            {equity.gini_coefficient <= 0.25
              ? 'Near-equal distribution'
              : 'Moderate distribution skew'}
          </p>
        </div>

        {/* Vulnerable Group Fulfillment */}
        <div className="bg-slate-50 rounded p-3 border border-slate-200/60">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span className="font-semibold">Vulnerable Groups</span>
            <span className="font-mono">{vulnRatioPct}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 mb-1.5 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                equity.alpha_floor_satisfied ? 'bg-blue-600' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, vulnRatioPct)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">Floor target: ≥ {alphaFloorPct}%</p>
        </div>

        {/* Mean Network Fulfillment */}
        <div className="bg-slate-50 rounded p-3 border border-slate-200/60">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span className="font-semibold">Overall Delivery</span>
            <span className="font-mono">{meanRatioPct}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 mb-1.5 overflow-hidden">
            <div
              className="h-2 rounded-full bg-teal-500 transition-all duration-300"
              style={{ width: `${Math.min(100, meanRatioPct)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Min cluster fulfillment: {(equity.min_fulfillment_ratio * 100).toFixed(0)}%
          </p>
        </div>

        {/* Deprivation Loss Penalty */}
        <div className="bg-slate-50 rounded p-3 border border-slate-200/60">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span className="font-semibold">Deprivation Loss</span>
            <span className="font-mono font-bold text-amber-700">
              {equity.total_deprivation_penalty.toFixed(1)}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-700 mt-1">
            {equity.unmet_demand_count} Unmet Demands
          </p>
          <p className="text-[11px] text-slate-500">Convex priority-weighted penalty</p>
        </div>
      </div>
    </div>
  );
};
