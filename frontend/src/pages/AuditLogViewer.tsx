import React, { useState } from 'react';
import { AuditEventRecord, fetchAuditIntegrity, fetchAuditLogs } from '../api/client';
import { useApp } from '../context/AppContext';
import { useAsync } from '../hooks/useAsync';
import { ErrorState } from '../components/StateViews';
import { Skeleton } from '../components/Skeleton';
import { ClipboardList, Filter, RotateCcw, FileText, ShieldAlert, ShieldCheck } from 'lucide-react';

// Actions that can be filtered on; the server applies the filter so pagination stays correct
const KNOWN_ACTIONS = [
  'LOGIN',
  'LOGIN_FAILED',
  'CREATE_SCENARIO',
  'SUBMIT_OBSERVATION',
  'OPTIMIZE_ALLOCATION_PLAN',
  'PLAN_SUBMITTED',
  'PLAN_APPROVE',
  'PLAN_REJECT',
  'PLAN_APPROVAL',
  'INGEST_UPLOAD',
];

const PAGE_SIZE = 25;

export const AuditLogViewer: React.FC = () => {
  const { activeRole } = useApp();
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [page, setPage] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<AuditEventRecord | null>(null);

  const action = filterAction === 'ALL' ? undefined : filterAction;
  const audit = useAsync(() => fetchAuditLogs(PAGE_SIZE, page * PAGE_SIZE, action), [page, action]);
  const canVerify = activeRole === 'approver' || activeRole === 'admin';
  const integrity = useAsync(() => (canVerify ? fetchAuditIntegrity() : Promise.resolve(null)), [canVerify, audit.data?.total]);

  const logs = audit.data?.items ?? [];
  const total = audit.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = audit.loading && !audit.data;

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
              onChange={(e) => {
                setFilterAction(e.target.value);
                setPage(0);
              }}
              className="text-xs glass-input rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-palette-frost font-medium text-palette-cream"
            >
              <option value="ALL" className="bg-palette-deep">All actions</option>
              {KNOWN_ACTIONS.map((act) => (
                <option key={act} value={act} className="bg-palette-deep">
                  {act}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={audit.reload}
            className="px-4 py-2 glass-card-subtle hover:bg-palette-steel/50 active:scale-95 text-palette-cream border border-palette-frost/25 rounded-xl text-xs font-semibold shadow-glass-card transition-all flex items-center space-x-1.5 min-h-[36px]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-palette-frost" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {integrity.data && (
        <div
          role="status"
          className={`flex items-center gap-2 p-3 rounded-xl text-xs border ${
            integrity.data.intact
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          {integrity.data.intact ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          <span>
            {integrity.data.intact
              ? `Ledger verified: ${integrity.data.event_count} events, hash chain intact.`
              : 'Ledger integrity check FAILED: history was altered. Escalate immediately.'}
          </span>
        </div>
      )}

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
              {audit.error ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <ErrorState message={audit.error} onRetry={audit.reload} />
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={6} className="p-4 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-palette-slate">
                    No audit records matching filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
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

      <nav className="flex items-center justify-between text-xs text-palette-frost" aria-label="Audit pages">
        <span>
          {total} events · page {page + 1} of {pageCount}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-3 py-1.5 rounded-lg glass-card-subtle border border-palette-frost/25 disabled:opacity-40 min-h-[36px]"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg glass-card-subtle border border-palette-frost/25 disabled:opacity-40 min-h-[36px]"
          >
            Next
          </button>
        </div>
      </nav>

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
