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
      <div className="glass-card p-6 rounded-3xl border border-palette-frost/25 shadow-glass-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-palette-cream flex items-center space-x-2 tracking-tight">
            <ClipboardList className="w-5 h-5 text-palette-frost" />
            <span>Operational Audit Trail</span>
          </h1>
          <p className="text-xs text-palette-frost mt-0.5">
            Immutable log of all user interventions, sign-offs, and optimization executions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="audit-filter" className="text-xs font-semibold text-palette-frost flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5 text-palette-frost" />
              <span>Filter Action:</span>
            </label>
            <select
              id="audit-filter"
              aria-label="Filter audit logs by action"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="text-xs glass-input rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-palette-frost font-medium text-palette-cream"
            >
              <option value="ALL" className="bg-palette-deep">All Actions ({logs.length})</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act} className="bg-palette-deep">
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
            className="px-4 py-2 glass-card-subtle hover:bg-palette-steel/50 active:scale-95 text-palette-cream border border-palette-frost/25 rounded-xl text-xs font-semibold shadow-glass-card transition-all flex items-center space-x-1.5 min-h-[36px]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-palette-frost" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="glass-card rounded-3xl shadow-glass-card overflow-hidden border border-palette-frost/25">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-palette-deep/80 text-palette-frost font-mono text-[11px] border-b border-palette-slate/25">
              <tr>
                <th className="py-3.5 px-4">Event ID</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">User / Actor</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Details / Rationale</th>
                <th className="py-3.5 px-4">Resource</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-palette-slate/20 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-palette-frost">
                    Loading immutable audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-palette-slate">
                    No audit records matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.event_id}
                    onClick={() => setSelectedEvent(log)}
                    className="hover:bg-palette-steel/25 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-palette-frost">
                      {log.event_id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 text-palette-frost/80 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-palette-cream">{log.user_id}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wider ${
                          log.action.includes('APPROVE')
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                            : log.action.includes('REJECT')
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                            : 'bg-palette-steel/50 text-palette-cream border border-palette-frost/30'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-palette-frost truncate max-w-xs">
                      {String(log.details?.rationale ?? log.details?.notes ?? JSON.stringify(log.details) ?? '—')}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-palette-slate">
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
        <div className="p-6 glass-card rounded-3xl shadow-glass-card space-y-3.5 border border-palette-frost/30">
          <div className="flex items-center justify-between border-b border-palette-slate/25 pb-3">
            <h3 className="font-bold text-palette-cream text-sm flex items-center space-x-2">
              <FileText className="w-4 h-4 text-palette-frost" />
              <span>Event Details ({selectedEvent.event_id})</span>
            </h3>
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-xs text-palette-frost hover:text-palette-cream px-2.5 py-1 rounded-lg glass-card-subtle"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <span className="text-palette-slate block">User ID:</span>
              <span className="text-palette-cream font-semibold">{selectedEvent.user_id}</span>
            </div>
            <div>
              <span className="text-palette-slate block">Timestamp:</span>
              <span className="text-palette-cream font-semibold">{selectedEvent.timestamp}</span>
            </div>
            <div>
              <span className="text-palette-slate block">Action:</span>
              <span className="text-palette-frost font-bold">{selectedEvent.action}</span>
            </div>
            <div>
              <span className="text-palette-slate block">Resource:</span>
              <span className="text-palette-sage break-all">{selectedEvent.resource_type} / {selectedEvent.resource_id}</span>
            </div>
          </div>
          <div>
            <span className="text-palette-slate block text-xs">Event Payload &amp; Details:</span>
            <pre className="mt-1 p-3.5 glass-card-subtle rounded-2xl border border-palette-frost/20 text-palette-cream text-xs overflow-x-auto font-mono">
              {JSON.stringify(selectedEvent.details, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
