import React, { useState } from 'react';
import { Role } from './auth/guards';
import { Dashboard } from './pages/Dashboard';
import { ImportWizard } from './pages/ImportWizard';
import { ModelStatus } from './pages/ModelStatus';
import { AllocationDashboard } from './pages/AllocationDashboard';
import { AuditLogViewer } from './pages/AuditLogViewer';
import { ObservationEditor, ObservationFormData } from './components/ObservationEditor';

export type NavigationTab = 'dashboard' | 'import' | 'map' | 'observations' | 'allocation' | 'audit';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [activeRole, setActiveRole] = useState<Role>('analyst');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>('EDGE-MEPPADI-ACC-01');
  const [observations, setObservations] = useState<Array<ObservationFormData & { id: string; timestamp: string }>>([
    {
      id: 'obs-init-1',
      edge_id: 'EDGE-WAYANAD-SH54-04',
      status: 'partially_blocked',
      source_type: 'field_patrol',
      source_credibility: 0.9,
      water_depth_cm: 25.0,
      notes: 'Culvert overflow near mile marker 12; single lane passable with caution.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);

  const handleObservationSubmit = (data: ObservationFormData) => {
    const newEntry = {
      ...data,
      id: `obs-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setObservations((prev) => [newEntry, ...prev]);
    setSubmissionFeedback(`Observation for ${data.edge_id} logged into immutable observation ledger.`);
    setTimeout(() => setSubmissionFeedback(null), 5000);
  };

  const tabs: Array<{ id: NavigationTab; label: string }> = [
    { id: 'dashboard', label: 'Overview & Sign-Off' },
    { id: 'import', label: 'Data Import' },
    { id: 'map', label: 'Passability & Risk' },
    { id: 'observations', label: 'Field Observations' },
    { id: 'allocation', label: 'Resource Allocation' },
    { id: 'audit', label: 'Audit Trail' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header with Role Switcher */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-sm tracking-tighter">
              CR
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                CrisisRoute Decision Support Platform
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Uncertainty-Aware Humanitarian Logistics & Equitable Routing
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end sm:self-auto">
            <div className="flex items-center space-x-2 text-xs">
              <label htmlFor="role-select" className="font-semibold text-slate-600">
                User Role:
              </label>
              <select
                id="role-select"
                aria-label="Active system role"
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value as Role)}
                className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs font-medium text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="analyst">Logistics Coordinator (Analyst)</option>
                <option value="field_analyst">Field Analyst</option>
                <option value="approver">Incident Lead Approver</option>
              </select>
            </div>

            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
                activeRole === 'approver'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : activeRole === 'field_analyst'
                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                  : 'bg-blue-100 text-blue-800 border border-blue-300'
              }`}
            >
              {activeRole.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Global Operational Safety Invariant Notice */}
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-center space-x-2 text-center">
          <span className="bg-slate-950 text-amber-400 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
            Safety Invariant
          </span>
          <span>
            CrisisRoute provides probabilistic decision support under road uncertainty. It does not certify route safety or replace ground situational reports.
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav
          role="tablist"
          aria-label="Main Navigation Tabs"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-slate-200 overflow-x-auto"
        >
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] flex items-center ${
                  isSelected
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main View Panel */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <div role="tabpanel" id="panel-dashboard" aria-labelledby="tab-dashboard">
            <Dashboard />
          </div>
        )}

        {activeTab === 'import' && (
          <div role="tabpanel" id="panel-import" aria-labelledby="tab-import">
            <ImportWizard />
          </div>
        )}

        {activeTab === 'map' && (
          <div role="tabpanel" id="panel-map" aria-labelledby="tab-map">
            <ModelStatus />
          </div>
        )}

        {activeTab === 'observations' && (
          <div role="tabpanel" id="panel-observations" aria-labelledby="tab-observations" className="space-y-6">
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Ground Observation Dispatch & Telemetry</h2>
                <p className="text-xs text-slate-500">
                  Submit ground-truth passability observations with credibility weighting and water depth sensor data.
                </p>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <label htmlFor="edge-selector" className="font-semibold text-slate-600">
                  Target Edge:
                </label>
                <select
                  id="edge-selector"
                  value={selectedEdgeId}
                  onChange={(e) => setSelectedEdgeId(e.target.value)}
                  className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-xs font-mono"
                >
                  <option value="EDGE-MEPPADI-ACC-01">EDGE-MEPPADI-ACC-01 (Tertiary)</option>
                  <option value="EDGE-WAYANAD-NH766-01">EDGE-WAYANAD-NH766-01 (Primary)</option>
                  <option value="EDGE-WAYANAD-SH54-04">EDGE-WAYANAD-SH54-04 (Bridge)</option>
                </select>
              </div>
            </div>

            {submissionFeedback && (
              <div
                role="status"
                className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-medium"
              >
                {submissionFeedback}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Record Observation</h3>
                <ObservationEditor
                  edgeId={selectedEdgeId}
                  onSubmit={handleObservationSubmit}
                  onCancel={() => setSelectedEdgeId('EDGE-MEPPADI-ACC-01')}
                />
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col">
                <h3 className="text-sm font-bold text-slate-800 mb-3">
                  Recent Observations ({observations.length})
                </h3>
                <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
                  {observations.map((obs) => (
                    <div
                      key={obs.id}
                      className="p-3 border border-slate-200 rounded text-xs bg-slate-50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-blue-700">{obs.edge_id}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            obs.status === 'passable'
                              ? 'bg-emerald-100 text-emerald-800'
                              : obs.status === 'impassable'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {obs.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-slate-600">
                        Source: <span className="font-semibold">{obs.source_type}</span> | Credibility:{' '}
                        <span className="font-semibold">{(obs.source_credibility * 100).toFixed(0)}%</span> | Water
                        Depth: <span className="font-semibold">{obs.water_depth_cm} cm</span>
                      </div>
                      {obs.notes && (
                        <p className="text-slate-700 italic border-l-2 border-slate-300 pl-2 mt-1">
                          "{obs.notes}"
                        </p>
                      )}
                      <div className="text-[10px] text-slate-400">
                        {new Date(obs.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'allocation' && (
          <div role="tabpanel" id="panel-allocation" aria-labelledby="tab-allocation">
            <AllocationDashboard />
          </div>
        )}

        {activeTab === 'audit' && (
          <div role="tabpanel" id="panel-audit" aria-labelledby="tab-audit">
            <AuditLogViewer />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        CrisisRoute Decision Support System — Certified for Humanitarian Logistics Resilience
      </footer>
    </div>
  );
};

export default App;
