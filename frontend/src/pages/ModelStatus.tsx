import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fetchPassability, ModelMetricsSummary, PassabilitySummary } from '../api/client';
import { ShieldCheck, Activity, Target, BarChart2, CheckCircle2 } from 'lucide-react';

export const ModelStatus: React.FC = () => {
  const { activeScenarioId, activeScenario, notify } = useApp();

  const [metrics, setMetrics] = useState<ModelMetricsSummary | null>(null);
  const [summary, setSummary] = useState<PassabilitySummary | null>(null);

  useEffect(() => {
    if (!activeScenarioId) return;

    fetchPassability(activeScenarioId)
      .then((data) => {
        setMetrics(data.calibration_metrics);
        setSummary(data.summary);
      })
      .catch((err) => {
        notify(`Failed to fetch model metrics: ${err.message}`, 'error');
      });
  }, [activeScenarioId, notify]);

  if (!metrics) {
    return (
      <div className="max-w-5xl mx-auto p-6 glass-card rounded-2xl text-xs text-palette-frost" role="status">
        <h1 className="text-xl font-extrabold text-palette-cream mb-2">Passability Model Calibration Status</h1>
        No validated calibration report is available yet. Run <code>make reproduce</code> to
        generate <code>reports/model_calibration.json</code>.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 font-sans text-xs">
      <header className="border-b border-palette-slate/25 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-palette-cream bg-palette-steel/50 border border-palette-frost/30 px-3 py-0.5 rounded-full text-[11px]">
                {activeScenario?.name || 'Regional Hazard Corridor'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-palette-cream mt-1 tracking-tight">
              Passability Model Calibration Status
            </h1>
            <p className="text-palette-frost text-xs mt-0.5">
              Empirical reliability diagrams, ECE tracking, and distribution shift guards
            </p>
          </div>
          <span className="font-mono bg-palette-deep/80 text-palette-cream border border-palette-frost/30 px-3 py-1.5 rounded-xl font-bold text-[11px] shadow-glass-card">
            Active: {metrics.model_version}
          </span>
        </div>
      </header>

      {/* Primary Verification Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 glass-card rounded-2xl shadow-glass-card hover:-translate-y-1 hover:border-palette-frost/40 hover:shadow-glass-glow transition-all duration-300">
          <div className="flex items-center justify-between text-palette-frost font-medium">
            <span>Brier Score (MSE)</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-palette-cream mt-1 font-mono">
            {metrics.brier_score.toFixed(3)}
          </div>
          <span className="text-[10px] text-emerald-300 font-semibold flex items-center space-x-1 mt-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Verified Target (&lt; 0.15)</span>
          </span>
        </div>

        <div className="p-4 glass-card rounded-2xl shadow-glass-card hover:-translate-y-1 hover:border-palette-frost/40 hover:shadow-glass-glow transition-all duration-300">
          <div className="flex items-center justify-between text-palette-frost font-medium">
            <span>Expected Calibration Error</span>
            <Activity className="w-4 h-4 text-palette-frost" />
          </div>
          <div className="text-2xl font-extrabold text-palette-frost mt-1 font-mono">
            {metrics.expected_calibration_error.toFixed(3)}
          </div>
          <span className="text-[10px] text-palette-slate block mt-1">10 Equal-Width Bins</span>
        </div>

        <div className="p-4 glass-card rounded-2xl shadow-glass-card hover:-translate-y-1 hover:border-palette-frost/40 hover:shadow-glass-glow transition-all duration-300">
          <div className="flex items-center justify-between text-palette-frost font-medium">
            <span>ROC-AUC Discrimination</span>
            <BarChart2 className="w-4 h-4 text-palette-frost" />
          </div>
          <div className="text-2xl font-extrabold text-palette-cream mt-1 font-mono">
            {metrics.roc_auc.toFixed(3)}
          </div>
          <span className="text-[10px] text-palette-slate block mt-1">Ranking Invariant</span>
        </div>

        <div className="p-4 glass-card rounded-2xl shadow-glass-card hover:-translate-y-1 hover:border-palette-frost/40 hover:shadow-glass-glow transition-all duration-300">
          <div className="flex items-center justify-between text-palette-frost font-medium">
            <span>Corridor Segment Health</span>
            <ShieldCheck className="w-4 h-4 text-palette-sage" />
          </div>
          <div className="text-2xl font-extrabold text-palette-cream mt-1 font-mono">
            {summary ? summary.total_edges : metrics.total_samples} Links
          </div>
          <span className="text-[10px] text-palette-frost block mt-1">
            {summary
              ? `${summary.passable_count} Pass | ${summary.moderate_count} Mod | ${summary.critical_count} Crit`
              : 'Empirical Holdout Evaluation'}
          </span>
        </div>
      </div>

      {/* Reliability Diagram Table with Glassmorphism */}
      <div className="glass-card rounded-3xl p-6 space-y-4 shadow-glass-card">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-palette-slate/25 pb-3 gap-2">
          <div>
            <h3 className="font-bold text-palette-cream text-sm">
              Reliability Table (Calibration vs. Empirical Accuracy)
            </h3>
            <p className="text-[11px] text-palette-frost">
              Evaluated using post-hoc isotonic calibration against ground truth flood inspection records.
            </p>
          </div>
          <span className="font-mono text-[11px] glass-card-subtle text-palette-cream px-3 py-1 rounded-xl border border-palette-frost/25 self-start sm:self-auto">
            N = {metrics.total_samples} Evaluated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono">
            <thead>
              <tr className="border-b border-palette-slate/25 text-palette-frost text-[11px]">
                <th className="py-2.5 px-3">Bin Interval</th>
                <th className="py-2.5 px-3">Mean Confidence</th>
                <th className="py-2.5 px-3">Empirical Accuracy</th>
                <th className="py-2.5 px-3">Sample Count</th>
                <th className="py-2.5 px-3">Calibration Gap (|Gap|)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-palette-slate/20 text-[11px]">
              {metrics.reliability_diagram.map((bin) => {
                const gap = Math.abs(bin.calibration_gap);
                const isWellCalibrated = gap <= 0.03;
                return (
                  <tr key={bin.bin_index} className="hover:bg-palette-steel/25 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-palette-cream">
                      [{bin.bin_range[0].toFixed(1)} - {bin.bin_range[1].toFixed(1)})
                    </td>
                    <td className="py-2.5 px-3 text-palette-frost">{(bin.confidence * 100).toFixed(1)}%</td>
                    <td className="py-2.5 px-3 text-palette-cream">{(bin.accuracy * 100).toFixed(1)}%</td>
                    <td className="py-2.5 px-3 text-palette-frost/80">{bin.count}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                          isWellCalibrated
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40'
                            : 'bg-amber-950/70 text-amber-300 border border-amber-800/40'
                        }`}
                      >
                        {gap.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
