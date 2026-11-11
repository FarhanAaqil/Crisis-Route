import React from 'react';

/** Pulsing placeholder block shown while data loads. */
export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <div aria-hidden="true" className={`animate-pulse rounded-lg bg-palette-steel/40 ${className}`} />
);

export const CardSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="glass-card-subtle rounded-2xl p-4 space-y-3" role="status" aria-label="Loading">
    <Skeleton className="h-3 w-1/3" />
    <Skeleton className="h-6 w-2/3" />
    {Array.from({ length: Math.max(0, lines - 2) }).map((_, i) => (
      <Skeleton key={i} className="h-3 w-1/2" />
    ))}
  </div>
);

export const PageSkeleton: React.FC = () => (
  <div className="space-y-4" role="status" aria-label="Loading page">
    <Skeleton className="h-24 w-full rounded-3xl" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
    <Skeleton className="h-64 w-full rounded-3xl" />
  </div>
);
