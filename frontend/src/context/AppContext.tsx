import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  fetchScenarios,
  fetchActivePlan,
  ScenarioSummary,
  PlanDetail,
} from '../api/client';
import { ToastMessage, ToastContainer } from '../components/Toast';

export type UserRole = 'analyst' | 'field_analyst' | 'approver' | 'admin';

export interface AppContextValue {
  scenarios: ScenarioSummary[];
  activeScenarioId: string;
  activeScenario: ScenarioSummary | null;
  setActiveScenarioId: (id: string) => void;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  activePlan: PlanDetail | null;
  setActivePlan: (plan: PlanDetail | null) => void;
  isLoadingScenarios: boolean;
  reloadScenarios: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isOnline: boolean;
}

const defaultScenario: ScenarioSummary = {
  scenario_id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  name: 'Kerala Monsoon 2026 - Wayanad Relief Corridor',
  region_name: 'Wayanad-Periyar Relief Corridor',
  created_at: '2026-11-04T06:00:00Z',
  active_plan_id: null,
};

const defaultContextValue: AppContextValue = {
  scenarios: [defaultScenario],
  activeScenarioId: defaultScenario.scenario_id,
  activeScenario: defaultScenario,
  setActiveScenarioId: () => {},
  activeRole: 'analyst',
  setActiveRole: () => {},
  activePlan: null,
  setActivePlan: () => {},
  isLoadingScenarios: false,
  reloadScenarios: async () => {},
  notify: () => {},
  isOnline: true,
};

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([defaultScenario]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>(defaultScenario.scenario_id);
  const [activeRole, setActiveRole] = useState<UserRole>('analyst');
  const [activePlan, setActivePlan] = useState<PlanDetail | null>(null);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const reloadScenarios = useCallback(async () => {
    try {
      setIsLoadingScenarios(true);
      const list = await fetchScenarios();
      if (list && list.length > 0) {
        setScenarios(list);
        if (!activeScenarioId || !list.some((s) => s.scenario_id === activeScenarioId)) {
          setActiveScenarioId(list[0].scenario_id);
        }
      }
    } catch {
      notify('Backend connection offline — running with local buffer', 'error');
    } finally {
      setIsLoadingScenarios(false);
    }
  }, [activeScenarioId, notify]);

  // Load scenarios on mount
  useEffect(() => {
    reloadScenarios();
  }, []);

  // Fetch active plan when scenario changes
  useEffect(() => {
    if (!activeScenarioId) return;

    let isMounted = true;
    fetchActivePlan(activeScenarioId)
      .then((plan) => {
        if (isMounted) setActivePlan(plan);
      })
      .catch(() => {
        if (isMounted) setActivePlan(null);
      });

    return () => {
      isMounted = false;
    };
  }, [activeScenarioId]);

  const activeScenario = scenarios.find((s) => s.scenario_id === activeScenarioId) || defaultScenario;

  return (
    <AppContext.Provider
      value={{
        scenarios,
        activeScenarioId,
        activeScenario,
        setActiveScenarioId,
        activeRole,
        setActiveRole,
        activePlan,
        setActivePlan,
        isLoadingScenarios,
        reloadScenarios,
        notify,
        isOnline,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  return context || defaultContextValue;
}
