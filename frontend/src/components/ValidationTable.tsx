import React from 'react';

export interface RowError {
  column: string;
  error_code: string;
  message: string;
  invalid_value?: any;
}

export interface QuarantinedItem {
  quarantine_id: string;
  file_name: string;
  row_index: number;
  raw_data: Record<string, any>;
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
    <div className="space-y-4">
      {/* Metrics Banner */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-slate-50 border rounded-md">
          <div className="text-xs text-slate-500 font-medium">Total Ingested Rows</div>
          <div className="text-xl font-bold text-slate-800">{totalRows}</div>
        </div>
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md">
          <div className="text-xs text-emerald-700 font-medium">Valid Parsed Rows</div>
          <div className="text-xl font-bold text-emerald-800">{validRows}</div>
        </div>
        <div className={`p-3 border rounded-md ${quarantinedRows > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50'}`}>
          <div className="text-xs text-amber-700 font-medium">Quarantined (Retained)</div>
          <div className="text-xl font-bold text-amber-800">{quarantinedRows}</div>
        </div>
      </div>

      {/* Quarantine Table */}
      {quarantinedRows > 0 ? (
        <div className="border rounded-md overflow-hidden">
          <div className="bg-amber-100/60 px-4 py-2 text-xs font-semibold text-amber-900 border-b">
            Quarantine Buffer — Malformed rows isolated for audit (Never silently dropped)
          </div>
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b text-slate-600">
                <tr>
                  <th className="p-2 font-medium">Row #</th>
                  <th className="p-2 font-medium">File</th>
                  <th className="p-2 font-medium">Error Code</th>
                  <th className="p-2 font-medium">Reason</th>
                  <th className="p-2 font-medium">Invalid Input</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {quarantineRecords.map((item) => (
                  <tr key={item.quarantine_id} className="hover:bg-amber-50/40">
                    <td className="p-2 font-mono font-bold text-slate-800">{item.row_index}</td>
                    <td className="p-2">{item.file_name}</td>
                    <td className="p-2 text-red-600 font-mono font-semibold">
                      {item.errors.map((e) => e.error_code).join(', ')}
                    </td>
                    <td className="p-2 text-slate-600">
                      {item.errors.map((e) => e.message).join(' | ')}
                    </td>
                    <td className="p-2 font-mono text-slate-500 truncate max-w-xs">
                      {JSON.stringify(item.errors.map((e) => e.invalid_value))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">
          Zero parsing errors. All {validRows} records validated and ready for snapshot sealing.
        </div>
      )}
    </div>
  );
};

