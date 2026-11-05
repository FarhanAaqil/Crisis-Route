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
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Main Sidebar Shell */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 border-r border-slate-800 text-slate-100 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-72'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand & System Status Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          {!isCollapsed ? (
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20 border border-blue-400/30">
                CR
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                  CrisisRoute
                </h1>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-[10px] text-slate-400 font-mono tracking-wide uppercase">
                    {isOnline ? 'Tactical Ops Nominal' : 'Local Cache Active'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-base shadow-md">
                CR
              </div>
            </div>
          )}

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand operations sidebar' : 'Collapse operations sidebar'}
            className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[36px] min-w-[36px]"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Tactical 3D Mini Radar (Expanded View Only) */}
        {!isCollapsed && (
          <div className="px-4 py-3 bg-slate-950/50 border-b border-slate-800/80 flex flex-col items-center justify-center">
            <ThreeTacticalRadar size={110} activeRegion={activeScenario?.region_name || 'India Sector'} />
          </div>
        )}

        {/* Region & Scenario Selector */}
        {!isCollapsed ? (
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/30 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold uppercase tracking-wider flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-blue-400" />
                <span>Operational Sector</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                NDMA Protocol
              </span>
            </div>

            <select
              id="sidebar-scenario-select"
              aria-label="Active disaster scenario selector"
              value={activeScenarioId}
              onChange={(e) => setActiveScenarioId(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 font-medium shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
            >
              {scenarios.map((sc) => (
                <option key={sc.scenario_id} value={sc.scenario_id} className="bg-slate-900 text-slate-200">
                  {sc.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="p-2 border-b border-slate-800 flex justify-center" title="Active Disaster Region">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-blue-400">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* WAI-ARIA Navigation Tabs */}
        <nav
          role="tablist"
          aria-label="Main Navigation Tabs"
          className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden"
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
                className={`w-full flex items-center rounded-xl transition-all duration-200 min-h-[44px] group focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5 space-x-3'
                } ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 font-medium'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                    isSelected ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'
                  }`}
                />

                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between text-xs tracking-wide">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold tracking-wider ${
                          isSelected
                            ? 'bg-blue-700 text-blue-100'
                            : 'bg-slate-800 text-cyan-300 border border-cyan-800/50'
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
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-3">
          {!isCollapsed ? (
            <>
              {/* Role Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <label htmlFor="sidebar-role-select" className="font-semibold flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Security Clearance</span>
                  </label>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      activeRole === 'approver'
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                        : activeRole === 'field_analyst'
                        ? 'bg-purple-950/80 text-purple-300 border border-purple-800/50'
                        : 'bg-blue-950/80 text-blue-300 border border-blue-800/50'
                    }`}
                  >
                    {activeRole.replace('_', ' ')}
                  </span>
                </div>

                <select
                  id="sidebar-role-select"
                  aria-label="Active system role"
                  value={activeRole}
                  onChange={(e) => setActiveRole(e.target.value as Role)}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="analyst">Logistics Coordinator (Analyst)</option>
                  <option value="field_analyst">Field Scout (Telemetry)</option>
                  <option value="approver">Incident Lead Approver</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              {/* Equity Floor Invariant Indicator */}
              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/40 text-[11px] text-emerald-300/90 flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Floor Equity Guarantee</span>
                </div>
                <span className="font-mono font-bold text-emerald-400">α ≥ 40%</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center space-y-2 py-1" title="Equity Guarantee: α ≥ 40%">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/40 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
                <Activity className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
