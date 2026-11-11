/** Browser session storage for the bearer token. Storage can be blocked, so every access is guarded. */

export type Role = 'analyst' | 'field_analyst' | 'approver' | 'admin';

export interface SessionUser {
  user_id: string;
  username: string;
  display_name: string;
  role: Role;
}

export interface Session {
  token: string;
  user: SessionUser;
  expiresAt: number;
}

const STORAGE_KEY = 'crisisroute.session';
export const UNAUTHORIZED_EVENT = 'crisisroute:unauthorized';

export function loadSession(): Session | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.token || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable: session lives only in memory */
  }
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

let memoryToken: string | null = null;

export function setActiveToken(token: string | null): void {
  memoryToken = token;
}

export function getToken(): string | null {
  return memoryToken ?? loadSession()?.token ?? null;
}
