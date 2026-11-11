import React, { useState, useEffect } from 'react';
import { Dashboard } from './pages/Dashboard';
import { ImportWizard } from './pages/ImportWizard';
import { ModelStatus } from './pages/ModelStatus';
import { AllocationDashboard } from './pages/AllocationDashboard';
import { AuditLogViewer } from './pages/AuditLogViewer';
import { ObservationEditor, ObservationFormData } from './components/ObservationEditor';
import { MapPreview } from './components/MapPreview';
import { ThreeCorridorVisualizer } from './components/ThreeCorridorVisualizer';
import { Sidebar } from './components/Sidebar';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Login } from './pages/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  fetchPassability,
  fetchObservations,
  submitObservation,
  PassabilityEdgeItem,
  PassabilityNodeItem,
} from './api/client';
import { Menu, Compass, Layers, Radio, Sparkles } from 'lucide-react';

export type NavigationTab = 'dashboard' | 'import' | 'map' | 'observations' | 'allocation' | 'audit';

const AppContent: React.FC = () => {
  const { activeScenarioId, activeScenario, activeRole, notify } = useApp();
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>('EDGE-MEPPADI-ACC-01');

  // Sidebar responsive layout state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Map view mode: 3D Three.js Tactical Mesh vs 2D MapLibre GIS
  const [mapEngineMode, setMapEngineMode] = useState<'3d' | '2d'>('3d');

  // Observations state
  const [observations, setObservations] = useState<
    Array<{
      id: string;
      edge_id: string;
      status: string;
      source_type: string;
      source_credibility: number;
      water_depth_cm?: number;
      notes?: string;
      timestamp: string;
    }>
  >([
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

  // Map and passability data for the Map tab
  const [mapEdges, setMapEdges] = useState<PassabilityEdgeItem[]>([]);
  const [mapNodes, setMapNodes] = useState<PassabilityNodeItem[]>([]);
  const [mapBbox, setMapBbox] = useState<number[]>([75.9, 11.45, 76.4, 11.95]);

  // Load passability & observations when activeScenarioId changes
  useEffect(() => {
    if (!activeScenarioId) return;

    if (activeScenario?.region_name.includes('Chamoli') || activeScenario?.region_name.includes('Uttarakhand')) {
      setMapBbox([79.45, 30.40, 79.75, 30.65]);
    } else if (activeScenario?.region_name.includes('Majuli') || activeScenario?.region_name.includes('Assam')) {
      setMapBbox([94.00, 26.85, 94.45, 27.15]);
    } else {
      setMapBbox([75.90, 11.45, 76.40, 11.95]);
    }

    fetchPassability(activeScenarioId)
      .then((res) => {
        setMapEdges(res.edges);
        setMapNodes(res.nodes);
        if (res.edges.length > 0 && res.edges[0].edge_id) {
          setSelectedEdgeId(res.edges[0].edge_id);
        }
      })
      .catch((err) => console.warn('Could not load passability data:', err));

    fetchObservations(activeScenarioId)
      .then((obsList) => {
        if (obsList && obsList.length > 0) {
          const mapped = obsList.map((o) => ({
            id: o.observation_id,
            edge_id: o.edge_id,
            status: o.status,
            source_type: o.source_type,
            source_credibility: o.source_credibility,
            water_depth_cm: 20.0,
            notes: o.notes || '',
            timestamp: o.observed_at,
          }));
          setObservations(mapped);
        }
      })
      .catch((err) => console.warn('Could not load observations:', err));
  }, [activeScenarioId, activeScenario]);

  const handleObservationSubmit = async (data: ObservationFormData) => {
    try {
      await submitObservation(
        activeScenarioId,
        {
          edge_id: data.edge_id,
          status: data.status,
          source_type: data.source_type,
          source_credibility: data.source_credibility,
          notes: data.notes,
        },
        activeRole
      );

      const newEntry = {
        id: `obs-${Date.now()}`,
        edge_id: data.edge_id,
        status: data.status,
        source_type: data.source_type,
        source_credibility: data.source_credibility,
        water_depth_cm: data.water_depth_cm,
        notes: data.notes,
        timestamp: new Date().toISOString(),
      };
      setObservations((prev) => [newEntry, ...prev]);
      const feedback = `Observation for ${data.edge_id} logged into immutable observation ledger.`;
      setSubmissionFeedback(feedback);
      notify(feedback, 'success');
      setTimeout(() => setSubmissionFeedback(null), 5000);
    } catch {
      const newEntry = {
        id: `obs-${Date.now()}`,
        edge_id: data.edge_id,
        status: data.status,
        source_type: data.source_type,
        source_credibility: data.source_credibility,
        water_depth_cm: data.water_depth_cm,
        notes: data.notes,
        timestamp: new Date().toISOString(),
      };
      setObservations((prev) => [newEntry, ...prev]);
      const feedback = `Observation for ${data.edge_id} logged into local buffer.`;
      setSubmissionFeedback(feedback);
      notify(feedback, 'info');
      setTimeout(() => setSubmissionFeedback(null), 5000);
    }
  };

  return (
    <div className="relative min-h-screen bg-palette-deep text-palette-cream flex font-sans antialiased overflow-x-hidden selection:bg-palette-frost/30 selection:text-palette-cream">
      {/* Ambient Atmospheric Light Mesh for Glassmorphic Refraction */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[15%] w-[550px] h-[550px] rounded-full bg-palette-steel/30 blur-[130px]" />
        <div className="absolute top-[40%] right-[-5%] w-[600px] h-[600px] rounded-full bg-palette-slate/25 blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[30%] w-[500px] h-[500px] rounded-full bg-palette-frost/15 blur-[140px]" />
      </div>

      {/* Tactical Operations Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace Area */}
      <div
        className={`relative z-10 flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'
        }`}
      >
        {/* Top Tactical Bar */}
        <header className="sticky top-0 z-30 glass-nav border-b border-palette-slate/25 shadow-glass-card backdrop-blur-2xl">
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              {/* Mobile Sidebar Hamburger Toggle */}
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                aria-label="Open operations navigation drawer"
                className="lg:hidden p-2 rounded-xl text-palette-frost hover:text-palette-cream hover:bg-palette-steel/30 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center border border-palette-frost/20"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm sm:text-base font-extrabold text-palette-cream tracking-tight">
                    {activeScenario ? activeScenario.name : 'CrisisRoute Disaster Operations'}
                  </h2>
                  <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-palette-steel/50 text-palette-frost border border-palette-frost/30">
                    Live Sector
                  </span>
                </div>
                <p className="text-[11px] text-palette-frost/85 truncate max-w-md mt-0.5">
                  Region: {activeScenario ? activeScenario.region_name : 'Wayanad-Periyar'} | Clearance:{' '}
                  <span className="font-semibold text-palette-cream capitalize">{activeRole.replace('_', ' ')}</span>
                </p>
              </div>
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center space-x-2">
              <span className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full glass-card-subtle text-xs font-mono text-palette-frost border border-palette-frost/25">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                <span className="text-palette-cream">NDMA Phase II Protocol</span>
              </span>
            </div>
          </div>

          {/* Mandatory Global Operational Safety Invariant Banner */}
          <div className="bg-amber-500/90 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-center space-x-2 text-center shadow-inner backdrop-blur-md">
            <span className="bg-slate-950 text-amber-400 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider shrink-0">
              Safety Invariant
            </span>
            <span>
              CrisisRoute provides probabilistic decision support under road uncertainty. It does not certify route safety or replace ground situational reports.
            </span>
          </div>
        </header>

        {/* Dynamic Tab Panel Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <ErrorBoundary fallbackTitle="Panel Rendering Error">
            {activeTab === 'dashboard' && (
              <div role="tabpanel" id="panel-dashboard" aria-labelledby="tab-dashboard">
                <Dashboard currentRole={activeRole} />
              </div>
            )}

            {activeTab === 'import' && (
              <div role="tabpanel" id="panel-import" aria-labelledby="tab-import">
                <ImportWizard />
              </div>
            )}

            {activeTab === 'map' && (
              <div role="tabpanel" id="panel-map" aria-labelledby="tab-map" className="space-y-6">
                {/* 3D vs 2D Engine Switcher Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-card p-4 rounded-2xl border border-palette-frost/25 shadow-glass-card">
                  <div>
                    <h3 className="text-base font-bold text-palette-cream flex items-center space-x-2">
                      <Compass className="w-5 h-5 text-palette-frost" />
                      <span>Road Corridor Passability &amp; Risk Matrix</span>
                    </h3>
                    <p className="text-xs text-palette-frost/85 mt-0.5">
                      Topographical corridor inspection with real-time passability probabilities, credible intervals, and hazard warnings.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 self-start sm:self-auto glass-card-subtle p-1 rounded-xl border border-palette-frost/25 text-xs">
                    <button
                      type="button"
                      onClick={() => setMapEngineMode('3d')}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all min-h-[36px] ${
                        mapEngineMode === '3d'
                          ? 'glass-btn-primary shadow-glass-card text-palette-cream'
                          : 'text-palette-frost hover:text-palette-cream'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Three.js 3D Grid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapEngineMode('2d')}
                      className={`px-3 py-1.5 rounded-lg font-medium flex items-center space-x-1.5 transition-all min-h-[36px] ${
                        mapEngineMode === '2d'
                          ? 'glass-btn-primary shadow-glass-card text-palette-cream'
                          : 'text-palette-frost hover:text-palette-cream'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>MapLibre 2D GIS</span>
                    </button>
                  </div>
                </div>

                {/* Viewport Display */}
                {mapEngineMode === '3d' ? (
                  <ThreeCorridorVisualizer
                    edges={mapEdges}
                    nodes={mapNodes}
                    selectedEdgeId={selectedEdgeId}
                    onSelectEdge={(e) => setSelectedEdgeId(e.edge_id)}
                    regionName={activeScenario ? activeScenario.name : 'Regional Disaster Corridor'}
                  />
                ) : (
                  <MapPreview
                    regionName={activeScenario ? activeScenario.name : 'Regional Disaster Corridor'}
                    bbox={mapBbox}
                    edges={mapEdges}
                    nodes={mapNodes}
                    selectedEdgeId={selectedEdgeId}
                    onSelectEdge={(e) => setSelectedEdgeId(e.edge_id)}
                  />
                )}

                <ModelStatus />
              </div>
            )}

            {activeTab === 'observations' && (
              <div role="tabpanel" id="panel-observations" aria-labelledby="tab-observations" className="space-y-6">
                <div className="glass-card p-5 rounded-2xl border border-palette-frost/25 shadow-glass-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-palette-cream flex items-center space-x-2">
                      <Radio className="w-5 h-5 text-palette-frost" />
                      <span>Ground Observation Dispatch &amp; Telemetry</span>
                    </h2>
                    <p className="text-xs text-palette-frost/85 mt-0.5">
                      Submit ground-truth passability observations with credibility weighting and standing water depth sensor data.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <label htmlFor="edge-selector" className="font-semibold text-palette-frost">
                      Target Edge:
                    </label>
                    <select
                      id="edge-selector"
                      value={selectedEdgeId}
                      onChange={(e) => setSelectedEdgeId(e.target.value)}
                      className="glass-input rounded-xl px-2.5 py-1.5 text-xs text-palette-cream font-mono focus:outline-none focus:ring-2 focus:ring-palette-frost"
                    >
                      {mapEdges.length > 0 ? (
                        mapEdges.map((e) => (
                          <option key={e.edge_id} value={e.edge_id} className="bg-palette-deep text-palette-cream">
                            {e.edge_id} ({e.road_class} {e.bridge ? 'Bridge' : ''})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="EDGE-MEPPADI-ACC-01" className="bg-palette-deep">EDGE-MEPPADI-ACC-01 (Tertiary)</option>
                          <option value="EDGE-WAYANAD-NH766-01" className="bg-palette-deep">EDGE-WAYANAD-NH766-01 (Primary)</option>
                          <option value="EDGE-WAYANAD-SH54-04" className="bg-palette-deep">EDGE-WAYANAD-SH54-04 (Bridge)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {submissionFeedback && (
                  <div
                    role="status"
                    className="p-3.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-2xl text-xs font-medium flex items-center space-x-2 shadow-glass-card"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{submissionFeedback}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="glass-card p-5 rounded-2xl border border-palette-frost/25 shadow-glass-card">
                    <h3 className="text-sm font-bold text-palette-cream mb-3">Record Ground Observation</h3>
                    <ObservationEditor
                      edgeId={selectedEdgeId}
                      onSubmit={handleObservationSubmit}
                      onCancel={() => setSelectedEdgeId(mapEdges[0]?.edge_id || 'EDGE-MEPPADI-ACC-01')}
                    />
                  </div>

                  <div className="glass-card p-5 rounded-2xl border border-palette-frost/25 shadow-glass-card flex flex-col">
                    <h3 className="text-sm font-bold text-palette-cream mb-3">
                      Recent Observations ({observations.length})
                    </h3>
                    <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
                      {observations.map((obs) => (
                        <div
                          key={obs.id}
                          className="p-3.5 border border-palette-slate/25 rounded-xl text-xs glass-card-subtle space-y-1.5 transition-all hover:border-palette-frost/40"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-palette-frost">{obs.edge_id}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                obs.status === 'passable'
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                                  : obs.status === 'impassable'
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
                                  : 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                              }`}
                            >
                              {obs.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-palette-frost/85">
                            Source: <span className="font-semibold text-palette-cream">{obs.source_type}</span> | Credibility:{' '}
                            <span className="font-semibold text-palette-cream">{(obs.source_credibility * 100).toFixed(0)}%</span>
                            {obs.water_depth_cm !== undefined && (
                              <>
                                {' '}| Water Depth: <span className="font-semibold text-palette-sage">{obs.water_depth_cm} cm</span>
                              </>
                            )}
                          </div>
                          {obs.notes && (
                            <p className="text-palette-cream italic border-l-2 border-palette-slate/50 pl-2 mt-1">
                              "{obs.notes}"
                            </p>
                          )}
                          <div className="text-[10px] text-palette-slate font-mono">
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
          </ErrorBoundary>
        </main>

        {/* Global Tactical Footer */}
        <footer className="border-t border-palette-slate/25 glass-nav py-4 px-6 text-center text-xs text-palette-frost font-mono">
          CrisisRoute Decision Support System — Probabilistic Humanitarian Logistics Core v0.1.0
        </footer>
      </div>
    </div>
  );
};

export const AppRoutes: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Login />;
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
);

export default App;
