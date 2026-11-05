import React from 'react';
import { useApp } from '../context/AppContext';
import { Role } from '../auth/guards';
import { NavigationTab } from '../App';
import { ThreeTacticalRadar } from './ThreeTacticalRadar';
import {
  LayoutDashboard,
  UploadCloud,
  Compass,
  Radio,
  Truck,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Activity,
  MapPin,
} from 'lucide-react';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const {
    scenarios,
    activeScenarioId,
    activeScenario,
    setActiveScenarioId,
    activeRole,
    setActiveRole,
    isOnline,
  } = useApp();

  const navItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    { id: 'dashboard', label: 'Overview & Sign-Off', icon: LayoutDashboard },
    { id: 'import', label: 'Data Import', icon: UploadCloud },
    { id: 'map', label: 'Passability & Risk', icon: Compass, badge: '3D' },
    { id: 'observations', label: 'Field Observations', icon: Radio },
    { id: 'allocation', label: 'Resource Allocation', icon: Truck },
    { id: 'audit', label: 'Audit Trail', icon: ClipboardList },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          role="presentation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-palette-deep/75 backdrop-blur-md lg:hidden transition-opacity"
        />
      )}

      {/* Main Glassmorphic Sidebar Shell */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col glass-nav border-r border-palette-frost/20 text-palette-cream shadow-2xl transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-72'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand & System Status Header */}
        <div className="p-4 border-b border-palette-slate/25 flex items-center justify-between">
          {!isCollapsed ? (
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-palette-steel via-palette-deep to-palette-frost p-0.5 shadow-lg shadow-palette-deep/50 border border-palette-frost/30">
                <div className="w-full h-full bg-palette-deep/90 rounded-[10px] flex items-center justify-center text-palette-cream font-extrabold text-sm tracking-tight">
                  CR
                </div>
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight text-palette-cream leading-tight">
                  CrisisRoute
                </h1>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOnline ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]' : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-[10px] text-palette-frost font-mono tracking-wide uppercase">
                    {isOnline ? 'Tactical Ops Nominal' : 'Local Cache Active'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-palette-steel via-palette-deep to-palette-frost p-0.5 shadow-md">
                <div className="w-full h-full bg-palette-deep/90 rounded-[10px] flex items-center justify-center text-palette-cream font-bold text-base">
                  CR
                </div>
              </div>
            </div>
          )}

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand operations sidebar' : 'Collapse operations sidebar'}
            className="hidden lg:flex items-center justify-center p-1.5 rounded-xl text-palette-frost hover:text-palette-cream hover:bg-palette-steel/30 transition-colors min-h-[36px] min-w-[36px]"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Tactical 3D Mini Radar */}
        {!isCollapsed && (
          <div className="px-4 py-3 bg-palette-deep/40 border-b border-palette-slate/20 flex flex-col items-center justify-center">
            <ThreeTacticalRadar size={110} activeRegion={activeScenario?.region_name || 'India Sector'} />
          </div>
        )}

        {/* Region & Scenario Selector */}
        {!isCollapsed ? (
          <div className="p-3.5 border-b border-palette-slate/25 bg-palette-deep/30 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-palette-frost">
              <span className="font-semibold uppercase tracking-wider flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-palette-frost" />
                <span>Operational Sector</span>
              </span>
              <span className="text-[10px] font-mono text-palette-sage bg-palette-steel/50 px-2 py-0.5 rounded-md border border-palette-frost/25">
                NDMA Protocol
              </span>
            </div>

            <select
              id="sidebar-scenario-select"
              aria-label="Active disaster scenario selector"
              value={activeScenarioId}
              onChange={(e) => setActiveScenarioId(e.target.value)}
              className="w-full glass-input rounded-xl px-2.5 py-2 text-xs text-palette-cream font-medium shadow-inner focus:outline-none focus:ring-2 focus:ring-palette-frost transition-all cursor-pointer"
            >
              {scenarios.map((sc) => (
                <option key={sc.scenario_id} value={sc.scenario_id} className="bg-palette-deep text-palette-cream">
                  {sc.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="p-2 border-b border-palette-slate/25 flex justify-center" title="Active Disaster Region">
            <div className="w-8 h-8 rounded-xl bg-palette-steel/40 border border-palette-frost/20 flex items-center justify-center text-palette-frost">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* WAI-ARIA Navigation Tabs */}
        <nav
          role="tablist"
          aria-label="Main Navigation Tabs"
          className="flex-1 p-2 space-y-1.5 overflow-y-auto overflow-x-hidden"
        >
          {navItems.map((item) => {
            const isSelected = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                role="tab"
                id={`tab-${item.id}`}
                aria-selected={isSelected}
                aria-controls={`panel-${item.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center rounded-xl transition-all duration-200 min-h-[44px] group focus:outline-none focus:ring-2 focus:ring-palette-frost ${
                  isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5 space-x-3'
                } ${
                  isSelected
                    ? 'glass-btn-primary text-palette-cream font-bold shadow-glass-card'
                    : 'text-palette-frost/85 hover:text-palette-cream hover:bg-palette-steel/30 font-medium'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                    isSelected ? 'text-palette-cream' : 'text-palette-frost group-hover:text-palette-cream'
                  }`}
                />

                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between text-xs tracking-wide">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold tracking-wider ${
                          isSelected
                            ? 'bg-palette-deep/80 text-palette-cream border border-palette-frost/40'
                            : 'bg-palette-steel/40 text-palette-frost border border-palette-slate/40'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Role Switcher & Vulnerability Floor Card */}
        <div className="p-3.5 border-t border-palette-slate/25 bg-palette-deep/50 space-y-3">
          {!isCollapsed ? (
            <>
              {/* Role Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-palette-frost">
                  <label htmlFor="sidebar-role-select" className="font-semibold flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-palette-frost" />
                    <span>Security Clearance</span>
                  </label>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-palette-steel/60 text-palette-cream border border-palette-frost/30 font-mono">
                    {activeRole.replace('_', ' ')}
                  </span>
                </div>

                <select
                  id="sidebar-role-select"
                  aria-label="Active system role"
                  value={activeRole}
                  onChange={(e) => setActiveRole(e.target.value as Role)}
                  className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs text-palette-cream font-medium focus:outline-none focus:ring-2 focus:ring-palette-frost"
                >
                  <option value="analyst" className="bg-palette-deep">Logistics Coordinator (Analyst)</option>
                  <option value="field_analyst" className="bg-palette-deep">Field Scout (Telemetry)</option>
                  <option value="approver" className="bg-palette-deep">Incident Lead Approver</option>
                  <option value="admin" className="bg-palette-deep">System Administrator</option>
                </select>
              </div>

              {/* Equity Floor Invariant Indicator */}
              <div className="p-2.5 rounded-xl glass-card-subtle text-[11px] text-palette-sage flex items-center justify-between border border-palette-frost/20">
                <div className="flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-palette-frost shrink-0" />
                  <span>Floor Equity Guarantee</span>
                </div>
                <span className="font-mono font-bold text-palette-cream">α ≥ 40%</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center space-y-2 py-1" title="Equity Guarantee: α ≥ 40%">
              <div className="w-8 h-8 rounded-xl bg-palette-steel/40 border border-palette-frost/25 flex items-center justify-center text-palette-cream">
                <Activity className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
