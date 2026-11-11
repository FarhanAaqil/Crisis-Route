import React, { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export const Login: React.FC = () => {
  const { signIn, sessionNotice } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const message = error ?? sessionNotice;

  return (
    <main className="min-h-screen bg-palette-deep text-palette-cream flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="glass-card w-full max-w-md rounded-3xl p-8 border border-palette-frost/25 shadow-glass-card space-y-5"
        aria-labelledby="login-title"
      >
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-palette-steel/50 border border-palette-frost/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-palette-frost" />
          </div>
          <div>
            <h1 id="login-title" className="text-xl font-extrabold tracking-tight">
              CrisisRoute
            </h1>
            <p className="text-xs text-palette-frost">Sign in to the operations console</p>
          </div>
        </div>

        {message && (
          <div role="alert" className="p-3 rounded-xl text-xs border bg-rose-950/60 border-rose-800 text-rose-200">
            {message}
          </div>
        )}

        <label className="block text-xs font-semibold text-palette-frost">
          Username
          <input
            className="glass-input mt-1 w-full rounded-xl px-3 py-2.5 text-sm text-palette-cream focus:outline-none focus:ring-2 focus:ring-palette-frost"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="block text-xs font-semibold text-palette-frost">
          Password
          <input
            type="password"
            className="glass-input mt-1 w-full rounded-xl px-3 py-2.5 text-sm text-palette-cream focus:outline-none focus:ring-2 focus:ring-palette-frost"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="glass-btn-primary w-full rounded-xl py-2.5 text-sm font-bold flex items-center justify-center space-x-2 min-h-[44px] disabled:opacity-60"
        >
          <LogIn className="w-4 h-4" />
          <span>{busy ? 'Signing in...' : 'Sign in'}</span>
        </button>
      </form>
    </main>
  );
};
