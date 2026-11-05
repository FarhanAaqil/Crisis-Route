import React, { useState, useEffect } from 'react';
import { AuditEventRecord, fetchAuditLogs } from '../api/client';
import { ClipboardList, Filter, RotateCcw, FileText } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditEventRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [selectedEvent, setSelectedEvent] = useState<AuditEventRecord | null>(null);

  useEffect(() => {
    fetchAuditLogs(100)
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  const filteredLogs = filterAction === 'ALL'
    ? logs
    : logs.filter((l) => l.action === filterAction);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <ClipboardList className="w-5 h-5 text-blue-400" />
            <span>Operational Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-400">
            Immutable log of all user interventions, sign-offs, and optimization executions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="audit-filter" className="text-xs font-semibold text-slate-300 flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filter Action:</span>
            </label>
            <select
              id="audit-filter"
              aria-label="Filter audit logs by action"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="ALL">All Actions ({logs.length})</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchAuditLogs(100)
                .then((data) => {
                  setLogs(data);
                  setLoading(false);
                })
                .catch(() => setLoading(false));
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center space-x-1.5 min-h-[36px]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User / Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details / Rationale</th>
                <th className="py-3 px-4">Resource</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading immutable audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No audit records matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.event_id}
                    onClick={() => setSelectedEvent(log)}
                    className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-400">
                      {log.event_id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">{log.user_id}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider ${
                          log.action.includes('APPROVE')
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                            : log.action.includes('REJECT')
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                            : 'bg-blue-950/80 text-blue-300 border border-blue-800/40'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 truncate max-w-xs">
                      {log.details?.rationale || log.details?.notes || JSON.stringify(log.details) || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                      {log.resource_type}: {log.resource_id.slice(0, 8)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEvent && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-sm flex items-center space-x-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Event Details ({selectedEvent.event_id})</span>
            </h3>
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400 block">User ID:</span>
              <span className="text-white font-semibold">{selectedEvent.user_id}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Timestamp:</span>
              <span className="text-white font-semibold">{selectedEvent.timestamp}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Action:</span>
              <span className="text-blue-400 font-bold">{selectedEvent.action}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Resource:</span>
              <span className="text-emerald-400 break-all">{selectedEvent.resource_type} / {selectedEvent.resource_id}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-400 block text-xs">Event Payload &amp; Details:</span>
            <pre className="mt-1 p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-200 text-xs overflow-x-auto font-mono">
              {JSON.stringify(selectedEvent.details, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

