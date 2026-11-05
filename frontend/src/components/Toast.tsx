import React, { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-emerald-800 text-white border-emerald-900';
      case 'error':
        return 'bg-rose-800 text-white border-rose-900';
      default:
        return 'bg-slate-800 text-white border-slate-900';
    }
  };

  return (
    <div
      className={`p-3 rounded-lg border shadow-lg flex items-center justify-between text-xs font-medium pointer-events-auto transition-all transform translate-y-0 ${getStyle()}`}
    >
      <div className="flex items-center gap-2">
        <span>{toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠' : 'ℹ'}</span>
        <span>{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-3 text-slate-300 hover:text-white font-bold"
      >
        ×
      </button>
    </div>
  );
};

