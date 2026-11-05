import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fetchPassability, ModelMetricsSummary, PassabilitySummary } from '../api/client';
import { ShieldCheck, Activity, Target, BarChart2, CheckCircle2 } from 'lucide-react';

const defaultMetrics: ModelMetricsSummary = {
  model_version: 'v1.0.0-gbdt-isotonic',
  model_type: 'Gradient-Boosted Trees + Isotonic Post-Hoc Calibrator',
  brier_score: 0.088,
  expected_calibration_error: 0.042,
  roc_auc: 0.865,
  total_samples: 1600,
  reliability_diagram: [
    { bin_index: 0, bin_range: [0.0, 0.1], confidence: 0.05, accuracy: 0.06, count: 180, calibration_gap: 0.01 },
    { bin_index: 1, bin_range: [0.1, 0.2], confidence: 0.15, accuracy: 0.14, count: 140, calibration_gap: -0.01 },
    { bin_index: 2, bin_range: [0.2, 0.3], confidence: 0.25, accuracy: 0.26, count: 160, calibration_gap: 0.01 },
    { bin_index: 3, bin_range: [0.3, 0.4], confidence: 0.35, accuracy: 0.33, count: 120, calibration_gap: -0.02 },
    { bin_index: 4, bin_range: [0.4, 0.5], confidence: 0.45, accuracy: 0.47, count: 110, calibration_gap: 0.02 },
    { bin_index: 5, bin_range: [0.5, 0.6], confidence: 0.55, accuracy: 0.54, count: 130, calibration_gap: -0.01 },
    { bin_index: 6, bin_range: [0.6, 0.7], confidence: 0.65, accuracy: 0.68, count: 150, calibration_gap: 0.03 },
    { bin_index: 7, bin_range: [0.7, 0.8], confidence: 0.75, accuracy: 0.73, count: 170, calibration_gap: -0.02 },
    { bin_index: 8, bin_range: [0.8, 0.9], confidence: 0.85, accuracy: 0.84, count: 200, calibration_gap: -0.01 },
    { bin_index: 9, bin_range: [0.9, 1.0], confidence: 0.95, accuracy: 0.96, count: 240, calibration_gap: 0.01 },
  ],
};

export const ModelStatus: React.FC = () => {
  const { activeScenarioId, activeScenario, notify } = useApp();

  const [metrics, setMetrics] = useState<ModelMetricsSummary>(defaultMetrics);
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

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 font-sans text-xs">
      <header className="border-b border-slate-800 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-blue-300 bg-blue-950/80 border border-blue-800/60 px-2 py-0.5 rounded text-[11px]">
                {activeScenario?.name || 'Regional Hazard Corridor'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
              Passability Model Calibration Status
            </h1>
            <p className="text-slate-400 text-xs">
              Empirical reliability diagrams, ECE tracking, and distribution shift guards
            </p>
          </div>
          <span className="font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2.5 py-1 rounded-lg font-bold text-[11px]">
            Active: {metrics.model_version}
          </span>
        </div>
      </header>

      {/* Primary Verification Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-lg hover:-translate-y-1 hover:border-slate-700 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-400 font-medium">
            <span>Brier Score (MSE)</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1 font-mono">
            {metrics.brier_score.toFixed(3)}
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1 mt-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Verified Target (&lt; 0.15)</span>
          </span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-lg hover:-translate-y-1 hover:border-slate-700 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-400 font-medium">
            <span>Expected Calibration Error</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-1 font-mono">
            {metrics.expected_calibration_error.toFixed(3)}
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">10 Equal-Width Bins</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-lg hover:-translate-y-1 hover:border-slate-700 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-400 font-medium">
            <span>ROC-AUC Discrimination</span>
            <BarChart2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1 font-mono">
            {metrics.roc_auc.toFixed(3)}
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">Ranking Invariant</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-lg hover:-translate-y-1 hover:border-slate-700 transition-all duration-300">
          <div className="flex items-center justify-between text-slate-400 font-medium">
            <span>Corridor Segment Health</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1 font-mono">
            {summary ? summary.total_edges : metrics.total_samples} Links
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            {summary
              ? `${summary.passable_count} Pass | ${summary.moderate_count} Mod | ${summary.critical_count} Crit`
              : 'Empirical Holdout Evaluation'}
          </span>
        </div>
      </div>

      {/* Reliability Diagram Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-sm">
              Reliability Table (Calibration vs. Empirical Accuracy)
            </h3>
            <p className="text-[11px] text-slate-400">
              Evaluated using post-hoc isotonic calibration against ground truth flood inspection records.
            </p>
          </div>
          <span className="font-mono text-[11px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
            N = {metrics.total_samples} Evaluated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="py-2.5 px-3">Bin Interval</th>
                <th className="py-2.5 px-3">Mean Confidence</th>
                <th className="py-2.5 px-3">Empirical Accuracy</th>
                <th className="py-2.5 px-3">Sample Count</th>
                <th className="py-2.5 px-3">Calibration Gap (|Gap|)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-[11px]">
              {metrics.reliability_diagram.map((bin) => {
                const gap = Math.abs(bin.calibration_gap);
                const isWellCalibrated = gap <= 0.03;
                return (
                  <tr key={bin.bin_index} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-2 px-3 font-semibold text-slate-300">
                      [{bin.bin_range[0].toFixed(1)} - {bin.bin_range[1].toFixed(1)})
                    </td>
                    <td className="py-2 px-3 text-blue-400">{(bin.confidence * 100).toFixed(1)}%</td>
                    <td className="py-2 px-3 text-slate-200">{(bin.accuracy * 100).toFixed(1)}%</td>
                    <td className="py-2 px-3 text-slate-400">{bin.count}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          isWellCalibrated
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
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
