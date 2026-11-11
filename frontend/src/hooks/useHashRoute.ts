import { useCallback, useEffect, useState } from 'react';

export const NAV_TABS = ['dashboard', 'import', 'map', 'observations', 'allocation', 'audit'] as const;
export type NavigationTab = (typeof NAV_TABS)[number];

function readTab(): NavigationTab {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return (NAV_TABS as readonly string[]).includes(raw) ? (raw as NavigationTab) : 'dashboard';
}

/** Keeps the active tab in the URL hash so back/forward and deep links work. */
export function useHashRoute(): [NavigationTab, (tab: NavigationTab) => void] {
  const [tab, setTabState] = useState<NavigationTab>(readTab);

  useEffect(() => {
    const onChange = () => setTabState(readTab());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const setTab = useCallback((next: NavigationTab) => {
    window.location.hash = `/${next}`;
  }, []);

  return [tab, setTab];
}
