import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchActivePlan,
  fetchScenarioDetail,
  fetchScenarios,
  PlanDetail,
  ScenarioDetail,
  ScenarioSummary,
} from '../api/client';
import { ToastMessage, ToastContainer } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { useAsync } from '../hooks/useAsync';
import type { Role } from '../auth/session';

export type UserRole = Role;

export interface AppContextValue {
  scenarios: ScenarioSummary[];
  scenariosLoading: boolean;
  scenariosError: string | null;
  activeScenarioId: string;
  activeScenario: ScenarioSummary | null;
  scenarioDetail: ScenarioDetail | null;
  setActiveScenarioId: (id: string) => void;
  activeRole: UserRole;
  userId: string;
  userName: string;
  activePlan: PlanDetail | null;
  setActivePlan: (plan: PlanDetail | null) => void;
  reloadScenarios: () => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isOnline: boolean;
}

const emptyContext: AppContextValue = {
  scenarios: [],
  scenariosLoading: false,
  scenariosError: null,
  activeScenarioId: '',
  activeScenario: null,
  scenarioDetail: null,
  setActiveScenarioId: () => {},
  activeRole: 'analyst',
  userId: '',
  userName: '',
  activePlan: null,
  setActivePlan: () => {},
  reloadScenarios: () => {},
  notify: () => {},
  isOnline: true,
};

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [chosenScenarioId, setChosenScenarioId] = useState<string>('');
  const [planOverride, setPlanOverride] = useState<{ scenarioId: string; plan: PlanDetail | null } | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
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

  const scenariosQuery = useAsync(fetchScenarios, []);
  const scenarios = useMemo(() => scenariosQuery.data ?? [], [scenariosQuery.data]);

  // Fall back to the first scenario until the user picks one (or if the pick disappeared)
  const activeScenarioId = scenarios.some((s) => s.scenario_id === chosenScenarioId)
    ? chosenScenarioId
    : (scenarios[0]?.scenario_id ?? '');

  const detailQuery = useAsync(
    () => (activeScenarioId ? fetchScenarioDetail(activeScenarioId) : Promise.resolve(null)),
    [activeScenarioId],
  );

  const planQuery = useAsync(
    () => (activeScenarioId ? fetchActivePlan(activeScenarioId).catch(() => null) : Promise.resolve(null)),
    [activeScenarioId],
  );

  const activePlan =
    planOverride && planOverride.scenarioId === activeScenarioId ? planOverride.plan : (planQuery.data ?? null);

  const setActivePlan = useCallback(
    (plan: PlanDetail | null) => setPlanOverride({ scenarioId: activeScenarioId, plan }),
    [activeScenarioId],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      scenarios,
      scenariosLoading: scenariosQuery.loading,
      scenariosError: scenariosQuery.error,
      activeScenarioId,
      activeScenario: scenarios.find((s) => s.scenario_id === activeScenarioId) ?? null,
      scenarioDetail: detailQuery.data,
      setActiveScenarioId: setChosenScenarioId,
      activeRole: user?.role ?? 'analyst',
      userId: user?.user_id ?? '',
      userName: user?.display_name ?? '',
      activePlan,
      setActivePlan,
      reloadScenarios: scenariosQuery.reload,
      notify,
      isOnline,
    }),
    [
      scenarios,
      scenariosQuery.loading,
      scenariosQuery.error,
      scenariosQuery.reload,
      activeScenarioId,
      detailQuery.data,
      user,
      activePlan,
      setActivePlan,
      notify,
      isOnline,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  return useContext(AppContext) ?? emptyContext;
}
