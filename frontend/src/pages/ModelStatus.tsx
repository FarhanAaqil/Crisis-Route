import React from 'react';

export interface CalibrationBin {
  bin_index: number;
  bin_range: [number, number];
  confidence: number;
  accuracy: number;
  count: number;
  calibration_gap: number;
}

export interface ModelMetricsSummary {
  model_version: string;
  model_type: string;
  brier_score: number;
  expected_calibration_error: number;
  roc_auc: number;
  total_samples: number;
  reliability_diagram: CalibrationBin[];
}

export const ModelStatus: React.FC = () => {
  const mockMetrics: ModelMetricsSummary = {
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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 font-sans text-xs">
      <header className="border-b pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Passability Model Calibration Status</h1>
            <p className="text-slate-500 text-sm">Empirical reliability diagrams, ECE tracking, and distribution shift guards</p>
          </div>
          <span className="font-mono bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded font-bold">
            Active: {mockMetrics.model_version}
          </span>
        </div>
      </header>

      {/* Primary Endpoints Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-white border rounded-lg shadow-xs">
          <div className="text-slate-500 font-medium">Brier Score (MSE)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{mockMetrics.brier_score.toFixed(3)}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">✓ Beats Frequency Baseline (0.165)</span>
        </div>
        <div className="p-4 bg-white border rounded-lg shadow-xs">
          <div className="text-slate-500 font-medium">Expected Calibration Error</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{mockMetrics.expected_calibration_error.toFixed(3)}</div>
          <span className="text-[10px] text-slate-400">10 Equal-Width Probability Bins</span>
        </div>
        <div className="p-4 bg-white border rounded-lg shadow-xs">
          <div className="text-slate-500 font-medium">ROC-AUC Discrimination</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{mockMetrics.roc_auc.toFixed(3)}</div>
          <span className="text-[10px] text-slate-400">Ranking Invariant Under Scaling</span>
        </div>
        <div className="p-4 bg-white border rounded-lg shadow-xs">
          <div className="text-slate-500 font-medium">Validation Split Instances</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{mockMetrics.total_samples} links</div>
          <span className="text-[10px] text-slate-400">Assam Flood Events (Unseen in Train)</span>
        </div>
      </div>

      {/* Reliability Diagram Table */}
      <div className="bg-white border rounded-lg p-4 space-y-3 shadow-xs">
        <h3 className="font-bold text-slate-800 text-sm">Reliability Table (Calibration vs. Empirical Accuracy)</h3>
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b text-slate-600">
            <tr>
              <th className="p-2">Bin</th>
              <th className="p-2">Probability Range</th>
              <th className="p-2">Mean Confidence</th>
              <th className="p-2">Observed Passable Rate</th>
              <th className="p-2">Calibration Gap</th>
              <th className="p-2">Sample Count</th>
            </tr>
          </thead>
          <tbody className="divide-y text-slate-700">
            {mockMetrics.reliability_diagram.map((bin) => (
              <tr key={bin.bin_index} className="hover:bg-slate-50/50">
                <td className="p-2 font-mono font-bold">#{bin.bin_index + 1}</td>
                <td className="p-2">[{bin.bin_range[0].toFixed(1)} - {bin.bin_range[1].toFixed(1)}]</td>
                <td className="p-2 font-mono">{(bin.confidence * 100).toFixed(1)}%</td>
                <td className="p-2 font-mono font-semibold text-slate-900">{(bin.accuracy * 100).toFixed(1)}%</td>
                <td className="p-2 font-mono">
                  <span className={bin.calibration_gap >= 0 ? 'text-emerald-600' : 'text-amber-600'}>
                    {bin.calibration_gap >= 0 ? '+' : ''}{(bin.calibration_gap * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="p-2 text-slate-500">{bin.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
