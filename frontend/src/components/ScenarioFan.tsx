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
    <div className="glass-card rounded-3xl p-6 shadow-glass-card border border-palette-frost/25 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-3 border-b border-palette-slate/25 mb-4 gap-2">
        <div>
          <h3 className="text-base font-bold text-palette-cream">
            Monte Carlo Uncertainty Fan (S={numSamples})
          </h3>
          <p className="text-xs text-palette-frost mt-0.5">
            Spatially correlated Gaussian Copula hazard realizations across road network.
          </p>
        </div>
        <span className="text-xs font-mono glass-card-subtle text-palette-cream px-3 py-1 rounded-xl border border-palette-frost/25 self-start sm:self-auto">
          Generated in {samplingDurationMs}ms
        </span>
      </div>

      {/* Fan Distribution Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="glass-card-subtle border border-rose-500/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wide block">
            5th Percentile (Severe Hazard)
          </span>
          <div className="text-2xl font-extrabold font-mono text-rose-400 mt-1">{worstPct}%</div>
          <p className="text-[11px] text-rose-300/80 mt-1">Multi-corridor landslide blockages</p>
        </div>

        <div className="glass-card-subtle border border-palette-frost/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-palette-cream uppercase tracking-wide block">
            Expected Passability (Mean)
          </span>
          <div className="text-2xl font-extrabold font-mono text-palette-frost mt-1">{meanPct}%</div>
          <p className="text-[11px] text-palette-frost/80 mt-1">Stochastic recourse target baseline</p>
        </div>

        <div className="glass-card-subtle border border-emerald-500/30 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide block">
            95th Percentile (Mild Hazard)
          </span>
          <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">{bestPct}%</div>
          <p className="text-[11px] text-emerald-300/80 mt-1">Minimal primary corridor disruption</p>
        </div>
      </div>

      {/* Visual Scenario Bar Strip */}
      {sampleSurvivalRates.length > 0 && (
        <div className="mt-4 pt-3 border-t border-palette-slate/20">
          <div className="text-[11px] text-palette-frost mb-1.5 font-medium flex justify-between">
            <span>50-Scenario Survival Dispersion Strip:</span>
            <span className="font-mono text-palette-cream">CVaR(0.95): {worstPct}%</span>
          </div>
          <div className="h-4 flex rounded-xl overflow-hidden bg-palette-deep/80 border border-palette-frost/25 p-0.5 gap-0.5">
            {sampleSurvivalRates.map((rate, idx) => {
              const rPct = Math.round(rate * 100);
              let barColor = 'bg-emerald-400';
              if (rPct < 50) barColor = 'bg-rose-400';
              else if (rPct < 75) barColor = 'bg-amber-400';

              return (
                <div
                  key={idx}
                  style={{ width: `${100 / sampleSurvivalRates.length}%` }}
                  className={`h-full ${barColor} opacity-85 hover:opacity-100 transition-opacity rounded-xs`}
                  title={`Scenario ${idx + 1}: ${rPct}% Network Passability`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
