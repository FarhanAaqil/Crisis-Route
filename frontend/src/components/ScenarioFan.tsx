import React from 'react';

export interface ScenarioFanProps {
  numSamples?: number;
  meanPassability: number;
  worstCaseP05: number;
  bestCaseP95: number;
  samplingDurationMs?: number;
  sampleSurvivalRates?: number[];
}

export const ScenarioFan: React.FC<ScenarioFanProps> = ({
  numSamples = 50,
  meanPassability,
  worstCaseP05,
  bestCaseP95,
  samplingDurationMs = 120,
  sampleSurvivalRates = [],
}) => {
  const meanPct = Math.round(meanPassability * 100);
  const worstPct = Math.round(worstCaseP05 * 100);
  const bestPct = Math.round(bestCaseP95 * 100);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            Monte Carlo Uncertainty Fan (S={numSamples})
          </h3>
          <p className="text-xs text-slate-500">
            Spatially correlated Gaussian Copula hazard realizations across road network.
          </p>
        </div>
        <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-200">
          Generated in {samplingDurationMs}ms
        </span>
      </div>

      {/* Fan Distribution Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-rose-50/70 border border-rose-200 p-3 rounded">
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">
            5th Percentile (Severe Hazard)
          </span>
          <div className="text-xl font-bold font-mono text-rose-700 mt-0.5">{worstPct}%</div>
          <p className="text-[11px] text-rose-600 mt-1">Multi-corridor landslide blockages</p>
        </div>

        <div className="bg-blue-50/70 border border-blue-200 p-3 rounded">
          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">
            Expected Passability (Mean)
          </span>
          <div className="text-xl font-bold font-mono text-blue-700 mt-0.5">{meanPct}%</div>
          <p className="text-[11px] text-blue-600 mt-1">Stochastic recourse target baseline</p>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
            95th Percentile (Mild Hazard)
          </span>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5">{bestPct}%</div>
          <p className="text-[11px] text-emerald-600 mt-1">Minimal route disruption</p>
        </div>
      </div>

      {/* Distribution Spread Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-600 font-medium">
          <span>Uncertainty Spread: {worstPct}% → {bestPct}%</span>
          <span>Span: {bestPct - worstPct}% range</span>
        </div>
        <div className="relative w-full h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          {/* Worst-to-best range shaded */}
          <div
            className="absolute top-0 bottom-0 bg-blue-200"
            style={{
              left: `${worstPct}%`,
              width: `${Math.max(2, bestPct - worstPct)}%`,
            }}
          />
          {/* Mean marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-blue-600 shadow"
            style={{ left: `${meanPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {sampleSurvivalRates.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-700 block mb-1">
            Empirical Sample Trace:
          </span>
          <div className="flex items-end gap-1 h-10 w-full bg-slate-50 p-1 rounded border border-slate-200">
            {sampleSurvivalRates.slice(0, 40).map((val, idx) => (
              <div
                key={idx}
                className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                style={{ height: `${Math.round(val * 100)}%` }}
                title={`Sample ${idx + 1}: ${(val * 100).toFixed(1)}%`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
