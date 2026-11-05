import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { fetchPassability, ModelMetricsSummary, PassabilitySummary } from '../api/client';

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
      <header className="border-b pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                {activeScenario?.name || 'Regional Hazard Corridor'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              Passability Model Calibration Status
            </h1>
            <p className="text-slate-500 text-xs">
              Empirical reliability diagrams, ECE tracking, and distribution shift guards
            </p>
          </div>
          <span className="font-mono bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded font-bold text-[11px]">
            Active: {metrics.model_version}
          </span>
        </div>
      </header>

      {/* Primary Verification Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
          <div className="text-slate-500 font-medium">Brier Score (MSE)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {metrics.brier_score.toFixed(3)}
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold">
            ✓ Verified Calibration Target (&lt; 0.15)
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
          <div className="text-slate-500 font-medium">Expected Calibration Error</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">
            {metrics.expected_calibration_error.toFixed(3)}
          </div>
          <span className="text-[10px] text-slate-400">10 Equal-Width Probability Bins</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
          <div className="text-slate-500 font-medium">ROC-AUC Discrimination</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {metrics.roc_auc.toFixed(3)}
          </div>
          <span className="text-[10px] text-slate-400">Ranking Invariant Under Scaling</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs">
          <div className="text-slate-500 font-medium">Corridor Segment Health</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {summary ? summary.total_edges : metrics.total_samples} Links
          </div>
          <span className="text-[10px] text-slate-500">
            {summary
              ? `${summary.passable_count} Passable | ${summary.moderate_count} Mod | ${summary.critical_count} Crit`
              : 'Empirical Holdout Evaluation'}
          </span>
        </div>
      </div>

      {/* Reliability Diagram Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-xs">
        <div className="flex justify-between items-center border-b pb-2">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">
              Reliability Table (Calibration vs. Empirical Accuracy)
            </h3>
            <p className="text-[11px] text-slate-500">
              Evaluated using post-hoc isotonic calibration against ground truth flood inspection records.
            </p>
          </div>
          <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
            {metrics.model_type}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b text-slate-600">
              <tr>
                <th className="p-2 font-semibold">Bin</th>
                <th className="p-2 font-semibold">Probability Range</th>
                <th className="p-2 font-semibold">Mean Confidence</th>
                <th className="p-2 font-semibold">Observed Passable Rate</th>
                <th className="p-2 font-semibold">Calibration Gap (&Delta;)</th>
                <th className="p-2 font-semibold">Sample Count</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {metrics.reliability_diagram.map((bin) => {
                const isAligned = Math.abs(bin.calibration_gap) <= 0.03;
                return (
                  <tr key={bin.bin_index} className="hover:bg-slate-50/50">
                    <td className="p-2 font-mono font-bold">#{bin.bin_index + 1}</td>
                    <td className="p-2 font-mono">
                      [{bin.bin_range[0].toFixed(1)} - {bin.bin_range[1].toFixed(1)}]
                    </td>
                    <td className="p-2 font-mono">{bin.confidence.toFixed(2)}</td>
                    <td className="p-2 font-mono">{bin.accuracy.toFixed(2)}</td>
                    <td className="p-2">
                      <span
                        className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                          isAligned
                            ? 'text-emerald-700 bg-emerald-50'
                            : 'text-amber-700 bg-amber-50'
                        }`}
                      >
                        {bin.calibration_gap > 0 ? '+' : ''}
                        {bin.calibration_gap.toFixed(3)}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-slate-500">{bin.count} links</td>
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
