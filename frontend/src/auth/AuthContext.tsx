import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as apiLogin } from '../api/client';
import {
  Session,
  SessionUser,
  UNAUTHORIZED_EVENT,
  clearSession,
  loadSession,
  saveSession,
  setActiveToken,
} from './session';

interface AuthContextValue {
  user: SessionUser | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: (reason?: string) => void;
  sessionNotice: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EXPIRED_NOTICE = 'Your session expired. Please sign in again.';

interface AuthProviderProps {
  children: React.ReactNode;
  /** Pre-seeded session, used by tests and server rendering. */
  initialSession?: Session | null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, initialSession }) => {
  const [session, setSession] = useState<Session | null>(() => {
    const existing = initialSession ?? loadSession();
    setActiveToken(existing?.token ?? null);
    return existing;
  });
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const signOut = useCallback((reason?: string) => {
    clearSession();
    setActiveToken(null);
    setSession(null);
    setSessionNotice(reason ?? null);
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await apiLogin(username, password);
    const next: Session = {
      token: res.access_token,
      user: res.user,
      expiresAt: Date.now() + res.expires_in * 1000,
    };
    saveSession(next);
    setActiveToken(next.token);
    setSessionNotice(null);
    setSession(next);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => signOut(EXPIRED_NOTICE);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [signOut]);

  useEffect(() => {
    if (!session) return;
    const remaining = Math.max(session.expiresAt - Date.now(), 0);
    const timer = window.setTimeout(() => signOut(EXPIRED_NOTICE), remaining);
    return () => window.clearTimeout(timer);
  }, [session, signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ user: session?.user ?? null, signIn, signOut, sessionNotice }),
    [session, signIn, signOut, sessionNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
