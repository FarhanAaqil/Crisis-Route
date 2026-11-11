import React from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div
    role="alert"
    className="glass-card rounded-2xl p-5 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-3"
  >
    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
    <div className="space-y-2">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 rounded-lg glass-card-subtle border border-palette-frost/25 text-palette-cream min-h-[36px]"
        >
          Try again
        </button>
      )}
    </div>
  </div>
);

export const EmptyState: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="glass-card-subtle rounded-2xl p-6 text-center text-xs text-palette-frost space-y-1">
    <Inbox className="w-5 h-5 mx-auto text-palette-slate" />
    <p className="font-semibold text-palette-cream">{title}</p>
    {hint && <p>{hint}</p>}
  </div>
);
