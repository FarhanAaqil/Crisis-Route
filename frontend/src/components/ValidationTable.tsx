import React from 'react';

export interface RowError {
  column: string;
  error_code: string;
  message: string;
  invalid_value?: unknown;
}

export interface QuarantinedItem {
  quarantine_id: string;
  file_name: string;
  row_index: number;
  raw_data: Record<string, unknown>;
  errors: RowError[];
}

interface ValidationTableProps {
  totalRows: number;
  validRows: number;
  quarantinedRows: number;
  quarantineRecords: QuarantinedItem[];
}

export const ValidationTable: React.FC<ValidationTableProps> = ({
  totalRows,
  validRows,
  quarantinedRows,
  quarantineRecords,
}) => {
  return (
    <div className="space-y-4 font-sans">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 glass-card rounded-2xl shadow-glass-card border border-palette-frost/25">
          <div className="text-xs text-palette-frost font-medium">Total Ingested Rows</div>
          <div className="text-2xl font-bold text-palette-cream mt-1 font-mono">{totalRows}</div>
        </div>
        <div className="p-4 glass-card rounded-2xl shadow-glass-card border border-palette-frost/25">
          <div className="text-xs text-emerald-400 font-medium">Valid Parsed Rows</div>
          <div className="text-2xl font-bold text-emerald-300 mt-1 font-mono">{validRows}</div>
        </div>
        <div className={`p-4 glass-card rounded-2xl shadow-glass-card border ${quarantinedRows > 0 ? 'border-amber-500/40' : 'border-palette-frost/25'}`}>
          <div className="text-xs text-amber-400 font-medium">Quarantined (Retained)</div>
          <div className="text-2xl font-bold text-amber-300 mt-1 font-mono">{quarantinedRows}</div>
        </div>
      </div>

      {/* Quarantine Table */}
      {quarantinedRows > 0 ? (
        <div className="glass-card rounded-3xl overflow-hidden border border-amber-500/30 shadow-glass-card">
          <div className="bg-amber-950/60 px-5 py-3 text-xs font-semibold text-amber-300 border-b border-amber-800/40 flex items-center justify-between">
            <span>Quarantine Buffer — Malformed rows isolated for audit (Never silently dropped)</span>
            <span className="text-[10px] font-mono bg-amber-900/60 text-amber-200 px-2 py-0.5 rounded-full border border-amber-700/50">
              Zero Silent Data Loss
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-palette-deep/80 border-b border-palette-slate/25 text-palette-frost font-mono text-[11px]">
                <tr>
                  <th className="p-3">Row #</th>
                  <th className="p-3">File</th>
                  <th className="p-3">Error Code</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Invalid Input</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-palette-slate/20 text-palette-cream">
                {quarantineRecords.map((item) => (
                  <tr key={item.quarantine_id} className="hover:bg-palette-steel/20 transition-colors">
                    <td className="p-3 font-mono font-bold text-palette-frost">{item.row_index}</td>
                    <td className="p-3 text-palette-cream">{item.file_name}</td>
                    <td className="p-3 text-rose-400 font-mono font-semibold">
                      {item.errors.map((e) => e.error_code).join(', ')}
                    </td>
                    <td className="p-3 text-palette-frost/90">
                      {item.errors.map((e) => e.message).join(' | ')}
                    </td>
                    <td className="p-3 font-mono text-palette-slate truncate max-w-xs">
                      {JSON.stringify(item.errors.map((e) => e.invalid_value))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs rounded-2xl shadow-glass-card">
          Zero parsing errors. All {validRows} records validated and ready for snapshot sealing.
        </div>
      )}
    </div>
  );
};
