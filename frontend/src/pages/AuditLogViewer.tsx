import React, { useState, useEffect } from 'react';
import { AuditEventRecord, fetchAuditLogs } from '../api/client';

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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Operational Audit Trail</h1>
          <p className="text-sm text-slate-500">
            Immutable log of all user interventions, sign-offs, and optimization executions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="audit-filter" className="text-xs font-semibold text-slate-600">
            Filter Action:
          </label>
          <select
            id="audit-filter"
            aria-label="Filter audit logs by action"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Actions ({logs.length})</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading audit trail records...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No audit events recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm" aria-label="Audit events table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th scope="col" className="py-3 px-4">Timestamp</th>
                  <th scope="col" className="py-3 px-4">Action</th>
                  <th scope="col" className="py-3 px-4">Actor</th>
                  <th scope="col" className="py-3 px-4">Resource</th>
                  <th scope="col" className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((ev) => (
                  <tr key={ev.event_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {ev.timestamp.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                        {ev.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs font-medium text-slate-700">{ev.user_id}</td>
                    <td className="py-2.5 px-4 text-xs font-mono text-slate-600">
                      {ev.resource_type}: {ev.resource_id.slice(0, 8)}...
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        aria-label={`View details for event ${ev.event_id}`}
                        onClick={() => setSelectedEvent(ev)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50/50 hover:bg-blue-100/60 px-2.5 py-1 rounded border border-blue-200 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-modal-title"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 id="audit-modal-title" className="text-base font-bold text-slate-800">
                Audit Event Record
              </h3>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="font-semibold text-slate-600">Event ID: </span>
                <span className="font-mono text-slate-800">{selectedEvent.event_id}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Action: </span>
                <span className="font-mono text-blue-700 font-bold">{selectedEvent.action}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Actor: </span>
                <span className="text-slate-800">{selectedEvent.user_id}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Timestamp: </span>
                <span className="font-mono text-slate-700">{selectedEvent.timestamp}</span>
              </div>
              <div className="pt-2">
                <span className="font-semibold text-slate-700 block mb-1">Payload Details:</span>
                <pre className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-800 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedEvent.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-slate-800 text-white hover:bg-slate-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
