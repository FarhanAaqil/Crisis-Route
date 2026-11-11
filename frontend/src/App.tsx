import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageSkeleton } from './components/Skeleton';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Login } from './pages/Login';
import { NavigationTab, useHashRoute } from './hooks/useHashRoute';

export type { NavigationTab } from './hooks/useHashRoute';

// Each screen is its own chunk, fetched when first visited
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const ImportWizard = lazy(() => import('./pages/ImportWizard').then((m) => ({ default: m.ImportWizard })));
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const ObservationsPage = lazy(() =>
  import('./pages/ObservationsPage').then((m) => ({ default: m.ObservationsPage })),
);
const AllocationDashboard = lazy(() =>
  import('./pages/AllocationDashboard').then((m) => ({ default: m.AllocationDashboard })),
);
const AuditLogViewer = lazy(() => import('./pages/AuditLogViewer').then((m) => ({ default: m.AuditLogViewer })));

const TAB_TITLES: Record<NavigationTab, string> = {
  dashboard: 'Overview & Sign-Off',
  import: 'Data Import',
  map: 'Passability & Risk',
  observations: 'Field Observations',
  allocation: 'Resource Allocation',
  audit: 'Audit Trail',
};

const TabContent: React.FC<{ tab: NavigationTab }> = ({ tab }) => {
  switch (tab) {
    case 'dashboard':
      return <Dashboard />;
    case 'import':
      return <ImportWizard />;
    case 'map':
      return <MapPage />;
    case 'observations':
      return <ObservationsPage />;
    case 'allocation':
      return <AllocationDashboard />;
    case 'audit':
      return <AuditLogViewer />;
  }
};

const AppContent: React.FC = () => {
  const { activeScenario, activeRole } = useApp();
  const [activeTab] = useHashRoute();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    document.title = `${TAB_TITLES[activeTab]} · CrisisRoute`;
  }, [activeTab]);

  return (
    <div className="relative min-h-screen bg-palette-deep text-palette-cream flex font-sans antialiased overflow-x-hidden selection:bg-palette-frost/30 selection:text-palette-cream">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-palette-cream focus:text-palette-deep"
      >
        Skip to main content
      </a>

      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] left-[15%] w-[550px] h-[550px] rounded-full bg-palette-steel/30 blur-[130px]" />
        <div className="absolute top-[40%] right-[-5%] w-[600px] h-[600px] rounded-full bg-palette-slate/25 blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[30%] w-[500px] h-[500px] rounded-full bg-palette-frost/15 blur-[140px]" />
      </div>

      <Sidebar
        activeTab={activeTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div
        className={`relative z-10 flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'
        }`}
      >
        <header className="sticky top-0 z-30 glass-nav border-b border-palette-slate/25 shadow-glass-card backdrop-blur-2xl">
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                aria-label="Open navigation"
                className="lg:hidden p-2 rounded-xl text-palette-frost hover:text-palette-cream hover:bg-palette-steel/30 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center border border-palette-frost/20"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-extrabold text-palette-cream tracking-tight truncate">
                  {TAB_TITLES[activeTab]}
                </h2>
                <p className="text-[11px] text-palette-frost/85 truncate">
                  {activeScenario ? `${activeScenario.name} · ` : ''}
                  <span className="font-semibold text-palette-cream capitalize">{activeRole.replace('_', ' ')}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/90 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-center space-x-2 text-center shadow-inner backdrop-blur-md">
            <span className="bg-slate-950 text-amber-400 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider shrink-0">
              Safety Invariant
            </span>
            <span>
              CrisisRoute provides probabilistic decision support under road uncertainty. It does not certify route
              safety or replace ground situational reports.
            </span>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto focus:outline-none"
          aria-labelledby={`tab-${activeTab}`}
        >
          <ErrorBoundary fallbackTitle="This screen failed to render">
            <Suspense fallback={<PageSkeleton />}>
              <div role="region" id={`panel-${activeTab}`} aria-label={TAB_TITLES[activeTab]}>
                <TabContent tab={activeTab} />
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>

        <footer className="border-t border-palette-slate/25 glass-nav py-4 px-6 text-center text-xs text-palette-frost font-mono">
          CrisisRoute Decision Support System · probabilistic humanitarian logistics
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
